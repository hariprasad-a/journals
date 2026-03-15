export default function FilterChip({ label, value, onRemove, onClick }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-md bg-primary-100 text-primary-700 ring-1 ring-inset ring-primary-500/20 dark:bg-primary-900/40 dark:text-primary-300 dark:ring-primary-400/20 whitespace-nowrap">
      <span
        className={onClick ? 'cursor-pointer hover:underline' : undefined}
        onClick={onClick ? (e) => { e.stopPropagation(); onClick() } : undefined}
      >
        <span className="text-primary-500 dark:text-primary-400">{label}:</span>
        {' '}{value}
      </span>
      <button
        type="button"
        onClick={e => { e.stopPropagation(); onRemove() }}
        className="ml-0.5 hover:text-primary-900 dark:hover:text-primary-100 transition-colors"
        aria-label={`Remove ${label} filter`}
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </span>
  )
}
