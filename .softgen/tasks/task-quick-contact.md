---
title: Quick Contact Outcome Feature
status: done
priority: high
type: feature
tags:
  - leads
  - follow-up
---

## Notes
The user wants a quick way to log contact outcomes (contacted, no answer, call later) and have this tag classify the lead visually.

## Checklist
- [x] Add `last_contact_outcome` column to `leads` table
- [ ] Create `QuickContactDialog` component with suggested outcome tags
- [ ] Add "Registar Contacto" action to `LeadCard` and `LeadDetailsDialog`
- [ ] Update `LeadCard` to display the `last_contact_outcome` badge visually
- [ ] Update `leadsService` to support updating `last_contact_date` and `last_contact_outcome`
- [ ] Regenerate supabase types to include the new column

## Acceptance
- User can click to log a contact on a lead.
- They can select tags like "Atendeu", "Não atendeu", "Ligar mais tarde".
- The outcome saves as an interaction, updates `last_contact_date`, and visually tags the lead.