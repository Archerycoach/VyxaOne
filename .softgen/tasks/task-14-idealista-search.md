---
title: Idealista Search Page
status: done
priority: high
type: feature
tags: [idealista, search]
created_by: softgen
created_at: 2026-06-05
position: 14
---
## Notes
- The user needs a dedicated page to search Idealista properties.
- Added navigation item.
- Fixed the API key storage table.
- Fixed auth context in Next.js API routes for Idealista calls.

## Checklist
- [x] Create user_settings table in Supabase
- [x] Fix settings.tsx to properly catch and throw errors
- [x] Refactor idealistaService to accept userId explicitly (fixing API route auth loss)
- [x] Update /api/idealista/search-for-lead.ts to use the fixed service
- [x] Create /api/idealista/search.ts generic endpoint
- [x] Create src/pages/idealista.tsx full page UI
- [x] Add "Idealista" to src/components/Navigation.tsx