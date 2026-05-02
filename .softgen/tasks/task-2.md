---
title: Read Endpoints for GPT (Pending Follow-ups & Details)
status: done
priority: high
type: feature
tags:
  - api
  - leads
  - gpt
created_by: agent
---

## Notes
Develop the GET endpoints for the GPT to read leads data without exposing sensitive internal unneeded data.

## Checklist
- [ ] Create `GET /api/gpt/leads/pending` to list leads needing follow-up (new, untouched for X days, overdue next action).
- [ ] Create `GET /api/gpt/leads/[id]` to return detailed lead info (name, phone, email, origin, interest, dates, status, notes, history).
- [ ] Ensure both endpoints use the GPT API authentication middleware.