---
title: Inactive leads alert email
status: done
priority: urgent
type: bug
tags: [automation, email, leads]
created_by: agent
created_at: 2026-06-21T20:45:36Z
position: 46
---
## Notes
O utilizador reporta que a automação de leads inativas está ativa, mas não está a receber o email com a lista de leads. A análise dos ficheiros inicialmente abertos mostrou que `src/pages/api/cron/contact-alerts.ts` e `src/services/contactAlertsService.ts` pertencem ao sistema de alertas de oportunidades para contactos, não ao fluxo de automação de leads inativas. Esses ficheiros trabalham com `contact_alert_requests`, `contact_opportunity_matches`, imóveis, empreendimentos e tarefas, sem lógica de email para lista de leads inativas.

O problema está, portanto, noutro subsistema: a configuração/workflow de “lead inativa” e o cron/função que a executa. A investigação confirmou uma divergência concreta no cron `supabase/functions/workflow-automation/index.ts`: a query base estava a procurar apenas leads com `assigned_to = user_id`, enquanto o resto da aplicação e a gestão manual de workflows trabalham com leads do utilizador por `user_id`. Quando a lead pertence ao utilizador mas não tem `assigned_to` preenchido, a automação não encontra nenhuma lead e não envia qualquer alerta. Foi aplicada uma correção para incluir ambas as formas de posse/visibilidade no cron.

## Checklist
- [x] Localizar o fluxo responsável pelo alerta de leads inativas e a respetiva configuração
- [x] Confirmar no código como são selecionadas as leads inativas e que condições bloqueiam o envio
- [x] Verificar o endpoint/cron que dispara o email e como o destinatário é determinado
- [x] Corrigir a causa para que o email com a lista de leads volte a ser enviado
- [x] Validar no código que a automação ativa volta a produzir o envio esperado

## Acceptance
Com a automação ativa, o sistema volta a enviar o email com a lista de leads inativas.
O utilizador recebe o alerta no destino configurado sem precisar de disparo manual.