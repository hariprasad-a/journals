import { Fragment, useState, useMemo } from 'react'
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
import GlobalFilter from './GlobalFilter'
import Pagination from './Pagination'

const globalSearchFilter = (row, columnId, value) => {
  if (!value) return true
  const search = value.toLowerCase()
  const title = String(row.getValue('Title') || '').toLowerCase()
  if (title.includes(search)) return true
  const publisher = String(row.original.Publisher || '').toLowerCase()
  if (publisher.includes(search)) return true
  const issnSearch = search.replace(/^issn\s*/i, '').replace(/[-\s]/g, '')
  if (issnSearch) {
    const issn = (row.original.issn || '').replace(/[-\s]/g, '').toLowerCase()
    if (issn && issn.includes(issnSearch)) return true
    const issnOnline = (row.original.issn_online || '').replace(/[-\s]/g, '').toLowerCase()
    if (issnOnline && issnOnline.includes(issnSearch)) return true
  }
  return false
}

function SortIcon({ isSorted }) {
  if (isSorted === 'asc') {
    return <svg className="w-3.5 h-3.5 text-primary-600 dark:text-primary-400 flex-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7"/></svg>
  }
  if (isSorted === 'desc') {
    return <svg className="w-3.5 h-3.5 text-primary-600 dark:text-primary-400 flex-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
  }
  // Default: muted bi-directional arrow, always visible
  return (
    <svg className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 flex-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5 5 5M7 13l5 5 5-5"/>
    </svg>
  )
}

function MobileSortBar({ table, columns }) {
  const sortableColumns = useMemo(
    () => columns.filter(c => !c.meta?.filterOnly && c.accessorKey !== 'subject_area'),
    [columns]
  )
  const sorting = table.getState().sorting
  const currentSort = sorting[0] || null

  const handleChange = (e) => {
    const val = e.target.value
    if (!val) {
      table.setSorting([])
      return
    }
    const [id, dir] = val.split(':')
    table.setSorting([{ id, desc: dir === 'desc' }])
  }

  const currentValue = currentSort ? `${currentSort.id}:${currentSort.desc ? 'desc' : 'asc'}` : ''

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-surface border-b border-border-light">
      <svg className="w-4 h-4 text-text-muted flex-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12"/>
      </svg>
      <select
        value={currentValue}
        onChange={handleChange}
        className="flex-1 text-xs bg-transparent text-text border-none focus:ring-0 p-0 cursor-pointer"
      >
        <option value="">Sort by...</option>
        {sortableColumns.map(col => (
          <Fragment key={col.accessorKey}>
            <option value={`${col.accessorKey}:asc`}>{col.header} (Low to High)</option>
            <option value={`${col.accessorKey}:desc`}>{col.header} (High to Low)</option>
          </Fragment>
        ))}
      </select>
    </div>
  )
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
        <div className="flex items-start gap-2 overflow-hidden">
          <div className="min-w-0 flex-1">
            <div className="font-medium text-text leading-snug">{d.Title}</div>
            <div className="text-xs text-text-muted mt-0.5">
              {d.Publisher}
              {d.issn && <><span className="mx-1.5 text-border">|</span><span className="font-mono opacity-70">ISSN {d.issn}</span></>}
            </div>
          </div>
          {d.homepage_url && (
            <a href={d.homepage_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="flex-none mt-0.5 inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-primary-600 bg-primary-50 ring-1 ring-inset ring-primary-200 hover:bg-primary-100 hover:text-primary-700 dark:text-primary-300 dark:bg-primary-500/20 dark:ring-primary-400/30 dark:hover:bg-primary-500/30 dark:hover:text-primary-200 transition-colors" title="Visit journal homepage">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Visit
            </a>
          )}
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
        {/* Subject */}
        {Array.isArray(d.subject_area) && d.subject_area.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {d.subject_area.map(s => (
              <span key={s} className="inline-block px-1.5 py-0.5 text-xs rounded bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {s}
              </span>
            ))}
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
    globalFilterFn: globalSearchFilter,
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
        <div className="sticky top-0 z-10 rounded-t-xl overflow-visible">
          <table className="w-full" style={{ tableLayout: 'fixed' }}>
            <colgroup>
              {table.getVisibleLeafColumns().map(col => (
                <col key={col.id} style={{ width: col.getSize() }} />
              ))}
            </colgroup>
            <thead>
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id} className="border-b border-border">
                  {headerGroup.headers.map(header => {
                    const sorted = header.column.getIsSorted()
                    return (
                      <th
                        key={header.id}
                        className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider first:rounded-tl-xl last:rounded-tr-xl transition-colors ${sorted ? 'bg-primary-50/60 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300' : 'bg-surface-alt text-text-secondary'}`}
                      >
                        {header.isPlaceholder ? null : (
                          <div>
                            <div
                              className={`flex items-center gap-1 ${header.column.getCanSort() ? 'cursor-pointer select-none group' : ''}`}
                              onClick={header.column.getToggleSortingHandler()}
                              title={header.column.getCanSort() ? 'Click to sort' : undefined}
                            >
                              {flexRender(header.column.columnDef.header, header.getContext())}
                              {header.column.getCanSort() && (
                                <span className={sorted ? '' : 'transition-opacity'}>
                                  <SortIcon isSorted={sorted} />
                                </span>
                              )}
                            </div>
                            {header.column.getCanFilter() && header.column.columnDef.Filter && (
                              <header.column.columnDef.Filter column={header.column} />
                            )}
                          </div>
                        )}
                      </th>
                    )
                  })}
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
        <MobileSortBar table={table} columns={visibleColumns} />
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
