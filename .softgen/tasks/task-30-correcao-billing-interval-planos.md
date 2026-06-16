---
title: Correção billing interval nos planos de subscrição
status: in_progress
priority: urgent
type: bug
tags: [subscriptions, supabase, admin]
created_by: agent
created_at: 2026-06-16T19:57:54Z
position: 30
---

## Notes
Foi reportado um erro Supabase ao editar um plano de subscrição: `new row for relation "subscription_plans" violates check constraint "subscription_plans_billing_interval_check"` durante um `PATCH` à tabela `subscription_plans`.

Evidência confirmada no schema: a tabela `subscription_plans` aceitava apenas `billing_interval` com os valores `monthly` e `yearly`, o que levou à remoção da opção `semiannual` no admin para eliminar o erro 400.

Novo feedback do utilizador: a opção de criar um plano semestral é necessária e não deve desaparecer. A correção restaurou suporte semestral entre base de dados, admin e fluxo de subscrições, mas surgiu um novo erro após essa restauração. É necessário confirmar se a constraint aplicada na base de dados corresponde mesmo ao código e se o fluxo de criação/edição está a enviar o valor esperado.

## Checklist
- [x] Inspecionar o schema da tabela `subscription_plans` e identificar os valores aceites por `billing_interval`
- [x] Rever o código que faz `PATCH` aos planos de subscrição no admin
- [x] Corrigir o mapeamento/normalização do campo `billing_interval`
- [x] Validar a edição de planos sem erro 400
- [x] Confirmar todos os pontos do código onde `billing_interval` é usado
- [x] Restaurar suporte a `semiannual` no schema e no admin
- [ ] Analisar o novo erro reportado após a restauração do semestral
- [ ] Confirmar no schema real se a constraint atual já aceita `semiannual`
- [ ] Corrigir o fluxo afetado e validar criação/edição de planos semestrais

## Acceptance
Ao criar ou editar um plano de subscrição, o admin permite selecionar `Semestral`.
O `PATCH` e o `INSERT` para `subscription_plans` aceitam `semiannual` sem violar a constraint.
O fluxo de subscrição continua funcional com os valores `monthly`, `semiannual` e `yearly`.