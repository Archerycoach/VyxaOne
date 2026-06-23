---
title: Ordenação de Leads e Pipeline
status: done
priority: high
type: feature
tags: [leads, pipeline, sorting]
created_by: agent
created_at: 2026-06-22T11:14:00Z
position: 47
---

## Notes
O utilizador pretende adicionar opções de ordenação na listagem de Leads e no Pipeline.
Os campos de ordenação incluem:
- Data de criação
- Data da última interação
- Tipologia
- Nome
- Tipo de imóvel
- Empreendimento

## Checklist
- [x] Adicionar parâmetros de ordenação (sortField, sortOrder) no hook de leads/filtros
- [x] Implementar a lógica de ordenação na query ao Supabase (ou no front-end caso seja processado em client-side)
- [x] Adicionar o UI de ordenação (dropdown) no componente LeadsList
- [x] Adicionar o UI de ordenação (dropdown) no componente PipelineBoard