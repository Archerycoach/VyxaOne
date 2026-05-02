---
title: Write Endpoints for GPT (Tasks, Notes, Follow-ups)
status: done
priority: high
type: feature
tags:
  - api
  - tasks
  - notes
  - gpt
created_by: agent
---

## Notes
Develop the restricted write endpoints for the GPT. The agent cannot delete leads or change critical states without confirmation.

## Checklist
- [ ] Create `POST /api/gpt/leads/[id]/tasks` to create a follow-up task.
- [ ] Create `POST /api/gpt/leads/[id]/notes` to add a justification/history note.
- [ ] Create `PATCH /api/gpt/leads/[id]/followup` to update only the `next_followup_date` (or equivalent) field.
- [ ] Ensure all actions are logged.