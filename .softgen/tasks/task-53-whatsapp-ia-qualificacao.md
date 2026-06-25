---
title: Agente IA WhatsApp e Qualificacao de Leads
status: todo
priority: high
type: feature
tags: [ai, whatsapp, qualification]
created_by: agent
created_at: 2026-06-25T07:57:59Z
position: 53
---

## Notes:
Ligar as mensagens recebidas pelo WhatsApp ao motor do Agente IA (OpenAI) e dotá-lo da capacidade de alterar o estado/temperatura da lead.

## Checklist:
- [ ] Adicionar um campo `temperature` (fria, morna, quente) ou usar o status existente da lead
- [ ] Atualizar o prompt do Agente IA para fazer perguntas de qualificação
- [ ] Criar a "tool" (function calling) no OpenAI para o agente atualizar a temperatura da Lead de forma autónoma
- [ ] Modificar o webhook do WhatsApp para encaminhar mensagens da lead para a API do GPT e devolver a resposta
- [ ] Criar trigger de automação: "Quando Lead é criada -> Enviar mensagem de saudação IA via WhatsApp"

## Acceptance:
Quando uma lead envia mensagem no WhatsApp, o Agente IA responde, qualifica-a e atualiza a sua temperatura automaticamente na plataforma.