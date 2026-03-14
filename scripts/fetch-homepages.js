import { readFileSync, writeFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const DATA_PATH = join(ROOT, 'src', 'data.json')
const WIKIDATA_CACHE = join(ROOT, '.wikidata-homepages.json')

const MAILTO = 'journals-app@example.com'

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

// --- Wikidata (bulk, instant) ---

async function fetchWikidataHomepages() {
  if (existsSync(WIKIDATA_CACHE)) {
    console.log('Using cached Wikidata homepages')
    return JSON.parse(readFileSync(WIKIDATA_CACHE, 'utf-8'))
  }

  console.log('Fetching all journal homepage URLs from Wikidata SPARQL...')
  const query = 'SELECT ?issn ?url WHERE { ?journal wdt:P236 ?issn . ?journal wdt:P856 ?url . }'
  const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(query)}`
  const res = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': `JournalsApp/1.0 (${MAILTO})`,
    },
    signal: AbortSignal.timeout(120000),
  })

  if (!res.ok) throw new Error(`Wikidata SPARQL failed: ${res.status}`)

  const data = await res.json()
  const byIssn = {}

  for (const b of data.results.bindings) {
    const issn = normalizeIssn(b.issn.value)
    const homepage = b.url.value
    if (!byIssn[issn]) byIssn[issn] = homepage
  }

  writeFileSync(WIKIDATA_CACHE, JSON.stringify(byIssn, null, 2))
  console.log(`Wikidata: ${Object.keys(byIssn).length} unique ISSNs with homepage URLs`)
  return byIssn
}

// --- Crossref (per-journal, for gaps) ---

async function fetchCrossrefHomepage(issn) {
  const formatted = formatIssn(issn)
  try {
    const url = `https://api.crossref.org/journals/${formatted}/works?rows=1&select=URL,link&mailto=${MAILTO}`
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) })

    if (!res.ok) return null

    const data = await res.json()
    const items = data.message?.items
    if (!items || items.length === 0) return null

    // Extract publisher domain from article link
    const article = items[0]
    const linkUrl = article.link?.[0]?.URL || article.URL
    if (!linkUrl) return null

    try {
      const parsed = new URL(linkUrl)
      // Skip DOI URLs — not useful as homepage
      if (parsed.hostname === 'doi.org') return null
      return `${parsed.protocol}//${parsed.hostname}`
    } catch {
      return null
    }
  } catch {
    return null
  }
}

// --- Main ---

async function main() {
  const data = JSON.parse(readFileSync(DATA_PATH, 'utf-8'))
  const withIssn = data.filter(j => j.issn)
  console.log(`Total journals: ${data.length}, with ISSN: ${withIssn.length}`)

  // Step 1: Wikidata (bulk)
  const wikidata = await fetchWikidataHomepages()

  let wdMatched = 0
  const needCrossref = []

  for (const j of data) {
    if (!j.issn) continue
    const key = normalizeIssn(j.issn)
    if (wikidata[key]) {
      j.homepage_url = wikidata[key]
      wdMatched++
    } else {
      needCrossref.push(j)
    }
  }

  console.log(`Wikidata matched: ${wdMatched}/${withIssn.length}`)
  console.log(`Remaining for Crossref: ${needCrossref.length}`)

  // Step 2: Crossref for gaps (generous rate limits)
  let crMatched = 0
  for (let i = 0; i < needCrossref.length; i++) {
    const j = needCrossref[i]
    const homepage = await fetchCrossrefHomepage(j.issn)
    if (homepage) {
      j.homepage_url = homepage
      crMatched++
    }

    if ((i + 1) % 50 === 0) {
      console.log(`  Crossref: ${i + 1}/${needCrossref.length} (${crMatched} found)`)
    }

    // Crossref polite pool: ~50 req/s allowed, use 20 req/s to be safe
    await sleep(50)
  }

  console.log(`Crossref matched: ${crMatched}/${needCrossref.length}`)

  // Set null for journals still without homepage
  for (const j of data) {
    if (!j.homepage_url) j.homepage_url = null
  }

  const totalHomepages = data.filter(j => j.homepage_url).length
  console.log(`\nTotal with homepage URL: ${totalHomepages}/${data.length}`)

  writeFileSync(DATA_PATH, JSON.stringify(data, null, 2))
  console.log(`Written to ${DATA_PATH}`)
}

main()
