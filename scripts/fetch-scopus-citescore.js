import { readFileSync, writeFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const DATA_PATH = join(ROOT, 'src', 'data.json')
const CACHE_PATH = join(ROOT, 'data', '.scopus-citescore-cache.json')
const OUTPUT_PATH = join(ROOT, 'data', 'scopus-citescore-api.json')

const API_KEY = process.env.ELSEVIER_API_KEY
const BASE_URL = 'https://api.elsevier.com/content/serial/title'

const RATE_LIMIT_MS = 334        // ~3 req/sec
const BATCH_SIZE = 50
const BATCH_PAUSE_MS = 2000      // 2s between batches
const MAX_RETRIES = 3
const INITIAL_BACKOFF_MS = 5000  // 5s on 429
const LOW_QUOTA_THRESHOLD = 100  // pause if remaining < 100
const LOW_QUOTA_PAUSE_MS = 60000 // 60s pause

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function normalizeIssn(issn) {
  return (issn || '').trim().replace(/[-\s]/g, '')
}

function formatIssn(issn) {
  const clean = normalizeIssn(issn)
  if (clean.length === 8) return clean.slice(0, 4) + '-' + clean.slice(4)
  return clean
}

function loadCache() {
  if (existsSync(CACHE_PATH)) {
    return JSON.parse(readFileSync(CACHE_PATH, 'utf-8'))
  }
  return {}
}

function saveCache(cache) {
  writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2))
}

function extractCiteScoreData(entry) {
  const csInfo = entry.citeScoreYearInfoList || {}

  // CiteScore current metric
  const citescore = csInfo.citeScoreCurrentMetric != null
    ? Number(csInfo.citeScoreCurrentMetric)
    : null
  const citescoreYear = csInfo.citeScoreCurrentMetricYear || null

  // CiteScore tracker (in-progress year)
  const citescoreTracker = csInfo.citeScoreTracker != null
    ? Number(csInfo.citeScoreTracker)
    : null

  // Subject rank — find the highest percentile from the latest complete year
  let highestPercentile = null
  let percentileCategory = null
  let percentileRank = null

  const yearInfos = csInfo.citeScoreYearInfo || []
  const yearList = Array.isArray(yearInfos) ? yearInfos : [yearInfos]
  // Find latest "Complete" year entry
  const completeYear = yearList.find(y => y['@status'] === 'Complete')
  if (completeYear) {
    const infoList = completeYear.citeScoreInformationList
    const infos = Array.isArray(infoList) ? infoList : [infoList]
    for (const info of infos) {
      const csInfoItems = info?.citeScoreInfo
      const items = Array.isArray(csInfoItems) ? csInfoItems : [csInfoItems]
      for (const item of items) {
        if (!item) continue
        const ranks = item.citeScoreSubjectRank
        if (!ranks) continue
        const rankList = Array.isArray(ranks) ? ranks : [ranks]
        let best = -1
        for (const sr of rankList) {
          const pct = Number(sr.percentile)
          if (!isNaN(pct) && pct > best) {
            best = pct
            highestPercentile = pct
            // Subject code only — resolve name from subject-area array
            const code = sr.subjectCode
            const subjectAreas = entry['subject-area'] || []
            const match = subjectAreas.find(a => a['@code'] === code)
            percentileCategory = match?.$ || code || null
            percentileRank = sr.rank || null
          }
        }
      }
    }
  }

  // SJR
  const sjrList = entry.SJRList?.SJR
  const sjrEntry = Array.isArray(sjrList) ? sjrList[0] : sjrList
  const sjr = sjrEntry?.$ != null ? Number(sjrEntry.$) : null

  // SNIP
  const snipList = entry.SNIPList?.SNIP
  const snipEntry = Array.isArray(snipList) ? snipList[0] : snipList
  const snip = snipEntry?.$ != null ? Number(snipEntry.$) : null

  return {
    citescore,
    citescore_year: citescoreYear,
    citescore_tracker: citescoreTracker,
    highest_percentile: highestPercentile,
    percentile_category: percentileCategory,
    percentile_rank: percentileRank,
    sjr,
    snip,
    source_id: entry['source-id'] || null,
    source_title: entry['dc:title'] || null,
  }
}

async function fetchCiteScore(issn, apiKey) {
  const formatted = formatIssn(issn)
  const url = `${BASE_URL}?issn=${formatted}&view=CITESCORE`

  const res = await fetch(url, {
    headers: {
      'X-ELS-APIKey': apiKey,
      'Accept': 'application/json',
    },
    signal: AbortSignal.timeout(15000),
  })

  // Log rate limit headers
  const remaining = res.headers.get('X-RateLimit-Remaining')
  const reset = res.headers.get('X-RateLimit-Reset')

  if (res.status === 404) {
    return { result: { not_found: true }, remaining }
  }

  if (res.status === 429) {
    return { result: null, remaining, rateLimited: true, reset }
  }

  if (res.status === 401 || res.status === 403) {
    throw new Error(`Auth error (${res.status}): Check your ELSEVIER_API_KEY`)
  }

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ISSN ${formatted}`)
  }

  const data = await res.json()
  const entries = data['serial-metadata-response']?.entry
  if (!entries || entries.length === 0) {
    return { result: { not_found: true }, remaining }
  }

  const entry = entries[0]
  if (entry.error) {
    return { result: { not_found: true, error: entry.error }, remaining }
  }

  return { result: extractCiteScoreData(entry), remaining }
}

async function main() {
  if (!API_KEY) {
    console.error('Error: ELSEVIER_API_KEY environment variable is required')
    console.error('Get your API key from https://dev.elsevier.com/')
    process.exit(1)
  }

  // Parse --limit flag
  const limitArg = process.argv.find(a => a.startsWith('--limit'))
  const limit = limitArg
    ? Number(process.argv[process.argv.indexOf(limitArg) + 1] || limitArg.split('=')[1])
    : Infinity

  const data = JSON.parse(readFileSync(DATA_PATH, 'utf-8'))
  const withIssn = data.filter(j => j.issn)
  console.log(`Total journals: ${data.length}, with ISSN: ${withIssn.length}`)

  const cache = loadCache()
  const cachedCount = Object.keys(cache).length
  console.log(`Cache: ${cachedCount} entries`)

  // Build work list — journals with ISSN not yet cached
  const toFetch = []
  for (const j of withIssn) {
    const key = normalizeIssn(j.issn)
    if (!cache[key]) {
      toFetch.push({ title: j.Title, issn: j.issn, key })
    }
  }

  const effectiveLimit = Math.min(toFetch.length, limit)
  const work = toFetch.slice(0, effectiveLimit)
  console.log(`To fetch: ${work.length} (skipping ${toFetch.length - work.length} beyond limit)`)

  if (work.length === 0) {
    console.log('Nothing to fetch — all ISSNs are cached')
  }

  // SIGINT handler — save cache on Ctrl+C
  let interrupted = false
  process.on('SIGINT', () => {
    console.log('\nInterrupted — saving cache...')
    saveCache(cache)
    interrupted = true
    process.exit(0)
  })

  // Fetch in batches
  let fetched = 0
  let found = 0
  let notFound = 0
  let errors = 0

  for (let batchStart = 0; batchStart < work.length; batchStart += BATCH_SIZE) {
    if (interrupted) break

    const batch = work.slice(batchStart, batchStart + BATCH_SIZE)

    for (const item of batch) {
      if (interrupted) break

      let retries = 0
      let backoff = INITIAL_BACKOFF_MS
      let success = false

      while (retries <= MAX_RETRIES && !success) {
        try {
          const { result, remaining, rateLimited, reset } = await fetchCiteScore(item.issn, API_KEY)

          if (rateLimited) {
            retries++
            if (retries > MAX_RETRIES) {
              console.error(`  Rate limited after ${MAX_RETRIES} retries for ${item.issn} — aborting`)
              saveCache(cache)
              process.exit(1)
            }
            console.warn(`  429 rate limited — backing off ${backoff / 1000}s (retry ${retries}/${MAX_RETRIES})`)
            await sleep(backoff)
            backoff *= 2
            continue
          }

          cache[item.key] = result
          fetched++

          if (result.not_found) {
            notFound++
          } else {
            found++
          }

          // Check remaining quota
          if (remaining != null && Number(remaining) < LOW_QUOTA_THRESHOLD) {
            console.warn(`  Low quota remaining (${remaining}) — pausing ${LOW_QUOTA_PAUSE_MS / 1000}s`)
            await sleep(LOW_QUOTA_PAUSE_MS)
          }

          success = true
        } catch (err) {
          if (err.message.startsWith('Auth error')) {
            console.error(err.message)
            saveCache(cache)
            process.exit(1)
          }

          retries++
          if (retries > MAX_RETRIES) {
            console.error(`  Failed after ${MAX_RETRIES} retries for ${item.issn}: ${err.message}`)
            cache[item.key] = { error: err.message }
            errors++
            success = true // move on
          } else {
            console.warn(`  Error for ${item.issn}: ${err.message} — retry ${retries}/${MAX_RETRIES}`)
            await sleep(backoff)
            backoff *= 2
          }
        }
      }

      await sleep(RATE_LIMIT_MS)
    }

    // Save cache after each batch
    saveCache(cache)

    const total = batchStart + batch.length
    console.log(`Processed ${total}/${work.length} — found: ${found}, not_found: ${notFound}, errors: ${errors}`)

    // Pause between batches
    if (batchStart + BATCH_SIZE < work.length) {
      await sleep(BATCH_PAUSE_MS)
    }
  }

  // Write output file — all cached results keyed by ISSN
  const output = {}
  for (const j of withIssn) {
    const key = normalizeIssn(j.issn)
    if (cache[key] && !cache[key].not_found && !cache[key].error) {
      output[key] = cache[key]
    }
  }

  writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2))
  console.log(`\nDone. Results: ${Object.keys(output).length} journals with CiteScore data`)
  console.log(`Written to ${OUTPUT_PATH}`)
}

main()
