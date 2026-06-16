---
title: Assistente IA no Detalhe da Lead
status: in_progress
priority: high
type: feature
tags: [ai, leads, crm]
created_by: agent
created_at: 2026-06-16T11:45:00Z
position: 29
---

## Notes
O utilizador pretende estender as capacidades da IA no CRM. A funcionalidade principal inicial será um Painel de Insights Inteligentes em cada Lead, que lê o histórico de interações, notas e detalhes do perfil para fornecer um resumo executivo instantâneo, avaliação de temperatura/sentimento e o melhor próximo passo a dar.

Foi reportada uma regressão nos botões "E-mail IA" e "WhatsApp IA": o endpoint de geração de rascunho está a responder com erro 405 no preview. A correção precisa de tornar o fluxo mais tolerante ao método HTTP usado no ambiente de preview, sem alterar a autenticação nem o resultado final para o utilizador.

## Checklist
- [x] Criar API route `/api/gpt/leads/[id]/insights.ts` que agregue os dados e peça resumo em formato JSON à OpenAI.
- [x] Criar componente `LeadAIInsightsPanel.tsx` com o UI da análise (Resumo, Sentimento, Próximo Passo, Objeções).
- [x] Adicionar Tab "Assistente IA" com um ícone de "Sparkles" no `LeadDetailsDialog.tsx`.
- [x] Integrar a verificação de API key da OpenAI (usando a tabela ou env local) no endpoint.
- [ ] Corrigir o erro 405 na geração de rascunhos IA para e-mail e WhatsApp.
- [ ] Validar o fluxo de geração de rascunho no preview após a correção.

## Acceptance
- Ao abrir uma Lead, o novo separador "Assistente IA" mostra um botão para gerar insights.
- O resultado apresenta de forma bonita os dados extraídos do histórico.
- Os botões "E-mail IA" e "WhatsApp IA" geram rascunhos sem erro 405.