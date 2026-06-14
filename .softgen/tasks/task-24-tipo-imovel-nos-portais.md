---
title: Tipo de imóvel nas pesquisas dos portais
status: done
priority: high
type: feature
tags: [idealista, remax, leads, ai]
created_by: agent
created_at: 2026-06-14T19:04:35Z
position: 24
---
## Notes
Adicionar suporte a tipo de imóvel nas pesquisas automáticas dos portais Idealista e REMAX. A implementação deve reutilizar, se existir, o campo já presente na lead para apartamento, moradia, terreno, loja, escritório ou equivalente. O objetivo é que a pesquisa manual na ficha da lead e a pesquisa via Agente IA respeitem esse critério sem exigir configuração duplicada. No contrato atual da REMAX não existe filtro nativo de tipo no request, por isso o melhor mapeamento suportado é filtrar os resultados pelas unidades devolvidas em `listing_type`.

## Checklist
- [x] Rever os campos atuais da lead relacionados com tipo de imóvel
- [x] Confirmar como o Idealista recebe filtro por tipo de imóvel
- [x] Confirmar como a integração REMAX pode mapear tipo de imóvel com o contrato atual
- [x] Atualizar os mapeamentos de pesquisa por lead para ambos os portais
- [x] Validar a funcionalidade sem erros de compilação

## Acceptance
As pesquisas por lead no Idealista usam o tipo de imóvel quando esse dado existe.
As pesquisas por lead na REMAX usam o tipo de imóvel quando esse dado existe ou aplicam o melhor mapeamento suportado pela API.