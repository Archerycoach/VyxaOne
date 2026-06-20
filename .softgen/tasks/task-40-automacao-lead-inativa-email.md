---
title: Correção do email automático para lead inativa
status: in_progress
priority: high
type: bug
tags: [automacao, leads, email, workflow]
created_by: agent
created_at: 2026-06-20T11:38:44Z
position: 40
---
## Notes
O utilizador reportou que a automação da lead inativa há 7 dias não está a enviar automaticamente o email para o utilizador. É necessário confirmar onde esta regra é avaliada, que trigger/cron a executa, como o workflow constrói e despacha o email, e se existe falha de filtragem, destinatário, condição temporal ou execução do passo de envio. A correção deve preservar o resto das automações existentes.

## Checklist
- [ ] Localizar a configuração e execução da automação de lead inativa há 7 dias
- [ ] Confirmar como o workflow escolhe o destinatário do email e dispara o envio
- [ ] Identificar por que motivo o email não está a ser enviado automaticamente
- [ ] Corrigir a execução da automação sem afetar outros tipos de workflow
- [ ] Validar tecnicamente o fluxo corrigido

## Acceptance
A automação de lead inativa há 7 dias volta a enviar automaticamente o email esperado.
O envio automático usa o destinatário correto e não quebra outras automações.