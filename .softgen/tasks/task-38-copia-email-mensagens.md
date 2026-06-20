---
title: Cópia de email nas mensagens
status: done
priority: high
type: feature
tags: [mensagens, email, smtp]
created_by: agent
created_at: 2026-06-20T11:24:04Z
position: 38
---
## Notes
O utilizador quer que, ao enviar um email pela área de Mensagens, exista a oportunidade de receber uma cópia do email enviado. A alteração deve ficar limitada ao fluxo de envio manual de emails em Mensagens. A investigação confirmou que o formulário é montado em `src/pages/bulk-messages.tsx` e que o envio real passa pelo endpoint autenticado `src/pages/api/smtp/send.ts`. A implementação adiciona uma opção explícita no compositor e envia a cópia para o email da conta autenticada através de BCC no endpoint.

## Checklist
- [x] Identificar onde o formulário de Mensagens recolhe os dados do envio de email
- [x] Identificar como o endpoint SMTP recebe destinatários e monta o envio
- [x] Adicionar uma opção clara para o utilizador pedir uma cópia do email
- [x] Garantir que a cópia é enviada para o endereço certo no fluxo manual
- [x] Validar que o envio principal continua a funcionar sem regressões

## Acceptance
Ao enviar um email pela área de Mensagens, o utilizador pode escolher receber uma cópia do email.
A cópia é enviada juntamente com o email principal sem impedir o envio ao destinatário.