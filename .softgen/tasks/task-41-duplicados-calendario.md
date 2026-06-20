---
title: Correção de duplicados no calendário
status: in_progress
priority: high
type: bug
tags: [calendario, tarefas, eventos, deduplicacao]
created_by: agent
created_at: 2026-06-20T11:38:44Z
position: 41
---
## Notes
O utilizador reportou que tarefas e eventos continuam a ser criados em duplicado no calendário. É necessário confirmar em que fluxo os registos são criados, onde já existe lógica de deduplicação e em que ponto ela falha. A correção deve impedir duplicados sem bloquear criações legítimas.

## Checklist
- [ ] Localizar os fluxos que criam tarefas e eventos no calendário
- [ ] Confirmar que identificadores e regras de deduplicação existem hoje
- [ ] Identificar a causa dos duplicados entre criação interna e sincronização
- [ ] Corrigir a deduplicação para tarefas e eventos
- [ ] Validar tecnicamente a correção sem regressões

## Acceptance
Tarefas e eventos deixam de ser criados em duplicado no calendário.
A criação legítima de novos registos continua a funcionar normalmente.