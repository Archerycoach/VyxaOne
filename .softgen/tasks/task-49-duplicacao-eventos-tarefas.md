---
title: Correção de Duplicação de Eventos e Tarefas
status: done
priority: high
type: bug
tags: [automation, cron, duplication]
created_by: agent
created_at: 2026-06-23T10:50:00Z
position: 49
---

## Notes
- O utilizador reportou que eventos e tarefas criados automaticamente estão a ser gerados em duplicado (às vezes 4x).
- A causa raiz provável é a falta de mecanismos de idempotência/deduplicação ao inserir as tarefas/eventos automáticos ou repetições de crons/webhooks.

## Checklist
- [x] Analisar a função `workflow-automation/index.ts` e implementar `ON CONFLICT` ou uma verificação antes do `INSERT`.
- [x] Implementar deduplicação em `workflowService.ts`
- [x] Atualizar consultas para usar `.maybeSingle()` em vez de `.single()` para evitar falhas em concorrência