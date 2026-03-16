import { readFileSync, writeFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import XLSX from 'xlsx'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const DATA_PATH = join(ROOT, 'src', 'data.json')
const ABDC_PATH = join(ROOT, 'data', 'abdc.xlsx')
const SCOPUS_PATH = join(ROOT, 'data', 'scopus-sources.xlsx')
const SCIMAGO_PATH = join(ROOT, 'data', 'scimago.csv')
const CITESCORE_API_PATH = join(ROOT, 'data', 'scopus-citescore-api.json')
const CITESCORE_SCRAPED_PATH = join(ROOT, 'data', 'scopus-citescore.json')
const OPENALEX_PATH = join(ROOT, 'data', 'openalex-api.json')

const ABDC_DOWNLOAD_URL = process.env.ABDC_URL || ''

// ANZSRC 2020 Field of Research (4-digit) code → name mapping
const FOR_CODES = {
  '3501': 'Accounting, Auditing and Accountability',
  '3502': 'Banking, Finance and Investment',
  '3503': 'Business Systems in Context',
  '3504': 'Commercial Services',
  '3505': 'Human Resources and Industrial Relations',
  '3506': 'Marketing',
  '3507': 'Strategy, Management and Organisational Behaviour',
  '3508': 'Tourism',
  '3509': 'Transportation, Logistics and Supply Chains',
  '3599': 'Other Commerce, Management, Tourism and Services',
  '3801': 'Applied Economics',
  '3802': 'Econometrics',
  '3803': 'Economic Theory',
  '3899': 'Other Economics',
  '4609': 'Information Systems',
  '4801': 'Commercial Law',
  '4905': 'Statistics',
}

function forCodeToName(code) {
  const trimmed = (code || '').trim()
  return FOR_CODES[trimmed] || trimmed || null
}

function normalize(str) {
  return (str || '').toLowerCase().trim().replace(/\s+/g, ' ')
}

function normalizeIssn(issn) {
  return (issn || '').trim().replace(/[-\s]/g, '')
}

// --- ABDC ---

async function ensureAbdc() {
  if (existsSync(ABDC_PATH)) {
    console.log('Using ABDC Excel from data/abdc.xlsx')
    return
  }
  if (!ABDC_DOWNLOAD_URL) {
    console.error('ABDC Excel not found at data/abdc.xlsx')
    console.error('Download it from https://abdc.edu.au/abdc-journal-quality-list/ and save as data/abdc.xlsx')
    console.error('Or set ABDC_URL env var to a direct download link.')
    process.exit(1)
  }
  console.log(`Downloading ABDC Excel from ${ABDC_DOWNLOAD_URL}...`)
  const res = await fetch(ABDC_DOWNLOAD_URL)
  if (!res.ok) throw new Error(`Failed to download ABDC Excel: ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  writeFileSync(ABDC_PATH, buf)
  console.log('ABDC Excel downloaded')
}

function parseAbdc() {
  const wb = XLSX.readFile(ABDC_PATH)
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const allRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })

  let headerIdx = allRows.findIndex(row =>
    row.some(cell => /journal\s*title/i.test(String(cell)))
  )
  if (headerIdx === -1) throw new Error('Cannot find header row with "Journal Title" in ABDC Excel')

  const headers = allRows[headerIdx].map(h => String(h).trim())
  const dataRows = allRows.slice(headerIdx + 1)

  const titleIdx = headers.findIndex(h => /journal\s*title/i.test(h))
  const publisherIdx = headers.findIndex(h => /publisher/i.test(h))
  const rankIdx = headers.findIndex(h => /2025.*rating|proposed.*rating/i.test(h))
  const rank2022Idx = headers.findIndex(h => /2022.*rating/i.test(h))
  const issnIdx = headers.findIndex(h => /^issn$/i.test(h))
  const issnOnlineIdx = headers.findIndex(h => /issnonline|issn.*online/i.test(h))
  const forIdx = headers.findIndex(h => /^for$/i.test(h))
  const inceptionIdx = headers.findIndex(h => /inception/i.test(h))

  const effectiveRankIdx = rankIdx !== -1 ? rankIdx : rank2022Idx

  console.log(`ABDC headers found at row ${headerIdx}: ${headers.filter(h => h).join(', ')}`)
  console.log(`ABDC columns mapped: title=${titleIdx}, publisher=${publisherIdx}, rank=${effectiveRankIdx}, issn=${issnIdx}, issnOnline=${issnOnlineIdx}, for=${forIdx}, inception=${inceptionIdx}`)

  return dataRows.map(row => ({
    Title: String(row[titleIdx] || '').trim(),
    Publisher: String(row[publisherIdx] || '').trim(),
    'ABDC ranking': String(row[effectiveRankIdx] || '').trim(),
    abdc_issn: String(row[issnIdx] || '').trim().replace(/\s+/g, ''),
    abdc_issn_online: issnOnlineIdx !== -1 ? String(row[issnOnlineIdx] || '').trim().replace(/\s+/g, '') : '',
    abdc_for: forIdx !== -1 ? String(row[forIdx] || '').trim() : '',
    abdc_year_inception: inceptionIdx !== -1 ? String(row[inceptionIdx] || '').trim() : '',
    abdc_2022_rating: rank2022Idx !== -1 ? String(row[rank2022Idx] || '').trim() : '',
  })).filter(r => r.Title)
}

// --- SCImago ---

function loadScimago() {
  if (!existsSync(SCIMAGO_PATH)) {
    console.warn('No SCImago file found at data/scimago.csv — skipping SCImago enrichment')
    return { byIssn: new Map(), byTitle: new Map() }
  }

  const raw = readFileSync(SCIMAGO_PATH, 'utf-8')
  const lines = raw.split('\n')
  const headers = lines[0].split(';')

  const col = (name) => headers.findIndex(h => h.trim().toLowerCase() === name.toLowerCase())
  const titleCol = col('Title')
  const issnCol = col('Issn')
  const hIndexCol = col('H index')
  const sjrCol = col('SJR')
  const sjrQuartileCol = col('SJR Best Quartile')
  const countryCol = col('Country')
  const categoriesCol = col('Categories')
  const areasCol = col('Areas')
  const totalCitesCol = col('Total Citations (3years)')
  const citesPerDocCol = col('Citations / Doc. (2years)')
  const totalDocsCol = col('Total Docs. (2024)')
  const typeCol = col('Type')
  const oaCol = col('Open Access')

  console.log(`SCImago columns mapped: title=${titleCol}, issn=${issnCol}, h_index=${hIndexCol}, sjr=${sjrCol}, country=${countryCol}`)

  const byIssn = new Map()
  const byTitle = new Map()

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    // Parse semicolon-delimited, respecting quoted fields
    const fields = []
    let field = ''
    let inQuotes = false
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes; continue }
      if (ch === ';' && !inQuotes) { fields.push(field); field = ''; continue }
      field += ch
    }
    fields.push(field)

    const parseNum = (idx) => {
      if (idx === -1) return null
      const v = (fields[idx] || '').trim().replace(',', '.')
      const n = Number(v)
      return isNaN(n) ? null : n
    }

    const entry = {
      h_index: parseNum(hIndexCol),
      sjr: parseNum(sjrCol),
      sjr_quartile: sjrQuartileCol !== -1 ? (fields[sjrQuartileCol] || '').trim() || null : null,
      country: countryCol !== -1 ? (fields[countryCol] || '').trim() || null : null,
      categories: categoriesCol !== -1 ? (fields[categoriesCol] || '').trim() || null : null,
      areas: areasCol !== -1 ? (fields[areasCol] || '').trim() || null : null,
      total_citations_3yr: parseNum(totalCitesCol),
      cites_per_doc_2yr: parseNum(citesPerDocCol),
      total_docs: parseNum(totalDocsCol),
      type: typeCol !== -1 ? (fields[typeCol] || '').trim() || null : null,
      is_oa: oaCol !== -1 ? (fields[oaCol] || '').trim() === 'Yes' : null,
    }

    // Index by all ISSNs
    const issnRaw = issnCol !== -1 ? (fields[issnCol] || '') : ''
    const issns = issnRaw.split(',').map(s => normalizeIssn(s)).filter(Boolean)
    for (const issn of issns) {
      byIssn.set(issn, entry)
    }

    // Index by title
    const title = titleCol !== -1 ? normalize(fields[titleCol] || '') : ''
    if (title) byTitle.set(title, entry)
  }

  console.log(`SCImago index: ${byIssn.size} ISSNs, ${byTitle.size} titles`)
  return { byIssn, byTitle }
}

function findScimago(entry, scimago) {
  const issn = normalizeIssn(entry.abdc_issn || entry.issn)
  if (issn && scimago.byIssn.has(issn)) return scimago.byIssn.get(issn)
  return scimago.byTitle.get(normalize(entry.Title)) || null
}

// --- Scopus (rich metadata) ---

function loadScopusIndex() {
  if (!existsSync(SCOPUS_PATH)) {
    console.warn('No Scopus file found at data/scopus-sources.xlsx — skipping Scopus enrichment')
    return { byIssn: new Map(), byTitle: new Map() }
  }

  const wb = XLSX.readFile(SCOPUS_PATH)
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' })

  const sample = rows[0] || {}
  const keys = Object.keys(sample)
  const titleCol = keys.find(k => /source\s*title|title/i.test(k))
  const issnCol = keys.find(k => /^issn$/i.test(k))
  const eissnCol = keys.find(k => /e-?issn/i.test(k))
  const activeCol = keys.find(k => /active\s*or\s*inactive/i.test(k))
  const coverageCol = keys.find(k => /^coverage$/i.test(k))
  const sourceTypeCol = keys.find(k => /source\s*type/i.test(k))
  const oaCol = keys.find(k => /open\s*access\s*status/i.test(k))
  const langCol = keys.find(k => /article\s*language/i.test(k))
  const publisherCol = keys.find(k => /publisher\s*imprints/i.test(k))
  const asjcCol = keys.find(k => /all\s*science.*classification/i.test(k))

  console.log(`Scopus columns mapped: title="${titleCol}", issn="${issnCol}", eissn="${eissnCol}", active="${activeCol}", coverage="${coverageCol}", type="${sourceTypeCol}", oa="${oaCol}", lang="${langCol}", asjc="${asjcCol}"`)

  const byIssn = new Map()
  const byTitle = new Map()
  const allRows = []

  for (const r of rows) {
    const title = titleCol ? String(r[titleCol]).trim() : ''
    const issn = issnCol ? String(r[issnCol]).trim() : ''
    const eissn = eissnCol ? String(r[eissnCol]).trim() : ''
    const active = activeCol ? String(r[activeCol]).trim() : null
    const coverage = coverageCol ? String(r[coverageCol]).trim() || null : null
    const source_type = sourceTypeCol ? String(r[sourceTypeCol]).trim() || null : null
    const language = langCol ? String(r[langCol]).trim() || null : null
    const publisher = publisherCol ? String(r[publisherCol]).trim() || null : null
    const asjc_codes = asjcCol ? String(r[asjcCol]).trim() || null : null
    const scopus_oa = oaCol ? !!String(r[oaCol]).trim() : null

    const entry = {
      scopus: true,
      active,
      coverage,
      source_type,
      scopus_oa,
      language,
      scopus_publisher: publisher,
      asjc_codes,
    }

    allRows.push({ title, issn, eissn, active, coverage, source_type, language, publisher, asjc_codes, scopus_oa })

    if (issn) byIssn.set(normalizeIssn(issn), entry)
    if (eissn) byIssn.set(normalizeIssn(eissn), entry)
    if (title) byTitle.set(normalize(title), entry)
  }

  console.log(`Scopus index: ${byIssn.size} ISSNs, ${byTitle.size} titles, ${allRows.length} total rows`)
  return { byIssn, byTitle, rows: allRows }
}

function findScopus(entry, scopus) {
  const issn = normalizeIssn(entry.abdc_issn || entry.issn)
  if (issn && scopus.byIssn.has(issn)) return scopus.byIssn.get(issn)
  return scopus.byTitle.get(normalize(entry.Title)) || null
}

// --- CiteScore (API or scraped) ---

function loadCiteScore() {
  // Prefer API data, fall back to scraped data
  if (existsSync(CITESCORE_API_PATH)) {
    const raw = JSON.parse(readFileSync(CITESCORE_API_PATH, 'utf-8'))
    // API data is keyed by normalized ISSN
    const byIssn = new Map()
    const byTitle = new Map()
    for (const [issn, entry] of Object.entries(raw)) {
      byIssn.set(issn, entry)
      if (entry.source_title) {
        byTitle.set(normalize(entry.source_title), entry)
      }
    }
    console.log(`CiteScore API index: ${byIssn.size} ISSNs, ${byTitle.size} titles`)
    return { byIssn, byTitle, source: 'api' }
  }

  if (existsSync(CITESCORE_SCRAPED_PATH)) {
    const raw = JSON.parse(readFileSync(CITESCORE_SCRAPED_PATH, 'utf-8'))
    const byTitle = new Map()
    for (const entry of raw) {
      if (entry.source_title) {
        byTitle.set(normalize(entry.source_title), {
          citescore: entry.citescore != null ? Number(String(entry.citescore).replace(/,/g, '')) : null,
          highest_percentile: entry.highest_percentile ? Number(String(entry.highest_percentile).replace('%', '')) : null,
          percentile_category: entry.category || null,
          percentile_rank: entry.rank || null,
          source_id: entry.sourceid || null,
        })
      }
    }
    console.log(`CiteScore scraped index: ${byTitle.size} titles (no ISSN keys)`)
    return { byIssn: new Map(), byTitle, source: 'scraped' }
  }

  console.warn('No CiteScore data found — skipping CiteScore enrichment')
  return { byIssn: new Map(), byTitle: new Map(), source: null }
}

function findCiteScore(entry, citescore) {
  const issn = normalizeIssn(entry.abdc_issn || entry.issn)
  if (issn && citescore.byIssn.has(issn)) return citescore.byIssn.get(issn)
  return citescore.byTitle.get(normalize(entry.Title)) || null
}

// --- OpenAlex ---

function loadOpenAlex() {
  if (!existsSync(OPENALEX_PATH)) {
    console.warn('No OpenAlex data found at data/openalex-api.json — skipping OpenAlex enrichment')
    return { byIssn: new Map(), byTitle: new Map() }
  }

  const raw = JSON.parse(readFileSync(OPENALEX_PATH, 'utf-8'))
  const byIssn = new Map()
  const byTitle = new Map()
  for (const [issn, entry] of Object.entries(raw)) {
    byIssn.set(issn, entry)
    if (entry.display_name) {
      byTitle.set(normalize(entry.display_name), entry)
    }
  }
  console.log(`OpenAlex index: ${byIssn.size} ISSNs, ${byTitle.size} titles`)
  return { byIssn, byTitle }
}

function findOpenAlex(entry, openalex) {
  const issn = normalizeIssn(entry.abdc_issn || entry.issn)
  if (issn && openalex.byIssn.has(issn)) return openalex.byIssn.get(issn)
  // Try online ISSN
  const issnOnline = normalizeIssn(entry.abdc_issn_online || entry.issn_online)
  if (issnOnline && openalex.byIssn.has(issnOnline)) return openalex.byIssn.get(issnOnline)
  return openalex.byTitle.get(normalize(entry.Title)) || null
}

// --- Main ---

async function main() {
  // Step 1: Parse ABDC
  await ensureAbdc()
  const journals = parseAbdc()
  console.log(`Parsed ${journals.length} journals from ABDC Excel`)

  // Step 2: Load local enrichment sources
  const scimago = loadScimago()
  const scopus = loadScopusIndex()
  const citescore = loadCiteScore()
  const openalex = loadOpenAlex()

  // Step 3: Enrich each journal
  const results = []
  let scimagoHits = 0
  let scopusHits = 0
  let citescoreHits = 0
  let openalexHits = 0

  for (let i = 0; i < journals.length; i++) {
    const entry = journals[i]

    // SCImago enrichment (h-index, SJR, country, categories)
    const sci = findScimago(entry, scimago)
    if (sci) {
      entry.h_index = sci.h_index
      entry.sjr = sci.sjr
      entry.sjr_quartile = sci.sjr_quartile
      entry.country = sci.country
      entry.subject_area = sci.areas ? sci.areas.split(';').map(s => s.trim()).filter(Boolean) : null
      entry.categories = sci.categories
      entry.cites_per_doc_2yr = sci.cites_per_doc_2yr
      entry.total_citations_3yr = sci.total_citations_3yr
      entry.total_docs = sci.total_docs
      entry.type = sci.type
      entry.is_oa = sci.is_oa
      scimagoHits++
    } else {
      entry.h_index = null
      entry.sjr = null
      entry.sjr_quartile = null
      entry.country = null
      entry.subject_area = null
      entry.categories = null
      entry.cites_per_doc_2yr = null
      entry.total_citations_3yr = null
      entry.total_docs = null
      entry.type = null
      entry.is_oa = null
    }

    // Scopus enrichment (indexed status + metadata)
    const sco = findScopus(entry, scopus)
    if (sco) {
      entry.scopus = 'True'
      entry.scopus_active = sco.active
      entry.coverage = sco.coverage
      entry.source_type = sco.source_type
      entry.language = sco.language
      scopusHits++
    } else {
      entry.scopus = 'False'
      entry.scopus_active = null
      entry.coverage = null
      entry.source_type = null
      entry.language = null
    }

    // CiteScore enrichment
    const cs = findCiteScore(entry, citescore)
    if (cs) {
      entry.citescore = cs.citescore
      entry.highest_percentile = cs.highest_percentile
      entry.percentile_category = cs.percentile_category
      citescoreHits++
    } else {
      entry.citescore = null
      entry.highest_percentile = null
      entry.percentile_category = null
    }

    // OpenAlex fallback enrichment (never overwrites existing data)
    const oa = findOpenAlex(entry, openalex)
    if (oa) {
      openalexHits++
      // Fallback: h_index when SCImago didn't match
      if (entry.h_index == null && oa.h_index != null) entry.h_index = oa.h_index
      // Fallback: country when SCImago didn't provide it
      if (!entry.country && oa.country_code) entry.country = oa.country_code
      // Fallback: homepage_url when not set from other sources
      if (!entry.homepage_url) entry.homepage_url = oa.homepage_url || null
      // New fields always from OpenAlex
      entry.works_count = oa.works_count
      entry.cited_by_count = oa.cited_by_count
      entry.mean_citedness_2yr = oa.mean_citedness_2yr
    } else {
      if (!entry.homepage_url) entry.homepage_url = null
      entry.works_count = null
      entry.cited_by_count = null
      entry.mean_citedness_2yr = null
    }

    // ABDC fields
    entry.for_code = entry.abdc_for || null
    entry.for_name = forCodeToName(entry.abdc_for)
    entry.year_inception = entry.abdc_year_inception ? Number(entry.abdc_year_inception) || null : null
    entry.abdc_2022 = entry.abdc_2022_rating || null

    // Use FoR name as subject_area fallback when Scopus/SCImago didn't provide one
    if (!entry.subject_area && entry.for_name) {
      entry.subject_area = [entry.for_name]
    }

    // Use ABDC ISSN as fallback, keep online ISSN too
    entry.issn = entry.abdc_issn || null
    entry.issn_online = entry.abdc_issn_online || null
    delete entry.abdc_issn
    delete entry.abdc_issn_online
    delete entry.abdc_for
    delete entry.abdc_year_inception
    delete entry.abdc_2022_rating

    results.push(entry)

    if ((i + 1) % 500 === 0) {
      console.log(`Processed ${i + 1}/${journals.length}`)
    }
  }

  // Step 4: Add unmatched active Scopus journals
  const existingIssns = new Set()
  const existingTitles = new Set()
  for (const r of results) {
    if (r.issn) existingIssns.add(normalizeIssn(r.issn))
    if (r.issn_online) existingIssns.add(normalizeIssn(r.issn_online))
    existingTitles.add(normalize(r.Title))
  }

  let scopusOnlyCount = 0
  if (scopus.rows) {
    for (const row of scopus.rows) {
      if (row.active !== 'Active' || row.source_type !== 'Journal') continue

      const issn = normalizeIssn(row.issn)
      const eissn = normalizeIssn(row.eissn)
      if ((issn && existingIssns.has(issn)) || (eissn && existingIssns.has(eissn))) continue
      if (existingTitles.has(normalize(row.title))) continue

      const entry = {
        Title: row.title,
        Publisher: row.publisher || null,
        'ABDC ranking': null,
        scopus: 'True',
        scopus_active: 'Active',
        coverage: row.coverage,
        source_type: row.source_type,
        language: row.language,
        issn: row.issn || null,
        issn_online: row.eissn || null,
        for_code: null,
        for_name: null,
        year_inception: null,
        abdc_2022: null,
      }

      // SCImago enrichment
      const sci = findScimago(entry, scimago)
      if (sci) {
        entry.h_index = sci.h_index
        entry.sjr = sci.sjr
        entry.sjr_quartile = sci.sjr_quartile
        entry.country = sci.country
        entry.subject_area = sci.areas ? sci.areas.split(';').map(s => s.trim()).filter(Boolean) : null
        entry.categories = sci.categories
        entry.cites_per_doc_2yr = sci.cites_per_doc_2yr
        entry.total_citations_3yr = sci.total_citations_3yr
        entry.total_docs = sci.total_docs
        entry.type = sci.type
        entry.is_oa = sci.is_oa
      } else {
        entry.h_index = null
        entry.sjr = null
        entry.sjr_quartile = null
        entry.country = null
        entry.subject_area = null
        entry.categories = null
        entry.cites_per_doc_2yr = null
        entry.total_citations_3yr = null
        entry.total_docs = null
        entry.type = null
        entry.is_oa = null
      }

      // CiteScore enrichment
      const cs = findCiteScore(entry, citescore)
      if (cs) {
        entry.citescore = cs.citescore
        entry.highest_percentile = cs.highest_percentile
        entry.percentile_category = cs.percentile_category
      } else {
        entry.citescore = null
        entry.highest_percentile = null
        entry.percentile_category = null
      }

      // OpenAlex enrichment
      const oa = findOpenAlex(entry, openalex)
      if (oa) {
        if (entry.h_index == null && oa.h_index != null) entry.h_index = oa.h_index
        if (!entry.country && oa.country_code) entry.country = oa.country_code
        entry.homepage_url = oa.homepage_url || null
        entry.works_count = oa.works_count
        entry.cited_by_count = oa.cited_by_count
        entry.mean_citedness_2yr = oa.mean_citedness_2yr
      } else {
        entry.homepage_url = null
        entry.works_count = null
        entry.cited_by_count = null
        entry.mean_citedness_2yr = null
      }

      // Track ISSNs to avoid duplicates within Scopus-only additions
      if (issn) existingIssns.add(issn)
      if (eissn) existingIssns.add(eissn)
      existingTitles.add(normalize(row.title))

      results.push(entry)
      scopusOnlyCount++
    }
    console.log(`Added ${scopusOnlyCount} Scopus-only active journals`)
  }

  writeFileSync(DATA_PATH, JSON.stringify(results, null, 2))
  console.log(`Done. Wrote ${results.length} entries to ${DATA_PATH}`)
  console.log(`  ABDC journals: ${journals.length}`)
  console.log(`  Scopus-only journals: ${scopusOnlyCount}`)
  console.log(`  SCImago matched: ${scimagoHits}/${journals.length} (ABDC)`)
  console.log(`  Scopus matched: ${scopusHits}/${journals.length} (ABDC)`)
  console.log(`  CiteScore matched: ${citescoreHits}/${journals.length} (ABDC)${citescore.source ? ` (source: ${citescore.source})` : ''}`)
  console.log(`  OpenAlex matched: ${openalexHits}/${journals.length} (ABDC)`)
}

main()
