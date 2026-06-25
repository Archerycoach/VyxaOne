---
title: WhatsApp Auto Template Trigger
status: done
priority: high
type: feature
tags: [whatsapp, automation, ai]
created_by: agent
created_at: 2026-06-25T10:30:00Z
position: 55
---

## Notes
Implement auto-trigger of WhatsApp template messages when a new lead is created. The Meta API requires a pre-approved template to initiate conversations. When the lead replies, the AI agent will take over via the webhook.

## Checklist
- [x] Add `template_name` field to WhatsApp global settings in Admin Integrations.
- [x] Create `sendWhatsAppTemplate` function in `whatsappService.ts`.
- [x] Update `leadsService.ts` to trigger `sendWhatsAppTemplate` upon new lead creation (if WA is globally active and the consultant has it enabled).
- [x] Ensure AI context knows about the initial template.

## Acceptance
- Admin can specify a template name.
- New leads automatically receive the template via the WhatsApp Cloud API.
- Replies trigger the webhook and AI responds.