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

O problema atual nos botões "E-mail IA" e "WhatsApp IA" já não é um `405`. A evidência no frontend mostra uma resposta com `status 200` mas com corpo inválido para JSON durante o pedido ao endpoint `/api/gpt/leads/[id]/draft-message`. A análise dos ficheiros abertos aponta para a causa mais provável: o rewrite global em `vercel.json` reescrevia `/(.*)` para `/`, podendo devolver HTML da homepage em vez de deixar a API responder com JSON.

## Checklist
- [x] Criar API route `/api/gpt/leads/[id]/insights.ts` que agregue os dados e peça resumo em formato JSON à OpenAI.
- [x] Criar componente `LeadAIInsightsPanel.tsx` com o UI da análise (Resumo, Sentimento, Próximo Passo, Objeções).
- [x] Adicionar Tab "Assistente IA" com um ícone de "Sparkles" no `LeadDetailsDialog.tsx`.
- [x] Integrar a verificação de API key da OpenAI (usando a tabela ou env local) no endpoint.
- [x] Tornar o endpoint de rascunho compatível com `GET`, `POST` e `OPTIONS`.
- [x] Identificar a causa provável do `200` com resposta não-JSON no fluxo IA.
- [ ] Remover o rewrite global que intercepta `/api/*` em `vercel.json`.
- [ ] Validar o fluxo de geração de rascunho no preview após a correção.

## Acceptance
- Ao abrir uma Lead, o novo separador "Assistente IA" mostra um botão para gerar insights.
- O resultado apresenta de forma bonita os dados extraídos do histórico.
- Os botões "E-mail IA" e "WhatsApp IA" recebem JSON válido do endpoint de rascunho no preview.