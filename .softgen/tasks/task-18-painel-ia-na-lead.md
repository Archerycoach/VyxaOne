---
title: Painel IA na ficha da lead
status: done
priority: urgent
type: feature
tags: [leads, ia, idealista]
created_by: agent
created_at: 2026-06-14T17:58:50Z
position: 18
---
## Notes
Integrar um painel de IA dentro da ficha de cada lead para permitir pesquisa manual assistida no Idealista sem sair do detalhe da lead. O painel deve mostrar um resumo útil do perfil comprador, permitir lançar a pesquisa com um clique, apresentar resultados com preço, localização, tipologia, área e link, e aproveitar o endpoint já existente de pesquisa por lead. Evitar duplicar a lógica do chat do Agente IA e manter a experiência centrada na própria lead.

## Checklist
- [x] Inspecionar a ficha da lead e os componentes já existentes de pesquisa Idealista
- [x] Desenhar o painel IA dentro do detalhe da lead com CTA claro e estado de carregamento
- [x] Ligar o painel ao endpoint de pesquisa Idealista por lead
- [x] Mostrar resultados úteis com links externos e feedback quando não existirem imóveis
- [x] Validar a integração sem erros de compilação

## Acceptance
Na ficha de uma lead compradora, existe um painel IA que permite pesquisar imóveis no Idealista com um clique.
Os resultados aparecem no detalhe da lead com informação útil e link direto para o anúncio.