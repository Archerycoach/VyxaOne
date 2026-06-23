---
title: Correção de Alertas para Empreendimentos
status: done
priority: high
type: bug
tags: [alerts, matching, developments]
created_by: agent
created_at: 2026-06-23T14:00:00Z
position: 50
---

## Notes
- O utilizador reportou que os pedidos de alerta para "Empreendimentos" não estão a gerar matches/envios quando um novo empreendimento é adicionado.
- Precisamos de validar a lógica de matching em `contactOpportunityMatching.ts` e `contactAlertsService.ts`.

## Checklist
- [x] Verificar a lógica de matching em `contactOpportunityMatching.ts` para empreendimentos.
- [x] Garantir que alertas "gerais" ou sem filtros de funil atingem o score mínimo para despoletar um match.
- [x] Testar a função de geração de matches ou criar triggers apropriados.
- [x] Adicionar `matchNewDevelopment` e `matchNewProperty` aos serviços respetivos para serem executados automaticamente na inserção.