import { Fragment, useState } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  flexRender,
} from '@tanstack/react-table'
import { rankItem } from '@tanstack/match-sorter-utils'
import GlobalFilter from './GlobalFilter'
import Pagination from './Pagination'

const fuzzyFilter = (row, columnId, value, addMeta) => {
  if (!value) return true
  const itemRank = rankItem(row.getValue(columnId), value)
  addMeta({ itemRank })
  return itemRank.passed
}

export default function JournalTable({ data, columns, renderExpandedRow }) {
  const [sorting, setSorting] = useState([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [columnFilters, setColumnFilters] = useState([])
  const [expandedRows, setExpandedRows] = useState({})

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter, columnFilters },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    globalFilterFn: fuzzyFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    initialState: { pagination: { pageSize: 25 } },
  })

  return (
    <div className="space-y-4">
      <GlobalFilter
        value={globalFilter}
        onChange={setGlobalFilter}
        totalCount={table.getPreFilteredRowModel().rows.length}
        filteredCount={table.getFilteredRowModel().rows.length}
      />

      <div className="bg-surface rounded-xl border border-border shadow-sm">
        {/* Sticky header table */}
        <div className="sticky top-0 z-10 rounded-t-xl overflow-hidden">
          <table className="w-full" style={{ tableLayout: 'fixed' }}>
            <colgroup>
              {table.getAllColumns().map(col => (
                <col key={col.id} style={{ width: col.getSize() }} />
              ))}
            </colgroup>
            <thead>
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id} className="border-b border-border">
                  {headerGroup.headers.map(header => (
                    <th
                      key={header.id}
                      className="bg-surface-alt px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider"
                    >
                      {header.isPlaceholder ? null : (
                        <div>
                          <div
                            className={`flex items-center gap-1 ${header.column.getCanSort() ? 'cursor-pointer select-none hover:text-text' : ''}`}
                            onClick={header.column.getToggleSortingHandler()}
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {header.column.getIsSorted() === 'asc' && (
                              <svg className="w-3.5 h-3.5 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7"/></svg>
                            )}
                            {header.column.getIsSorted() === 'desc' && (
                              <svg className="w-3.5 h-3.5 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
                            )}
                          </div>
                          {header.column.getCanFilter() && header.column.columnDef.Filter && (
                            <header.column.columnDef.Filter column={header.column} />
                          )}
                        </div>
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
          </table>
        </div>

        {/* Scrollable body table */}
        <table className="w-full" style={{ tableLayout: 'fixed' }}>
          <colgroup>
            {table.getAllColumns().map(col => (
              <col key={col.id} style={{ width: col.getSize() }} />
            ))}
          </colgroup>
          <tbody>
            {table.getRowModel().rows.map((row, i) => {
              const isExpanded = expandedRows[row.id]
              return (
                <Fragment key={row.id}>
                  <tr
                    className={`border-b border-border-light transition-colors hover:bg-surface-hover cursor-pointer ${i % 2 === 0 ? 'bg-surface' : 'bg-surface-alt/50'}`}
                    onClick={() => setExpandedRows(prev => ({ ...prev, [row.id]: !prev[row.id] }))}
                  >
                    {row.getVisibleCells().map(cell => (
                      <td key={cell.id} className="px-4 py-3">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                  {isExpanded && renderExpandedRow && (
                    <tr key={`${row.id}-detail`} className="border-b border-border-light">
                      <td colSpan={columns.length} className="bg-surface-alt/70">
                        {renderExpandedRow(row)}
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
            {table.getRowModel().rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center text-text-muted">
                  No journals found matching your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination table={table} />
    </div>
  )
}
