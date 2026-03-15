import { FILTER_KEYS, getAllKeys } from './filterRegistry'

// Matches key:value, key:"value with spaces", and key: (no value yet)
const TOKEN_PATTERN = /(\w+):(?:"([^"]*)"?|(\S*))?/g

// Pre-build a set of known keys for fast lookup
const knownKeysLower = new Set(getAllKeys())

export default function parseSearchInput(input) {
  const filters = []
  const consumed = []

  let match
  while ((match = TOKEN_PATTERN.exec(input)) !== null) {
    const rawKey = match[1].toLowerCase()
    const def = FILTER_KEYS[rawKey]
    if (!def) continue

    // Always consume recognized key tokens from free text (even without a value)
    consumed.push({ start: match.index, end: match.index + match[0].length })

    const value = match[2] ?? match[3]
    if (!value) continue // key: with no value — strip from free text but don't create filter

    // Last value wins for non-array types; array types accumulate
    const existing = filters.findIndex(f => f.key === rawKey)
    if (existing !== -1 && def.type !== 'array') filters.splice(existing, 1)

    if (def.type === 'number') {
      const numMatch = value.match(/^(>=|<=|>|<|=)?(.+)$/)
      if (!numMatch || isNaN(parseFloat(numMatch[2]))) continue
      filters.push({ key: rawKey, field: def.field, value: numMatch[2], operator: numMatch[1] || '=' })
    } else {
      filters.push({ key: rawKey, field: def.field, value })
    }
  }

  // Also strip standalone words that are partial matches of known filter keys
  // e.g. typing "coun" shouldn't fuzzy-search for "coun"
  const partialPattern = /(?:^|\s)(\w+)(?=\s|$)/g
  let pm
  while ((pm = partialPattern.exec(input)) !== null) {
    const word = pm[1].toLowerCase()
    // If this word is a prefix of any known key AND not already consumed
    const isPartialKey = word.length >= 2 && [...knownKeysLower].some(k => k.startsWith(word) && k !== word)
    if (isPartialKey) {
      const start = pm.index + (pm[0].length - pm[1].length)
      const alreadyConsumed = consumed.some(c => start >= c.start && start < c.end)
      if (!alreadyConsumed) {
        consumed.push({ start, end: start + pm[1].length })
      }
    }
  }

  // Build free text by removing all consumed ranges
  consumed.sort((a, b) => b.start - a.start) // reverse order to splice safely
  let freeText = input
  for (const { start, end } of consumed) {
    freeText = freeText.slice(0, start) + freeText.slice(end)
  }
  freeText = freeText.replace(/\s+/g, ' ').trim()

  return { filters, freeText }
}
