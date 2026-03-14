# Journals

Academic journals directory with ABDC rankings and Scopus indexing status. Browse, search, filter, and sort ~39,400 journals.

Live at: https://hariprasad-a.github.io/journals

## Editing Data

Data is managed via a Google Sheet. To update:

1. Edit the Google Sheet (ask the maintainer for access)
2. Changes are automatically pulled on the 1st of each month
3. To trigger an immediate update: go to GitHub → Actions → "Update Journal Data" → Run workflow

## Local Development

```bash
nvm use           # Node 20
npm install
npm run dev       # Start dev server
npm run build     # Production build
npm run preview   # Preview production build
```

## Stack

- React 18 + Vite
- TanStack Table v8 (sorting, filtering, pagination)
- Tailwind CSS v4
- GitHub Actions (auto-deploy on push, monthly data refresh)
- OpenAlex API (journal metadata enrichment)
