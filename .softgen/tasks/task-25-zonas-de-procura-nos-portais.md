---
title: Zonas de procura nos portais
status: in_progress
priority: high
type: feature
tags: [idealista, remax, leads, location]
created_by: agent
created_at: 2026-06-14T19:09:01Z
position: 25
---
## Notes
Adicionar suporte às zonas de procura da lead nas pesquisas automáticas dos portais Idealista e REMAX. A implementação deve reutilizar os campos já existentes na lead para localização preferencial, concelhos, distritos ou zonas equivalentes, e aplicar o melhor mapeamento suportado por cada API. O objetivo é que a pesquisa manual na ficha da lead e a pesquisa via Agente IA respeitem a zona de procura configurada na lead, reduzindo resultados fora da área pretendida.

O utilizador reportou que, após a implementação inicial, a pesquisa não devolve resultados. É necessário verificar se os filtros por zona estão a ficar demasiado restritivos, se o formato enviado para os portais não corresponde ao esperado, ou se o fallback não está a ser aplicado corretamente.

## Checklist
- [x] Rever os campos atuais da lead relacionados com zona/localização de procura
- [x] Confirmar como o Idealista recebe filtros de localização
- [x] Confirmar como a integração REMAX pode mapear zonas com o contrato atual e o endpoint de regiões
- [x] Atualizar os mapeamentos de pesquisa por lead para ambos os portais
- [ ] Diagnosticar porque a pesquisa por zona não devolve resultados
- [ ] Ajustar a estratégia de filtros/fallback com base no diagnóstico
- [ ] Validar a funcionalidade sem erros de compilação

## Acceptance
As pesquisas por lead no Idealista usam as zonas de procura quando esses dados existem.
As pesquisas por lead na REMAX usam as zonas de procura quando esses dados existem, incluindo mapeamento compatível com `region_search` quando aplicável.
As pesquisas continuam a devolver resultados quando existem imóveis compatíveis nas zonas definidas.