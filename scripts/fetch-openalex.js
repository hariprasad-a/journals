import { readFileSync, writeFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const DATA_PATH = join(ROOT, 'src', 'data.json')
const CACHE_PATH = join(ROOT, 'data', '.openalex-cache.json')
const OUTPUT_PATH = join(ROOT, 'data', 'openalex-api.json')

const MAILTO = 'journals-enrichment@example.com'
const BASE_URL = 'https://api.openalex.org/sources'

const RATE_LIMIT_MS = 1000       // 1 req/sec
const BATCH_SIZE = 50            // 50 ISSNs per request via OR filter
const MAX_RETRIES = 3
const INITIAL_BACKOFF_MS = 10000

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

function extractOpenAlexData(result) {
  const stats = result.summary_stats || {}
  const topics = (result.topics || []).slice(0, 5).map(t => t.display_name).filter(Boolean)

  return {
    openalex_id: result.id || null,
    works_count: result.works_count ?? null,
    cited_by_count: result.cited_by_count ?? null,
    h_index: stats.h_index ?? null,
    mean_citedness_2yr: stats['2yr_mean_citedness'] ?? null,
    country_code: result.country_code || null,
    homepage_url: result.homepage_url || null,
    type: result.type || null,
    topics,
    display_name: result.display_name || null,
  }
}

function getIssnsFromResult(result) {
  const issns = []
  if (result.issn_l) issns.push(normalizeIssn(result.issn_l))
  if (Array.isArray(result.issn)) {
    for (const i of result.issn) issns.push(normalizeIssn(i))
  }
  return [...new Set(issns.filter(Boolean))]
}

async function fetchBatch(issns) {
  const filter = issns.map(i => formatIssn(i)).join('|')
  const url = `${BASE_URL}?filter=issn:${filter}&per_page=${BATCH_SIZE}&mailto=${MAILTO}`

  const res = await fetch(url, {
    signal: AbortSignal.timeout(30000),
  })

  // Log rate limit headers
  const remaining = res.headers.get('X-RateLimit-Remaining')
  const creditsUsed = res.headers.get('X-RateLimit-Credits-Used')
  if (remaining != null || creditsUsed != null) {
    console.log(`  Rate limit — remaining: ${remaining}, credits used: ${creditsUsed}`)
  }

  if (res.status === 429) {
    return { results: null, rateLimited: true }
  }

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`)
  }

  const data = await res.json()
  return { results: data.results || [], rateLimited: false }
}

async function main() {
  // Parse --limit flag (limits number of batches)
  const limitArg = process.argv.find(a => a.startsWith('--limit'))
  const batchLimit = limitArg
    ? Number(process.argv[process.argv.indexOf(limitArg) + 1] || limitArg.split('=')[1])
    : Infinity

  const data = JSON.parse(readFileSync(DATA_PATH, 'utf-8'))
  const withIssn = data.filter(j => j.issn)
  console.log(`Total journals: ${data.length}, with ISSN: ${withIssn.length}`)

  const cache = loadCache()
  const cachedCount = Object.keys(cache).length
  console.log(`Cache: ${cachedCount} entries`)

  // Build work list — all unique ISSNs (print + online) not yet cached
  const allIssns = new Set()
  for (const j of withIssn) {
    const key = normalizeIssn(j.issn)
    if (key && !cache[key]) allIssns.add(key)
    if (j.issn_online) {
      const onlineKey = normalizeIssn(j.issn_online)
      if (onlineKey && !cache[onlineKey]) allIssns.add(onlineKey)
    }
  }

  const issnsToFetch = [...allIssns]
  console.log(`Unique uncached ISSNs: ${issnsToFetch.length}`)

  // Build batches
  const batches = []
  for (let i = 0; i < issnsToFetch.length; i += BATCH_SIZE) {
    batches.push(issnsToFetch.slice(i, i + BATCH_SIZE))
  }

  const effectiveBatches = batches.slice(0, batchLimit)
  console.log(`Batches: ${effectiveBatches.length} of ${batches.length} (${BATCH_SIZE} ISSNs each)`)

  if (effectiveBatches.length === 0) {
    console.log('Nothing to fetch — all ISSNs are cached')
  }

  // SIGINT handler
  let interrupted = false
  process.on('SIGINT', () => {
    console.log('\nInterrupted — saving cache...')
    saveCache(cache)
    interrupted = true
    process.exit(0)
  })

  let totalFound = 0
  let totalNotFound = 0

  for (let b = 0; b < effectiveBatches.length; b++) {
    if (interrupted) break

    const batch = effectiveBatches[b]
    let retries = 0
    let backoff = INITIAL_BACKOFF_MS
    let success = false

    while (retries <= MAX_RETRIES && !success) {
      try {
        const { results, rateLimited } = await fetchBatch(batch)

        if (rateLimited) {
          retries++
          if (retries > MAX_RETRIES) {
            console.error(`  Rate limited after ${MAX_RETRIES} retries — aborting`)
            saveCache(cache)
            process.exit(1)
          }
          console.warn(`  429 rate limited — backing off ${backoff / 1000}s (retry ${retries}/${MAX_RETRIES})`)
          await sleep(backoff)
          backoff *= 2
          continue
        }

        // Map results back to ISSNs
        const matchedIssns = new Set()
        for (const result of results) {
          const extracted = extractOpenAlexData(result)
          const resultIssns = getIssnsFromResult(result)
          for (const issn of resultIssns) {
            cache[issn] = extracted
            matchedIssns.add(issn)
          }
        }

        // Mark unmatched ISSNs as not_found
        for (const issn of batch) {
          if (!matchedIssns.has(issn) && !cache[issn]) {
            cache[issn] = { not_found: true }
            totalNotFound++
          }
        }

        totalFound += results.length
        success = true
      } catch (err) {
        retries++
        if (retries > MAX_RETRIES) {
          console.error(`  Batch ${b + 1} failed after ${MAX_RETRIES} retries: ${err.message}`)
          // Mark all as errored so we don't retry next run
          for (const issn of batch) {
            if (!cache[issn]) cache[issn] = { error: err.message }
          }
          success = true
        } else {
          console.warn(`  Error in batch ${b + 1}: ${err.message} — retry ${retries}/${MAX_RETRIES}`)
          await sleep(backoff)
          backoff *= 2
        }
      }
    }

    // Save cache after each batch
    saveCache(cache)
    console.log(`Batch ${b + 1}/${effectiveBatches.length} — found: ${totalFound}, not_found: ${totalNotFound}`)

    // Rate limit between batches
    if (b + 1 < effectiveBatches.length) {
      await sleep(RATE_LIMIT_MS)
    }
  }

  // Write output file — all cached results keyed by ISSN, excluding not_found/errors
  const output = {}
  for (const [issn, entry] of Object.entries(cache)) {
    if (entry && !entry.not_found && !entry.error) {
      output[issn] = entry
    }
  }

  writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2))
  console.log(`\nDone. Results: ${Object.keys(output).length} journals with OpenAlex data`)
  console.log(`Written to ${OUTPUT_PATH}`)
}

main()
