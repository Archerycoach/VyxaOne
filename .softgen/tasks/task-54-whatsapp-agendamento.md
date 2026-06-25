---
title: Agendamento IA via WhatsApp (Leads Quentes)
status: todo
priority: high
type: feature
tags: [ai, whatsapp, calendar]
created_by: agent
created_at: 2026-06-25T07:57:59Z
position: 54
---

## Notes:
Permitir ao Agente IA consultar a disponibilidade do calendário do consultor e sugerir slots de reunião para leads qualificadas como "Quentes".

## Checklist:
- [ ] Criar a "tool" `check_calendar_availability` para o Agente IA ler slots livres dos próximos dias
- [ ] Criar a "tool" `book_meeting` para o Agente IA marcar efetivamente a reunião na agenda
- [ ] Afinar o prompt do Agente IA para APENAS propor reuniões se a temperatura da lead for "Quente"
- [ ] Tratar fusos horários e confirmações por WhatsApp

## Acceptance:
O Agente consegue consultar dias livres, propor duas ou três opções de horas à lead, e ao receber a escolha, criar o evento no Google Calendar.