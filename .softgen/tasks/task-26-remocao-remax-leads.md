---
title: Remoção REMAX nas leads
status: done
priority: urgent
type: feature
tags: [remax, leads, cleanup]
created_by: agent
created_at: 2026-06-14T19:21:40Z
position: 26
---
## Notes
Remover a integração REMAX das superfícies de leads, incluindo painel, ações de pesquisa e qualquer dependência visível para utilizadores. O objetivo é deixar de apresentar uma funcionalidade que não está operacional.

As referências restantes nas leads estavam em `src/components/leads/LeadDetailsDialog.tsx` e `src/components/leads/LeadRemaxPanel.tsx`. O painel foi removido da ficha da lead e o componente dedicado deixou de ser usado.

## Checklist
- [x] Desativar o endpoint principal de pesquisa REMAX
- [x] Neutralizar o serviço REMAX para evitar chamadas funcionais
- [x] Localizar todos os componentes de leads que mostram pesquisa REMAX
- [x] Remover botões, painéis e estados associados à REMAX nas leads
- [x] Validar que a ficha da lead continua funcional sem REMAX

## Acceptance
A ficha da lead deixa de mostrar ações ou resultados da REMAX.
Nenhuma pesquisa REMAX é executada a partir da área de leads.