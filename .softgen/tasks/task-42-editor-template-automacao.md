---
title: Correção do editor de template da automação
status: done
priority: urgent
type: bug
tags: [automacoes, email, editor]
created_by: agent
created_at: 2026-06-20T13:27:03Z
position: 42
---
## Notes
O utilizador deixou de conseguir escrever o corpo do email no template da automação de resposta às leads. A evidência visual inicial mostrava a secção "Corpo do Email" sem área editável visível, e essa parte já foi corrigida. No entanto, o utilizador reporta agora uma segunda regressão: o editor aparece, mas continua sem permitir escrita. A investigação confirmou uma causa concreta no fluxo das automações: `handleUseTemplate` e `handleEditWorkflow` estavam a passar texto simples com quebras de linha para o `RichTextEditor`, enquanto o editor rico controlado espera HTML para funcionar de forma estável. A correção normaliza esses corpos para HTML antes de os enviar ao editor, cobrindo tanto templates novos como workflows antigos já guardados.

## Checklist
- [x] Inspecionar a integração do editor no formulário de automações
- [x] Confirmar se a regressão vem do RichTextEditor ou das classes/estrutura do container
- [x] Corrigir a renderização/edição do campo "Corpo do Email"
- [x] Investigar porque o editor visível não aceita escrita
- [x] Corrigir o bloqueio de input no corpo do email
- [x] Validar que o editor continua funcional nas automações e não quebra outros usos

## Acceptance
Na automação de resposta às leads, o utilizador consegue voltar a escrever e editar o corpo do email.
O editor mantém o comportamento esperado sem desaparecer da área de configuração.