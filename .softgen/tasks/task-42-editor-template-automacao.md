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
O utilizador deixou de conseguir escrever o corpo do email no template da automação de resposta às leads. A evidência visual inicial mostrava a secção "Corpo do Email" sem área editável visível, e essa parte já foi corrigida. No entanto, o utilizador reporta agora que o editor continua visível mas sem aceitar escrita, pelo que a correção anterior não resolveu a causa real. A comparação com o uso funcional do editor mostrou que o bloqueio persiste apenas nesta integração modal. A evidência de código atual é que a modal de automações já desativa o autofocus padrão, mas o `RichTextEditor` não aplicava qualquer `focus()` programático ao Quill. Esta iteração adiciona autofocus opcional ao editor e ativa-o apenas no corpo do email da automação.

## Checklist
- [x] Inspecionar a integração do editor no formulário de automações
- [x] Confirmar se a regressão vem do RichTextEditor ou das classes/estrutura do container
- [x] Corrigir a renderização/edição do campo "Corpo do Email"
- [x] Investigar porque o editor visível não aceita escrita
- [x] Comparar esta integração com um uso funcional do editor
- [x] Corrigir o bloqueio real de input no corpo do email
- [x] Validar que o editor continua funcional nas automações e não quebra outros usos

## Acceptance
Na automação de resposta às leads, o utilizador consegue voltar a escrever e editar o corpo do email.
O editor mantém o comportamento esperado sem desaparecer da área de configuração.