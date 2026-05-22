---
title: "Notion Integration - Auth & Settings"
status: "todo"
priority: "high"
type: "feature"
tags: ["notion", "integrations", "oauth"]
created_by: "agent"
created_at: "2026-05-22"
position: 1
---

## Notes
Set up the fundamental Notion OAuth connection so users can link their Notion workspaces. This handles Step 1 and 2 of the Notion Integration architecture.

## Checklist
- [x] Create `notion_integrations` and `notion_mappings` tables in the database with RLS.
- [x] Create API route `/api/notion/auth.ts` to redirect to Notion authorization URL.
- [x] Create API route `/api/notion/callback.ts` to exchange the code for access token and save it to the DB.
- [ ] Create API route `/api/notion/databases.ts` to fetch available databases from Notion.
- [x] Build `NotionAccountConnection.tsx` component to manage the integration state.
- [x] Add the Notion settings component to the main `settings.tsx` Integrations tab.

## Acceptance
- User can click "Connect to Notion" in Settings.
- User is redirected to Notion, grants access, and returns to Vyxa.
- The Notion connection shows as "Connected" with the workspace name.
- User can see a list of their Notion databases to map to Vyxa entities.