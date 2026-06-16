---
title: Assistente IA no Detalhe da Lead
status: done
priority: high
type: feature
tags: [ai, leads, crm]
created_by: agent
created_at: 2026-06-16T11:45:00Z
position: 29
---

## Notes
O utilizador pretende estender as capacidades da IA no CRM. A funcionalidade principal inicial será um Painel de Insights Inteligentes em cada Lead, que lê o histórico de interações, notas e detalhes do perfil para fornecer um resumo executivo instantâneo, avaliação de temperatura/sentimento e o melhor próximo passo a dar.

## Checklist
- [x] Criar API route `/api/gpt/leads/[id]/insights.ts` que agregue os dados e peça resumo em formato JSON à OpenAI.
- [x] Criar componente `LeadAIInsightsPanel.tsx` com o UI da análise (Resumo, Sentimento, Próximo Passo, Objeções).
- [x] Adicionar Tab "Assistente IA" com um ícone de "Sparkles" no `LeadDetailsDialog.tsx`.
- [x] Integrar a verificação de API key da OpenAI (usando a tabela ou env local) no endpoint.

## Acceptance
- Ao abrir uma Lead, o novo separador "Assistente IA" mostra um botão para gerar insights.
- O resultado apresenta de forma bonita os dados extraídos do histórico.