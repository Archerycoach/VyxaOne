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
O utilizador deixou de conseguir escrever o corpo do email no template da automação de resposta às leads. A evidência visual mostra a secção "Corpo do Email" sem área editável visível, embora o resto da configuração do email continue a renderizar. A investigação concentrou-se no editor rico partilhado e na integração concreta dentro da gestão de workflows, evitando regressões no envio manual de mensagens. A análise mostrou dois pontos frágeis: o editor estava a ser reutilizado dentro do diálogo sem uma remontagem estável ao trocar templates/edição, e o `RichTextEditor` só garantia altura visível no `.ql-editor`, deixando margem para colapso visual do container dentro do modal.

## Checklist
- [x] Inspecionar a integração do editor no formulário de automações
- [x] Confirmar se a regressão vem do RichTextEditor ou das classes/estrutura do container
- [x] Corrigir a renderização/edição do campo "Corpo do Email"
- [x] Validar que o editor continua funcional nas automações e não quebra outros usos

## Acceptance
Na automação de resposta às leads, o utilizador consegue voltar a escrever e editar o corpo do email.
O editor mantém o comportamento esperado sem desaparecer da área de configuração.