---
title: Análise IA com histórico completo de leads
status: done
priority: high
type: feature
tags: [ia, leads, historico, notas, planeamento]
created_by: agent
created_at: 2026-06-20T11:09:36Z
position: 37
---
## Notes
O utilizador quer que a análise diária feita pela IA para sugerir o planeamento do dia passe a considerar toda a informação relevante de cada lead, incluindo notas, histórico de interações e restantes sinais disponíveis no registo. A investigação mostrou que o cron diário já lia notas em `src/pages/api/cron/gpt-assistant.ts`, mas ainda não enviava à IA o histórico de interações por lead. O organizador manual em `src/pages/api/gpt/agents/organizer.ts` também só considerava leads negligenciadas com dados básicos, sem notas nem histórico completo. A correção enriqueceu os dois fluxos com contexto completo por lead antes de sugerir interações.

## Checklist
- [x] Identificar o fluxo que gera o planeamento diário e as sugestões de interação
- [x] Verificar que dados da lead estão atualmente a ser enviados para a IA
- [x] Incluir notas e histórico completo da lead no contexto analisado
- [x] Ajustar o prompt ou a estrutura de contexto para priorizar sugestões baseadas no histórico
- [x] Validar tecnicamente a alteração sem introduzir regressões

## Acceptance
A IA diária considera as notas existentes nas leads ao sugerir próximas interações.
A IA diária considera o histórico completo da lead no planeamento apresentado.