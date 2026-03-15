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

function MobileCard({ row, columns: visibleColumns, isExpanded, onToggle, renderExpandedRow }) {
  const d = row.original
  return (
    <div
      className={`border-b border-border-light transition-colors cursor-pointer ${isExpanded ? 'bg-surface-alt/70' : 'bg-surface hover:bg-surface-hover'}`}
      onClick={onToggle}
    >
      <div className="px-4 py-3 space-y-2">
        {/* Title + Publisher */}
        <div className="overflow-hidden">
          <div className="font-medium text-text leading-snug">
            {d.homepage_url ? (
              <a href={d.homepage_url} target="_blank" rel="noopener noreferrer" className="hover:text-primary-500 hover:underline transition-colors" onClick={e => e.stopPropagation()}>
                {d.Title}
              </a>
            ) : d.Title}
          </div>
          <div className="text-xs text-text-muted mt-0.5">
            {d.Publisher}
            {d.issn && <><span className="mx-1.5 text-border">|</span><span className="font-mono opacity-70">ISSN {d.issn}</span></>}
          </div>
        </div>
        {/* Badges row */}
        <div className="flex flex-wrap items-center gap-3">
          {visibleColumns.filter(c => c.accessorKey !== 'Title' && c.accessorKey !== 'subject_area').map(col => (
            <div key={col.accessorKey} className="flex items-center gap-1.5 text-xs">
              <span className="text-text-muted">{col.header}:</span>
              <span className="font-medium text-text">
                {flexRender(col.cell, {
                  getValue: () => d[col.accessorKey],
                  row,
                  column: { id: col.accessorKey, columnDef: col },
                  renderValue: () => d[col.accessorKey],
                })}
              </span>
            </div>
          ))}
        </div>
        {/* Subject + ISSN */}
        {(d.subject_area || d.issn) && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 text-xs text-text-secondary">
            {d.subject_area && <span>{d.subject_area}</span>}
            {d.issn && <span className="font-mono">{d.issn}</span>}
          </div>
        )}
      </div>
      {isExpanded && renderExpandedRow && (
        <div className="border-t border-border-light">
          {renderExpandedRow(row)}
        </div>
      )}
    </div>
  )
}

export default function JournalTable({ data, columns, renderExpandedRow }) {
  const [sorting, setSorting] = useState([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [columnFilters, setColumnFilters] = useState([])
  const [expandedRows, setExpandedRows] = useState({})

  const hiddenCols = columns.filter(c => c.meta?.hidden).map(c => c.accessorKey)
  const visibleColumns = columns.filter(c => !c.meta?.hidden)

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting, globalFilter, columnFilters,
      columnVisibility: Object.fromEntries(hiddenCols.map(id => [id, false])),
    },
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

  const toggleRow = (id) => setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }))

  return (
    <div className="space-y-4">
      <GlobalFilter
        value={globalFilter}
        onChange={setGlobalFilter}
        totalCount={table.getPreFilteredRowModel().rows.length}
        filteredCount={table.getFilteredRowModel().rows.length}
        columns={columns}
        columnFilters={columnFilters}
        onColumnFiltersChange={setColumnFilters}
        table={table}
      />

      {/* Desktop table */}
      <div className="hidden md:block bg-surface rounded-xl border border-border shadow-sm">
        {/* Sticky header table */}
        <div className="sticky top-0 z-10 rounded-t-xl overflow-hidden">
          <table className="w-full" style={{ tableLayout: 'fixed' }}>
            <colgroup>
              {table.getVisibleLeafColumns().map(col => (
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
            {table.getVisibleLeafColumns().map(col => (
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
                    onClick={() => toggleRow(row.id)}
                  >
                    {row.getVisibleCells().map(cell => (
                      <td key={cell.id} className="px-4 py-3">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                  {isExpanded && renderExpandedRow && (
                    <tr key={`${row.id}-detail`} className="border-b border-border-light">
                      <td colSpan={visibleColumns.length} className="bg-surface-alt/70">
                        {renderExpandedRow(row)}
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
            {table.getRowModel().rows.length === 0 && (
              <tr>
                <td colSpan={visibleColumns.length} className="px-4 py-12 text-center text-text-muted">
                  No journals found matching your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile card list */}
      <div className="md:hidden bg-surface rounded-xl border border-border shadow-sm divide-y divide-border-light">
        {table.getRowModel().rows.map(row => (
          <MobileCard
            key={row.id}
            row={row}
            columns={visibleColumns}
            isExpanded={expandedRows[row.id]}
            onToggle={() => toggleRow(row.id)}
            renderExpandedRow={renderExpandedRow}
          />
        ))}
        {table.getRowModel().rows.length === 0 && (
          <div className="px-4 py-12 text-center text-text-muted">
            No journals found matching your search.
          </div>
        )}
      </div>

      <Pagination table={table} />
    </div>
  )
}
