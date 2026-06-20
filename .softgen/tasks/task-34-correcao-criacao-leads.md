---
title: Correção da criação de leads
status: done
priority: urgent
type: bug
tags: [leads, regressao, formulario]
created_by: agent
created_at: 2026-06-19T16:18:11Z
position: 34
---
## Notes
Depois das últimas alterações, o utilizador deixou de conseguir criar uma nova lead no menu de Leads. A investigação aponta para uma incompatibilidade entre os estados de pipeline apresentados no formulário e os estados canónicos aceites e usados pelo restante módulo de leads. O formulário passou a poder devolver valores como `new-contact`, `evaluation`, `visit`, `closed` ou `sold`, enquanto o módulo continua a trabalhar com estados como `new`, `contacted`, `qualified`, `proposal`, `negotiation`, `won` e `lost`. A correção foi aplicada no submit para normalizar o estado antes de criar ou atualizar a lead.

## Checklist
- [x] Localizar o ponto exato da regressão no fluxo de criação de lead
- [x] Corrigir a abertura ou submissão do formulário de nova lead
- [x] Garantir que a correção não interfere com edição, listagem e mensagens
- [x] Validar que a criação de nova lead volta a funcionar sem erros

## Acceptance
Ao clicar para criar uma nova lead no menu de Leads, o formulário abre e permite guardar a lead.
A criação de lead deixa de falhar após as alterações recentes.