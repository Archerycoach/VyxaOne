---
title: "Notion Integration - Sync & Triggers"
status: "todo"
priority: "high"
type: "feature"
tags: ["notion", "sync", "webhooks", "leads"]
created_by: "agent"
created_at: "2026-05-22"
position: 2
---

## Notes
Implement the background synchronization between Vyxa and the mapped Notion databases. Will start with Lead syncing (Dossier do Cliente).

## Checklist
- [x] Create `notionService.ts` to handle generic Notion API requests (Create Page, Update Page).
- [x] Create `/api/notion/sync.ts` (or integrate directly into services) to push data to Notion.
- [x] Implement Lead Creation Trigger: When a new Lead is created (manual or meta), create a page in the mapped Notion database.
- [x] Implement Pipeline Trigger: When lead status changes, update the Notion page status property.
- [x] Ensure formatting handles Notion's rich text blocks cleanly.

## Acceptance
- Creating a lead in Vyxa automatically generates a corresponding page in the mapped Notion DB.
- Changing lead pipeline status in Vyxa reflects in the Notion database.