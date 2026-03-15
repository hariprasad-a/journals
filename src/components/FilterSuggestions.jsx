import { FILTER_KEYS, getAllKeys } from '../utils/filterRegistry'

export function getSuggestions(input, cursorPos, table) {
  const textBeforeCursor = input.slice(0, cursorPos)
  const tokenMatch = textBeforeCursor.match(/(\S+)$/)
  const currentToken = tokenMatch ? tokenMatch[1] : ''

  if (!currentToken) return { items: [], mode: 'key', token: '' }

  const colonIdx = currentToken.indexOf(':')

  if (colonIdx === -1) {
    const partial = currentToken.toLowerCase()
    const items = getAllKeys()
      .filter(k => k.startsWith(partial))
      .map(k => ({ display: `${k}:`, description: FILTER_KEYS[k].label, insert: `${k}:`, mode: 'key' }))
    return { items, mode: 'key', token: currentToken }
  }

  const keyPart = currentToken.slice(0, colonIdx).toLowerCase()
  const valuePart = currentToken.slice(colonIdx + 1).toLowerCase().replace(/^"/, '')
  const def = FILTER_KEYS[keyPart]
  if (!def) return { items: [], mode: 'value', token: currentToken }

  let items
  if (def.type === 'number') {
    // Show operator hints when value is empty or just an operator prefix
    if (!valuePart || /^[><=]$/.test(valuePart)) {
      const operators = [
        { op: '>',  desc: 'Greater than' },
        { op: '<',  desc: 'Less than' },
        { op: '>=', desc: 'Greater than or equal' },
        { op: '<=', desc: 'Less than or equal' },
      ]
      items = operators
        .filter(o => !valuePart || o.op.startsWith(valuePart))
        .map(o => ({ display: o.op, description: o.desc, insert: `${keyPart}:${o.op}`, mode: 'key' }))
    } else {
      items = []
    }
  } else if (def.type === 'enum') {
    items = def.values
      .filter(v => v.toLowerCase().startsWith(valuePart))
      .map(v => ({ display: v, insert: v.includes(' ') ? `${keyPart}:"${v}"` : `${keyPart}:${v}`, mode: 'value' }))
  } else {
    const col = table?.getColumn(def.field)
    if (!col) return { items: [], mode: 'value', token: currentToken }
    const facetedValues = col.getFacetedUniqueValues()

    // For array types, exclude already-selected values from suggestions
    const selectedSet = def.type === 'array' && Array.isArray(col.getFilterValue())
      ? new Set(col.getFilterValue())
      : new Set()

    const seen = new Set()
    const matches = []
    for (const [val] of facetedValues) {
      // Handle array values (e.g. subject_area)
      const entries = Array.isArray(val) ? val : [val]
      for (const v of entries) {
        if (v && !seen.has(v) && !selectedSet.has(v) && String(v).toLowerCase().includes(valuePart)) {
          seen.add(v)
          matches.push(String(v))
        }
        if (matches.length >= 8) break
      }
      if (matches.length >= 8) break
    }
    items = matches.sort().map(v => ({
      display: v,
      insert: v.includes(' ') ? `${keyPart}:"${v}"` : `${keyPart}:${v}`,
      mode: 'value',
    }))
  }

  return { items, mode: 'value', token: currentToken }
}

export default function FilterSuggestions({ items, selectedIndex, onSelect }) {
  if (items.length === 0) return null

  return (
    <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-surface border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
      {items.map((item, i) => (
        <button
          key={item.insert}
          type="button"
          className={`w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 ${
            i === selectedIndex
              ? 'bg-primary-100 dark:bg-primary-900/30'
              : 'hover:bg-primary-50 dark:hover:bg-primary-900/20'
          }`}
          onMouseDown={e => { e.preventDefault(); onSelect(item) }}
        >
          <span className="font-medium text-text">{item.display}</span>
          {item.description && <span className="text-text-muted text-xs">{item.description}</span>}
        </button>
      ))}
    </div>
  )
}
