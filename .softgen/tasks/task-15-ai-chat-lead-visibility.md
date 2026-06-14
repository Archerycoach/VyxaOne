---
title: AI chat lead visibility
status: in_progress
priority: urgent
type: bug
tags: [ai, chat, leads, database]
created_by: agent
created_at: 2026-06-14T17:08:20Z
position: 15
---
## Notes
The chat agent reports that no T1 leads exist even when the database contains matching leads. Investigate the exact API route and frontend caller in use, verify which ownership and status filters are applied, and fix the data path so the AI receives matching leads with property preferences and contact details.

## Checklist
- [x] Inspect the chat page and API route used by the real-time AI conversation
- [x] Verify the live leads query against the database schema and sample T1 records
- [x] Fix the filtering or context-building logic so T1 leads are included
- [ ] Validate the AI path with a clean error check

## Acceptance
When asking for T1 leads in the AI chat, the assistant returns existing matching leads instead of saying none exist.