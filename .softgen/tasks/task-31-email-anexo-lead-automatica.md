---
title: Anexo no email automático para nova lead
status: in_progress
priority: urgent
type: bug
tags: [email, leads, automacao]
created_by: agent
created_at: 2026-06-18T14:03:22Z
position: 31
---
## Notes
O utilizador reportou que o email enviado automaticamente à lead quando entra uma nova lead não está a incluir o ficheiro anexo configurado. É necessário identificar o fluxo de automação responsável pelo envio, confirmar onde a configuração do anexo é lida e corrigir o payload enviado para o serviço de email sem alterar outros fluxos de mensagens.

## Checklist
- [x] Localizar o fluxo que envia automaticamente email para nova lead
- [x] Verificar onde a configuração do ficheiro anexo é guardada e lida
- [x] Corrigir a montagem do payload de envio para incluir o anexo configurado
- [ ] Validar que o envio automático continua funcional e sem regressões

## Acceptance
O email automático enviado a uma nova lead inclui o ficheiro anexo configurado no sistema.
A configuração existente do anexo continua a ser usada sem intervenção manual adicional.