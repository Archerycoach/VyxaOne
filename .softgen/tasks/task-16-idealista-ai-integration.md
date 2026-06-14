---
title: Integração Idealista no Agente IA
status: done
priority: urgent
type: feature
tags: [ai, idealista, leads, search]
created_by: agent
created_at: 2026-06-14T17:42:22Z
position: 16
---
## Notes
Integrar a pesquisa de imóveis do Idealista diretamente no Agente IA para que o utilizador possa pedir imóveis adaptados a uma lead no chat. Eliminar a limitação atual do mapeamento de área, que ainda usa nomes de colunas antigos e pode ignorar filtros importantes. A integração deve reutilizar o endpoint existente de pesquisa por lead e devolver ao chat resultados úteis com preço, localização, tipologia e link.

## Checklist
- [x] Corrigir o mapeamento da lead para parâmetros Idealista usando as colunas reais de área
- [x] Inspecionar a rota de chat do agente IA e o fluxo da página que a invoca
- [x] Integrar um comando/intent no backend do chat para pesquisar imóveis por lead via Idealista
- [x] Devolver ao utilizador um resumo determinístico com imóveis encontrados e links
- [x] Validar a integração completa sem erros de compilação

## Acceptance
Quando o utilizador pedir ao Agente IA imóveis para uma lead específica, o sistema pesquisa no Idealista com os dados reais da lead e devolve resultados utilizáveis.
O filtro de área passa a usar as colunas reais da base de dados e deixa de ignorar essa preferência.