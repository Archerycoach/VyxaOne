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

O problema atual nos botões "E-mail IA" e "WhatsApp IA" já não é um `405` nem um problema de rewrite. A evidência atual mostra um erro de autenticação na OpenAI apenas nas rotas específicas da lead. A causa confirmada no código é que `src/pages/api/gpt/leads/[id]/draft-message.ts` e `src/pages/api/gpt/leads/[id]/insights.ts` ainda tentavam usar `gpt_api_keys.api_key` como se fosse uma chave OpenAI, enquanto outros fluxos IA já usam apenas `OPENAI_API_KEY` do servidor. Essa tabela guarda tokens internos e não deve ser usada como credencial OpenAI nestas rotas.

## Checklist
- [x] Criar API route `/api/gpt/leads/[id]/insights.ts` que agregue os dados e peça resumo em formato JSON à OpenAI.
- [x] Criar componente `LeadAIInsightsPanel.tsx` com o UI da análise (Resumo, Sentimento, Próximo Passo, Objeções).
- [x] Adicionar Tab "Assistente IA" com um ícone de "Sparkles" no `LeadDetailsDialog.tsx`.
- [x] Integrar a verificação de API key da OpenAI (usando a tabela ou env local) no endpoint.
- [x] Tornar o endpoint de rascunho compatível com `GET`, `POST` e `OPTIONS`.
- [x] Identificar a causa provável do `200` com resposta não-JSON no fluxo IA.
- [x] Remover o rewrite global que interceptava `/api/*` em `vercel.json`.
- [x] Isolar a causa atual do erro OpenAI nas rotas específicas da lead.
- [x] Alinhar as rotas `draft-message` e `insights` para usar apenas `OPENAI_API_KEY` do servidor.
- [ ] Validar o fluxo de geração de rascunho e insights no preview após a correção.

## Acceptance
- Ao abrir uma Lead, o novo separador "Assistente IA" mostra um botão para gerar insights.
- O resultado apresenta de forma bonita os dados extraídos do histórico.
- Os botões "E-mail IA" e "WhatsApp IA" recebem JSON válido do endpoint de rascunho no preview.