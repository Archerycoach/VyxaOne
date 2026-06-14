---
title: Integração REMAX no Agente IA
status: done
priority: high
type: feature
tags: [remax, ai, chat]
created_by: agent
created_at: 2026-06-14T18:39:35Z
position: 21
---
## Notes
Adicionar ao Agente IA a capacidade de pesquisar REMAX para uma lead específica, da mesma forma que já pesquisa Idealista. O chat deve reconhecer o pedido, encontrar a lead correta e devolver resultados REMAX de forma determinística.

## Checklist
- [x] Rever a integração atual do Idealista no chat
- [x] Adicionar intent de pesquisa REMAX por lead
- [x] Reutilizar o endpoint/backend REMAX para obter resultados reais
- [x] Devolver resposta estruturada com imóveis/empreendimentos e referências
- [x] Validar a integração sem erros de compilação

## Acceptance
O Agente IA consegue pesquisar REMAX por nome da lead e devolver resultados úteis.
A experiência fica consistente com a integração já existente do Idealista.