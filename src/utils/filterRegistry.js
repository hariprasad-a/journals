export const FILTER_KEYS = {
  ranking:   { field: 'ABDC ranking', type: 'enum', values: ['A*', 'A', 'B', 'C'], label: 'Ranking' },
  scopus:    { field: 'scopus',       type: 'enum', values: ['True', 'False'], label: 'Scopus' },
  country:   { field: 'country',      type: 'text', label: 'Country' },
  quartile:  { field: 'sjr_quartile', type: 'enum', values: ['Q1', 'Q2', 'Q3', 'Q4'], label: 'Quartile' },
  type:      { field: 'type',         type: 'text', label: 'Type' },
  language:  { field: 'language',     type: 'text', label: 'Language' },
  oa:        { field: 'is_oa',        type: 'enum', values: ['true', 'false'], label: 'Open Access' },
  publisher: { field: 'Publisher',    type: 'text', label: 'Publisher' },
  subject:   { field: 'subject_area', type: 'array', label: 'Subject' },
  hindex:     { field: 'h_index',             type: 'number', label: 'H-Index' },
  percentile: { field: 'highest_percentile',  type: 'number', label: 'Percentile' },
  citescore:  { field: 'citescore',           type: 'number', label: 'CiteScore' },
}

const fieldToKey = Object.fromEntries(
  Object.entries(FILTER_KEYS).map(([key, def]) => [def.field, key])
)

export function getKeyByField(field) {
  return fieldToKey[field] ?? null
}

export function getLabelByField(field) {
  const key = fieldToKey[field]
  return key ? FILTER_KEYS[key].label : field
}

export function getAllKeys() {
  return Object.keys(FILTER_KEYS)
}
