---
title: Agenda duplication fix
status: in_progress
priority: urgent
type: bug
tags:
  - calendar
  - ai
  - google-calendar
created_by: agent
created_at: 2026-05-05
position: 7
---

## Notes
O agente IA está a criar o mesmo evento múltiplas vezes na aplicação antes da sincronização com o Google Calendar. O objetivo é validar os eventos já existentes no calendário e criar apenas um evento por lead quando o título/data-hora já coincidirem, evitando duplicação local e sincronização duplicada para o Google.

## Checklist
- [ ] Rever os endpoints que criam eventos IA em `src/pages/api/cron/gpt-assistant.ts`, `src/pages/api/gpt/manual-run.ts` e `src/pages/api/gpt/calendar/events.ts`
- [ ] Validar no calendário local se já existe um evento equivalente para o mesmo lead e horário antes de inserir
- [ ] Tornar a lógica de inserção idempotente para evitar múltiplas execuções do mesmo evento
- [ ] Garantir que os eventos duplicados não voltam a ser enviados para o Google Calendar
- [ ] Validar com verificação de erros e atualizar a task como concluída

## Acceptance
Ao executar o agente IA, cada lead gera no máximo um evento equivalente no calendário local.
A sincronização com o Google Calendar não cria cópias repetidas dos mesmos eventos.