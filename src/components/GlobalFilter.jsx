import { useState, useEffect, useRef, useCallback } from 'react'
import parseSearchInput from '../utils/parseSearchInput'
import { FILTER_KEYS, getKeyByField, getLabelByField } from '../utils/filterRegistry'
import FilterChip from './FilterChip'
import FilterSuggestions, { getSuggestions } from './FilterSuggestions'

export default function GlobalFilter({ value, onChange, totalCount, filteredCount, table, columnFilters, onColumnFiltersChange }) {
  const [localInput, setLocalInput] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [cursorPos, setCursorPos] = useState(0)
  const inputRef = useRef(null)
  const suggestionsRef = useRef({ items: [], mode: 'key', token: '' })

  // Track which fields were set via search bar text (not dropdowns)
  const textFieldsRef = useRef(new Set())

  // Track whether the global filter change was triggered by our own debounced effect
  const internalChangeRef = useRef(false)

  // Sync local input from external global filter changes (e.g. clear)
  useEffect(() => {
    if (internalChangeRef.current) {
      internalChangeRef.current = false
      return
    }
    if (!value && localInput) {
      // External clear
      setLocalInput('')
      textFieldsRef.current.clear()
    }
  }, [value])

  // Parse input and apply filters (debounced)
  useEffect(() => {
    const timeout = setTimeout(() => {
      const { filters, freeText } = parseSearchInput(localInput)

      // Update global filter (free text portion)
      internalChangeRef.current = true
      onChange(freeText)

      // Build new column filters: keep dropdown-set filters, replace text-set filters
      const newTextFields = new Set(filters.map(f => f.field))
      const dropdownFilters = columnFilters.filter(cf => {
        // Keep if it was NOT set by text input and not being newly parsed
        return !textFieldsRef.current.has(cf.id) && !newTextFields.has(cf.id)
      })

      // Collect committed array values before they get excluded by newTextFields
      const committedArrayValues = {}
      for (const cf of columnFilters) {
        if (textFieldsRef.current.has(cf.id)) continue // was text-set, stale
        const key = getKeyByField(cf.id)
        if (key && FILTER_KEYS[key]?.type === 'array' && Array.isArray(cf.value) && newTextFields.has(cf.id)) {
          committedArrayValues[cf.id] = cf.value
        }
      }

      // For text-type filters, require at least 2 chars before applying
      // Merge array-type filters and accumulate values
      const parsedFilters = filters
        .filter(f => {
          const def = FILTER_KEYS[f.key]
          if (def?.type === 'text' && f.value.length < 2) return false
          return true
        })
        .reduce((acc, f) => {
          const def = FILTER_KEYS[f.key]
          const existingIdx = acc.findIndex(a => a.id === f.field)

          if (def?.type === 'number') {
            const val = { operator: f.operator || '=', value: f.value }
            if (existingIdx !== -1) acc[existingIdx].value = val
            else acc.push({ id: f.field, value: val })
          } else if (def?.type === 'array') {
            // Start with committed chip values, then accumulate text-parsed values
            if (existingIdx !== -1) {
              if (!acc[existingIdx].value.includes(f.value)) {
                acc[existingIdx].value = [...acc[existingIdx].value, f.value]
              }
            } else {
              const base = committedArrayValues[f.field] || []
              acc.push({ id: f.field, value: base.includes(f.value) ? [...base] : [...base, f.value] })
            }
          } else {
            if (existingIdx !== -1) acc[existingIdx].value = f.value
            else acc.push({ id: f.field, value: f.value })
          }
          return acc
        }, [])

      const merged = [...dropdownFilters, ...parsedFilters]
      textFieldsRef.current = newTextFields

      onColumnFiltersChange(merged)
    }, 400)
    return () => clearTimeout(timeout)
  }, [localInput])

  // Compute suggestions from pre-debounce input
  const suggestions = getSuggestions(localInput, cursorPos, table)
  suggestionsRef.current = suggestions

  const handleInputChange = (e) => {
    setLocalInput(e.target.value)
    setCursorPos(e.target.selectionStart)
    setShowSuggestions(true)
    setSelectedIndex(0)
  }

  const handleSelect = useCallback((e) => {
    setCursorPos(e.target.selectionStart)
  }, [])

  // Immediately parse input, apply filters to columnFilters, return freeText
  // Used for auto-commit (Enter, value suggestion select)
  const commitFiltersFromInput = useCallback((inputText) => {
    const { filters, freeText } = parseSearchInput(inputText)
    if (filters.length === 0) return { committed: false, freeText: inputText }

    // Build updated column filters
    // Start with all existing filters not being committed
    const committingFields = new Set(filters.map(f => f.field))
    let updated = columnFilters.filter(cf => {
      if (committingFields.has(cf.id)) {
        // For array types, keep — we'll merge below
        const key = getKeyByField(cf.id)
        return key && FILTER_KEYS[key]?.type === 'array'
      }
      return true
    })

    for (const f of filters) {
      const def = FILTER_KEYS[f.key]
      const existingIdx = updated.findIndex(cf => cf.id === f.field)

      if (def?.type === 'number') {
        const val = { operator: f.operator || '=', value: f.value }
        if (existingIdx !== -1) updated[existingIdx] = { id: f.field, value: val }
        else updated.push({ id: f.field, value: val })
      } else if (def?.type === 'array') {
        if (existingIdx !== -1 && Array.isArray(updated[existingIdx].value)) {
          if (!updated[existingIdx].value.includes(f.value)) {
            updated[existingIdx] = { id: f.field, value: [...updated[existingIdx].value, f.value] }
          }
        } else {
          updated.push({ id: f.field, value: [f.value] })
        }
      } else {
        if (existingIdx !== -1) updated[existingIdx] = { id: f.field, value: f.value }
        else updated.push({ id: f.field, value: f.value })
      }

      textFieldsRef.current.delete(f.field)
    }

    onColumnFiltersChange(updated)
    return { committed: true, freeText }
  }, [columnFilters, onColumnFiltersChange])

  const handleSuggestionSelect = useCallback((item) => {
    const token = suggestionsRef.current.token
    const before = localInput.slice(0, cursorPos - token.length)
    const after = localInput.slice(cursorPos)
    const suffix = item.mode === 'value' ? ' ' : ''
    const newInput = before + item.insert + suffix + after

    if (item.mode === 'value') {
      // Auto-commit: immediately apply filter and strip from input
      const { freeText } = commitFiltersFromInput(newInput)
      setLocalInput(freeText)
      setCursorPos(freeText.length)
      setShowSuggestions(false)
      setSelectedIndex(0)

      requestAnimationFrame(() => {
        if (inputRef.current) {
          inputRef.current.focus()
          inputRef.current.setSelectionRange(freeText.length, freeText.length)
        }
      })
    } else {
      // Key or operator selection: keep typing
      setLocalInput(newInput)
      setShowSuggestions(true)
      setSelectedIndex(0)

      requestAnimationFrame(() => {
        if (inputRef.current) {
          const newPos = before.length + item.insert.length + suffix.length
          inputRef.current.focus()
          inputRef.current.setSelectionRange(newPos, newPos)
          setCursorPos(newPos)
        }
      })
    }
  }, [localInput, cursorPos, commitFiltersFromInput])

  // Commit typed filters: convert text to chips (Enter key)
  const handleCommit = useCallback(() => {
    const { committed, freeText } = commitFiltersFromInput(localInput)
    if (!committed) {
      setShowSuggestions(false)
      return
    }

    setLocalInput(freeText)
    setCursorPos(freeText.length)
    setShowSuggestions(false)

    requestAnimationFrame(() => {
      if (inputRef.current) {
        inputRef.current.focus()
        inputRef.current.setSelectionRange(freeText.length, freeText.length)
      }
    })
  }, [localInput, commitFiltersFromInput])

  // Click a chip to convert it back to editable text
  const handleChipEdit = useCallback((field, specificArrayValue) => {
    const key = getKeyByField(field)
    if (!key) return

    const cf = columnFilters.find(c => c.id === field)
    if (!cf) return

    const def = FILTER_KEYS[key]
    let filterText
    if (def?.type === 'number' && typeof cf.value === 'object') {
      const op = cf.value.operator === '=' ? '' : cf.value.operator
      filterText = `${key}:${op}${cf.value.value}`
    } else if (Array.isArray(cf.value) && specificArrayValue != null) {
      filterText = specificArrayValue.includes(' ') ? `${key}:"${specificArrayValue}"` : `${key}:${specificArrayValue}`
    } else if (Array.isArray(cf.value)) {
      filterText = cf.value.map(v => v.includes(' ') ? `${key}:"${v}"` : `${key}:${v}`).join(' ')
    } else {
      const v = String(cf.value)
      filterText = v.includes(' ') ? `${key}:"${v}"` : `${key}:${v}`
    }

    // Remove from columnFilters (or just the specific array value)
    if (Array.isArray(cf.value) && specificArrayValue != null) {
      const next = cf.value.filter(v => v !== specificArrayValue)
      onColumnFiltersChange(
        next.length
          ? columnFilters.map(c => c.id === field ? { ...c, value: next } : c)
          : columnFilters.filter(c => c.id !== field)
      )
    } else {
      onColumnFiltersChange(columnFilters.filter(c => c.id !== field))
    }

    // Add filter text back into localInput
    const newInput = localInput ? `${localInput} ${filterText}` : filterText
    setLocalInput(newInput)
    textFieldsRef.current.add(field)

    requestAnimationFrame(() => {
      if (inputRef.current) {
        inputRef.current.focus()
        const pos = newInput.length
        inputRef.current.setSelectionRange(pos, pos)
        setCursorPos(pos)
      }
    })
  }, [columnFilters, localInput, onColumnFiltersChange])

  const handleChipRemove = useCallback((field) => {
    // Remove from column filters
    onColumnFiltersChange(columnFilters.filter(cf => cf.id !== field))
    textFieldsRef.current.delete(field)

    // Remove the key:value token from text input (in case it's still there)
    const key = getKeyByField(field)
    if (key) {
      const cleaned = localInput
        .replace(new RegExp(`${key}:"[^"]*"\\s*`, 'gi'), '')
        .replace(new RegExp(`${key}:\\S+\\s*`, 'gi'), '')
        .trim()
      setLocalInput(cleaned)
    }
  }, [columnFilters, localInput, onColumnFiltersChange])

  const handleArrayChipRemove = (field, valueToRemove) => {
    const existing = columnFilters.find(cf => cf.id === field)
    if (!existing || !Array.isArray(existing.value)) return
    const next = existing.value.filter(v => v !== valueToRemove)
    onColumnFiltersChange(
      next.length
        ? columnFilters.map(cf => cf.id === field ? { ...cf, value: next } : cf)
        : columnFilters.filter(cf => cf.id !== field)
    )
    textFieldsRef.current.delete(field)
  }

  const isFiltered = filteredCount < totalCount

  // Get columns with Filter components for mobile display
  const filterColumns = table
    ? table.getAllColumns().filter(c => c.getCanFilter() && c.columnDef.Filter)
    : []

  // Active chips: column filters that are NOT still being typed (not in textFieldsRef)
  const activeChips = []
  for (const cf of columnFilters) {
    if (cf.value == null || cf.value === '') continue
    if (textFieldsRef.current.has(cf.id)) continue // still in text input, not committed yet
    if (cf.value && typeof cf.value === 'object' && !Array.isArray(cf.value) && cf.value.operator != null) {
      const op = cf.value.operator === '=' ? '' : cf.value.operator + ' '
      activeChips.push({ id: cf.id, displayValue: op + cf.value.value })
    } else if (Array.isArray(cf.value)) {
      cf.value.forEach(v => activeChips.push({ id: cf.id, displayValue: v, isArrayItem: true, arrayValue: v }))
    } else {
      activeChips.push({ id: cf.id, displayValue: String(cf.value) })
    }
  }

  const handleKeyDown = (e) => {
    const { items } = suggestionsRef.current

    // Backspace on empty input: edit the last committed chip
    if (e.key === 'Backspace' && localInput === '' && activeChips.length > 0) {
      e.preventDefault()
      const lastChip = activeChips[activeChips.length - 1]
      if (lastChip.isArrayItem) {
        handleChipEdit(lastChip.id, lastChip.arrayValue)
      } else {
        handleChipEdit(lastChip.id)
      }
      return
    }

    // Enter with no active suggestions: commit typed filters to chips
    if (!showSuggestions || items.length === 0) {
      if (e.key === 'Enter') {
        e.preventDefault()
        handleCommit()
      }
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(i => (i + 1) % items.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(i => (i - 1 + items.length) % items.length)
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      if (items[selectedIndex]) {
        e.preventDefault()
        handleSuggestionSelect(items[selectedIndex])
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <div
            className="flex items-center flex-wrap gap-1.5 w-full min-h-[42px] pl-3 pr-4 py-1.5 bg-surface border border-border rounded-lg focus-within:ring-2 focus-within:ring-primary-500/20 focus-within:border-primary-400 transition-shadow cursor-text"
            onClick={() => inputRef.current?.focus()}
          >
            <svg className="w-4 h-4 text-text-muted flex-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            {activeChips.map(cf => (
              <FilterChip
                key={`${cf.id}-${cf.displayValue}`}
                label={getLabelByField(cf.id)}
                value={cf.displayValue}
                onRemove={() => cf.isArrayItem ? handleArrayChipRemove(cf.id, cf.arrayValue) : handleChipRemove(cf.id)}
                onClick={() => cf.isArrayItem ? handleChipEdit(cf.id, cf.arrayValue) : handleChipEdit(cf.id)}
              />
            ))}
            <input
              ref={inputRef}
              type="text"
              value={localInput}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              onClick={handleSelect}
              placeholder={activeChips.length > 0 ? 'Add more filters...' : `Search ${totalCount.toLocaleString()} journals... (try country:US or ranking:A*)`}
              className="flex-1 min-w-[120px] py-1 bg-transparent text-sm text-text placeholder-text-muted focus:outline-none"
            />
          </div>
          {isFiltered && !showSuggestions && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-muted">
              {filteredCount.toLocaleString()} results
            </span>
          )}
          {showSuggestions && (
            <FilterSuggestions
              items={suggestions.items}
              selectedIndex={selectedIndex}
              onSelect={handleSuggestionSelect}
            />
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
    </div>
  )
}
