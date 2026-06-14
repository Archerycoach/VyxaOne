---
title: Remoção REMAX no Agente IA
status: done
priority: high
type: feature
tags: [remax, ai, cleanup]
created_by: agent
created_at: 2026-06-14T19:21:40Z
position: 28
---
## Notes
Remover referências REMAX do Agente IA, incluindo prompts, ferramentas, endpoints auxiliares e mensagens para que o agente deixe de prometer pesquisas numa integração removida.

As referências restantes do Agente IA estavam em `src/pages/api/gpt/chat.ts`. Os imports, a deteção de intent, o ramo de execução e a copy foram ajustados para suportar apenas o Idealista.

## Checklist
- [x] Localizar referências REMAX no chat e nos endpoints GPT
- [x] Remover ferramentas, prompts e caminhos de execução REMAX
- [x] Ajustar mensagens do Agente IA para mencionar apenas os portais suportados
- [x] Validar que o chat continua funcional sem REMAX

## Acceptance
O Agente IA deixa de mencionar ou executar pesquisas REMAX.
As respostas automáticas passam a suportar apenas integrações ativas.