import { useMemo } from 'react'

const CUSTOM_ORDERS = {
  'ABDC ranking': ['A*', 'A', 'B', 'C'],
  'scopus': ['True', 'False'],
}

export default function SelectFilter({ column }) {
  const sortedUniqueValues = useMemo(() => {
    const values = Array.from(column.getFacetedUniqueValues().keys()).filter(Boolean)
    const customOrder = CUSTOM_ORDERS[column.id]
    if (customOrder) {
      const orderMap = new Map(customOrder.map((v, i) => [v, i]))
      return values.sort((a, b) => (orderMap.get(a) ?? 999) - (orderMap.get(b) ?? 999))
    }
    return values.sort()
  }, [column.getFacetedUniqueValues(), column.id])

  return (
    <select
      value={column.getFilterValue() ?? ''}
      onChange={e => column.setFilterValue(e.target.value || undefined)}
      className="w-full mt-1 px-2 py-1 text-xs bg-surface border border-border rounded-md text-text-secondary focus:outline-none focus:ring-1 focus:ring-primary-400 focus:border-primary-400"
    >
      <option value="">All</option>
      {sortedUniqueValues.map(val => (
        <option key={val} value={val}>{val}</option>
      ))}
    </select>
  )
}
