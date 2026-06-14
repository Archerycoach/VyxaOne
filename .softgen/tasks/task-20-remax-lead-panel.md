---
title: Painel REMAX na ficha da lead
status: done
priority: high
type: feature
tags: [remax, leads, panel]
created_by: agent
created_at: 2026-06-14T18:39:35Z
position: 20
---
## Notes
Adicionar pesquisa REMAX diretamente na ficha da lead, seguindo o padrão do painel Idealista já existente. O utilizador deve conseguir lançar a pesquisa manual assistida e ver resultados úteis sem sair do detalhe da lead. A API devolve empreendimentos com unidades aninhadas e, com a evidência atual, não traz URL pública do anúncio; por isso o painel deve mostrar referências utilizáveis e permitir guardar essas referências como nota privada.

## Checklist
- [x] Rever o painel atual do Idealista na ficha da lead
- [x] Adicionar painel REMAX com CTA, loading e estados vazios
- [x] Mostrar resultados com preço, localização, tipologia e área
- [x] Permitir guardar ou reutilizar referências encontradas no contexto da lead
- [x] Validar a integração sem erros de compilação

## Acceptance
Na ficha da lead, o utilizador consegue pesquisar empreendimentos/imóveis REMAX com um clique.
Os resultados aparecem no próprio detalhe da lead de forma utilizável.