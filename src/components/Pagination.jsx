export default function Pagination({ table }) {
  const pageIndex = table.getState().pagination.pageIndex
  const pageCount = table.getPageCount()

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
      <p className="text-text-secondary">
        Showing{' '}
        <span className="font-medium text-text">
          {(pageIndex * table.getState().pagination.pageSize + 1).toLocaleString()}
        </span>
        {' '}&ndash;{' '}
        <span className="font-medium text-text">
          {Math.min(
            (pageIndex + 1) * table.getState().pagination.pageSize,
            table.getFilteredRowModel().rows.length
          ).toLocaleString()}
        </span>
        {' '}of{' '}
        <span className="font-medium text-text">
          {table.getFilteredRowModel().rows.length.toLocaleString()}
        </span>
        {' '}journals
      </p>

      <div className="flex items-center gap-1">
        <NavButton onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7"/></svg>
        </NavButton>
        <NavButton onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
        </NavButton>

        <span className="px-3 py-1.5 text-sm text-text-secondary">
          Page <span className="font-medium text-text">{pageIndex + 1}</span> of{' '}
          <span className="font-medium text-text">{pageCount}</span>
        </span>

        <NavButton onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
        </NavButton>
        <NavButton onClick={() => table.setPageIndex(pageCount - 1)} disabled={!table.getCanNextPage()}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7"/></svg>
        </NavButton>

        <select
          value={table.getState().pagination.pageSize}
          onChange={e => table.setPageSize(Number(e.target.value))}
          className="ml-2 px-2 py-1.5 bg-surface border border-border rounded-md text-sm text-text-secondary focus:outline-none focus:ring-1 focus:ring-primary-400"
        >
          {[25, 50, 100].map(size => (
            <option key={size} value={size}>Show {size}</option>
          ))}
        </select>
      </div>
    </div>
  )
}

function NavButton({ onClick, disabled, children }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="p-1.5 rounded-md border border-border text-text-secondary hover:bg-surface-hover hover:text-text disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
    >
      {children}
    </button>
  )
}
