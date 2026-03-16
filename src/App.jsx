import { useMemo } from 'react'
import data from './data.json'
import JournalTable from './components/JournalTable'
import SelectFilter from './components/SelectFilter'
import MultiSelectFilter from './components/MultiSelectFilter'
import { ThemeProvider, useTheme } from './components/ThemeContext'

function RankingBadge({ getValue }) {
  const value = getValue()
  const styles = {
    'A*': 'bg-emerald-100 text-emerald-600 ring-emerald-500/30 dark:bg-emerald-950 dark:text-emerald-400 dark:ring-emerald-400/20',
    'A': 'bg-blue-100 text-blue-600 ring-blue-500/30 dark:bg-blue-950 dark:text-blue-400 dark:ring-blue-400/20',
    'B': 'bg-amber-100 text-amber-600 ring-amber-500/30 dark:bg-amber-950 dark:text-amber-400 dark:ring-amber-400/20',
    'C': 'bg-slate-100 text-slate-500 ring-slate-400/30 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-400/20',
  }
  if (!value) return <span className="text-text-muted">-</span>
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-md ring-1 ring-inset ${styles[value] || styles['C']}`}>
      {value}
    </span>
  )
}

function ScopusBadge({ getValue }) {
  const value = getValue()
  if (value === 'True') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd"/>
        </svg>
        Yes
      </span>
    )
  }
  return <span className="text-xs text-text-muted">No</span>
}

function ThemeToggle() {
  const { dark, toggle } = useTheme()
  return (
    <button
      onClick={toggle}
      role="switch"
      aria-checked={dark}
      aria-label="Toggle dark mode"
      className="relative inline-flex h-7 w-14 items-center rounded-full border border-border transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
      style={{ backgroundColor: dark ? '#3b82f6' : '#e2e8f0' }}
    >
      <span
        className={`inline-flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-sm transition-transform duration-200 ${dark ? 'translate-x-8' : 'translate-x-1'}`}
      >
        {dark ? (
          <svg className="w-3 h-3 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg>
        ) : (
          <svg className="w-3 h-3 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
        )}
      </span>
    </button>
  )
}

const RANKING_ORDER = { 'A*': 0, 'A': 1, 'B': 2, 'C': 3 }

function rankingSortFn(rowA, rowB, columnId) {
  const a = RANKING_ORDER[rowA.getValue(columnId)] ?? 4
  const b = RANKING_ORDER[rowB.getValue(columnId)] ?? 4
  return a - b
}

function numericCompareFilter(row, columnId, filterValue) {
  const cell = row.getValue(columnId)
  if (cell == null) return false
  const { operator = '=', value } = filterValue
  const num = parseFloat(value)
  if (isNaN(num)) return true
  switch (operator) {
    case '>':  return cell > num
    case '>=': return cell >= num
    case '<':  return cell < num
    case '<=': return cell <= num
    default:   return cell === num
  }
}

function AppContent() {
  const columns = useMemo(() => [
    {
      accessorKey: 'Title',
      header: 'Journal',
      size: 446,
      cell: ({ row }) => {
        const title = row.original.Title
        const url = row.original.homepage_url
        const issn = row.original.issn
        return (
          <div className="flex items-start gap-2 overflow-hidden">
            <div className="min-w-0 flex-1">
              <div className="font-medium text-text leading-snug truncate">{title}</div>
              <div className="text-xs text-text-muted mt-0.5 truncate">
                {row.original.Publisher}
                {issn && <><span className="mx-1.5 text-border">|</span><span className="font-mono opacity-70">ISSN {issn}</span></>}
              </div>
            </div>
            {url && (
              <a href={url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="flex-none mt-0.5 inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-primary-600 bg-primary-50 ring-1 ring-inset ring-primary-200 hover:bg-primary-100 hover:text-primary-700 dark:text-primary-300 dark:bg-primary-500/20 dark:ring-primary-400/30 dark:hover:bg-primary-500/30 dark:hover:text-primary-200 transition-colors" title="Visit journal homepage">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Visit
              </a>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: 'ABDC ranking',
      header: 'ABDC',
      size: 86,
      sortingFn: rankingSortFn,
      filterFn: 'equals',
      Filter: SelectFilter,
      cell: RankingBadge,
    },
    {
      accessorKey: 'scopus',
      header: 'Scopus',
      size: 86,
      filterFn: 'equals',
      Filter: SelectFilter,
      cell: ScopusBadge,
    },
    {
      accessorKey: 'citescore',
      header: 'CiteScore',
      filterFn: numericCompareFilter,
      meta: { hidden: true },
    },
    {
      accessorKey: 'h_index',
      header: 'H-Index',
      filterFn: numericCompareFilter,
      meta: { hidden: true },
    },
    {
      accessorKey: 'highest_percentile',
      header: 'Percentile',
      size: 96,
      filterFn: numericCompareFilter,
      cell: ({ row }) => {
        const pct = row.original.highest_percentile
        const cs = row.original.citescore
        if (pct == null) return <span className="text-text-muted">-</span>
        return (
          <div>
            <span className="font-semibold text-text tabular-nums">{pct}</span>
            {cs != null && (
              <span className="ml-1.5 text-xs text-text-muted">CS {cs}</span>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: 'issn',
      header: 'ISSN',
      enableColumnFilter: false,
      meta: { hidden: true },
    },
    {
      accessorKey: 'country',
      header: 'Country',
      filterFn: 'includesString',
      meta: { hidden: true },
    },
    {
      accessorKey: 'Publisher',
      header: 'Publisher',
      filterFn: 'includesString',
      meta: { hidden: true, filterOnly: true },
    },
    {
      accessorKey: 'sjr_quartile',
      header: 'Quartile',
      filterFn: 'equals',
      meta: { hidden: true },
    },
    {
      accessorKey: 'type',
      header: 'Type',
      filterFn: 'equals',
      meta: { hidden: true },
    },
    {
      accessorKey: 'language',
      header: 'Language',
      filterFn: 'includesString',
      meta: { hidden: true },
    },
    {
      accessorKey: 'is_oa',
      header: 'Open Access',
      filterFn: 'equals',
      meta: { hidden: true },
    },
    {
      accessorKey: 'subject_area',
      header: 'Subject',
      size: 246,
      filterFn: (row, columnId, filterValue) => {
        const cellValue = row.getValue(columnId)
        if (!Array.isArray(filterValue) || filterValue.length === 0) return true
        if (!Array.isArray(cellValue)) return false
        return filterValue.some(v => cellValue.includes(v))
      },
      Filter: MultiSelectFilter,
      cell: ({ getValue }) => {
        const subjects = getValue()
        if (!Array.isArray(subjects) || subjects.length === 0) {
          return <span className="text-text-muted">-</span>
        }
        return (
          <div className="flex flex-wrap gap-1">
            {subjects.map(s => (
              <span key={s} className="inline-block px-1.5 py-0.5 text-xs rounded bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {s}
              </span>
            ))}
          </div>
        )
      },
    },
  ], [])

  const renderExpandedRow = (row) => {
    const d = row.original
    const metrics = [
      { label: 'CiteScore', value: d.citescore },
      { label: 'Percentile', value: d.highest_percentile != null ? `${d.highest_percentile}th` : null },
      { label: 'Percentile Category', value: d.percentile_category },
      { label: 'H-Index', value: d.h_index },
      { label: 'SJR', value: d.sjr },
      { label: 'SJR Quartile', value: d.sjr_quartile },
      { label: 'Cites/Doc (2yr)', value: d.cites_per_doc_2yr },
      { label: 'Total Citations (3yr)', value: d.total_citations_3yr?.toLocaleString() },
      { label: 'Total Docs', value: d.total_docs?.toLocaleString() },
      { label: 'Works', value: d.works_count?.toLocaleString() },
      { label: 'Cited By', value: d.cited_by_count?.toLocaleString() },
      { label: 'Mean Citedness (2yr)', value: d.mean_citedness_2yr },
    ]
    const details = [
      { label: 'Country', value: d.country },
      { label: 'Open Access', value: d.is_oa === true ? 'Yes' : d.is_oa === false ? 'No' : null },
      { label: 'Type', value: d.type || d.source_type },
      { label: 'Language', value: d.language },
      { label: 'Coverage', value: d.coverage },
      { label: 'Status', value: d.scopus_active },
    ]
    const categories = d.categories
    return (
      <div className="px-3 sm:px-4 py-3 space-y-2">
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-x-6 gap-y-1">
          {metrics.map(({ label, value }) => (
            <div key={label} className="flex items-center gap-1.5 text-xs sm:text-sm">
              <span className="text-text-muted">{label}:</span>
              <span className="font-medium text-text tabular-nums">{value ?? '-'}</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-x-6 gap-y-1">
          {details.map(({ label, value }) => (
            <div key={label} className="flex items-center gap-1.5 text-xs sm:text-sm">
              <span className="text-text-muted">{label}:</span>
              <span className="font-medium text-text">{value ?? '-'}</span>
            </div>
          ))}
        </div>
        {categories && (
          <div className="text-xs sm:text-sm">
            <span className="text-text-muted">Categories: </span>
            <span className="text-text-secondary">{categories}</span>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-alt">
      <header className="bg-surface border-b border-border">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-text tracking-tight">
              Academic Journals Directory
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-text-secondary">
              {data.length.toLocaleString()} journals with ABDC rankings and indexing status
            </p>
          </div>
          <ThemeToggle />
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
        <JournalTable data={data} columns={columns} renderExpandedRow={renderExpandedRow} />
      </main>
    </div>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  )
}
