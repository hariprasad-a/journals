import { useMemo, useState, useRef, useEffect } from 'react'

export default function MultiSelectFilter({ column }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const selected = column.getFilterValue() ?? []

  const sortedUniqueValues = useMemo(() => {
    const faceted = column.getFacetedUniqueValues()
    const vals = new Set()
    for (const [key] of faceted) {
      if (Array.isArray(key)) {
        key.forEach(v => v && vals.add(v))
      } else if (key) {
        vals.add(key)
      }
    }
    return Array.from(vals).sort()
  }, [column.getFacetedUniqueValues()])

  useEffect(() => {
    if (!open) return
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const toggle = (val) => {
    const next = selected.includes(val)
      ? selected.filter(v => v !== val)
      : [...selected, val]
    column.setFilterValue(next.length ? next : undefined)
  }

  const label = selected.length
    ? `${selected.length} selected`
    : 'All'

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full md:mt-1 px-2 py-2 md:py-1 text-xs bg-surface border border-border rounded-md text-left text-text-secondary focus:outline-none focus:ring-1 focus:ring-primary-400 focus:border-primary-400 flex items-center justify-between gap-1"
      >
        <span className="truncate">{label}</span>
        <svg className={`w-3 h-3 flex-none transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute z-30 mt-1 w-56 max-h-60 overflow-y-auto bg-surface border border-border rounded-lg shadow-lg py-1">
          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => column.setFilterValue(undefined)}
              className="w-full px-3 py-1.5 text-xs text-primary-500 hover:bg-surface-hover text-left font-medium"
            >
              Clear all
            </button>
          )}
          {sortedUniqueValues.map(val => (
            <label
              key={val}
              className="flex items-center gap-2 px-3 py-1.5 text-xs text-text hover:bg-surface-hover cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selected.includes(val)}
                onChange={() => toggle(val)}
                className="rounded border-border text-primary-500 focus:ring-primary-400 focus:ring-offset-0 h-3.5 w-3.5"
              />
              <span className="truncate">{val}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
