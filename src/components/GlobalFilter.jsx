import { useState, useEffect } from 'react'

export default function GlobalFilter({ value, onChange, totalCount, filteredCount, table }) {
  const [local, setLocal] = useState(value)

  useEffect(() => {
    const timeout = setTimeout(() => onChange(local), 200)
    return () => clearTimeout(timeout)
  }, [local])

  useEffect(() => {
    setLocal(value)
  }, [value])

  const isFiltered = filteredCount < totalCount

  // Get columns with Filter components for mobile display
  const filterColumns = table
    ? table.getAllColumns().filter(c => c.getCanFilter() && c.columnDef.Filter)
    : []

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <div className="relative flex-1">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
        </svg>
        <input
          type="text"
          value={local}
          onChange={e => setLocal(e.target.value)}
          placeholder={`Search ${totalCount.toLocaleString()} journals...`}
          className="w-full pl-10 pr-4 py-2.5 bg-surface border border-border rounded-lg text-sm text-text placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-shadow"
        />
        {isFiltered && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-muted">
            {filteredCount.toLocaleString()} results
          </span>
        )}
      </div>
      {/* Mobile filter dropdowns */}
      {filterColumns.length > 0 && (
        <div className="flex gap-2 md:hidden">
          {filterColumns.map(col => (
            <div key={col.id} className="flex-1">
              <col.columnDef.Filter column={col} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
