---
title: Integracao Base WhatsApp API
status: in_progress
priority: high
type: feature
tags: [whatsapp, integrations, webhook]
created_by: agent
created_at: 2026-06-25T07:57:59Z
position: 52
---

## Notes:
Preparar a fundação para a integração com a Meta WhatsApp Cloud API. Precisamos de guardar as credenciais, configurar o webhook e criar os serviços de envio.

## Checklist:
- [x] Criar tabela `whatsapp_settings` na base de dados com RLS
- [x] Gerar os tipos do Supabase
- [ ] Criar o componente `WhatsAppConnection.tsx` para as Definições
- [ ] Adicionar o separador do WhatsApp na página `settings.tsx`
- [ ] Criar o ficheiro `whatsappService.ts` com funções para enviar mensagens
- [ ] Criar o endpoint do Webhook `api/whatsapp/webhook.ts` para validação e receção de mensagens

## Acceptance:
O utilizador consegue inserir as suas credenciais do WhatsApp Cloud API nas definições e o webhook está pronto para ser validado pela Meta.