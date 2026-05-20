---
title: "Ligação Google Calendar"
status: "done"
priority: "urgent"
type: "bug"
tags:
  - "bug"
  - "google-calendar"
  - "oauth"
  - "settings"
created_by: "agent"
created_at: "2026-05-03 18:28:48 UTC"
position: 6
---

## Notes
O utilizador reportou que a ligação ao Google Calendar continua a falhar ao clicar em ligar nas definições do utilizador. A interface mostra um toast vermelho com "Erro na conexão" e "Erro desconhecido ao conectar Google Calendar". É necessário identificar a origem exata desse erro no frontend, confirmar se o problema ocorre antes do redirect OAuth ou no callback, e corrigir o fluxo de autenticação com o menor impacto possível.
O diagnóstico anterior mostrou que a agenda continua a receber `data: null` na leitura de `google_calendar_integrations`, pelo que a ligação não está a ser persistida para o utilizador autenticado.

## Checklist
- [ ] Localizar no código a origem exata do toast "Erro desconhecido ao conectar Google Calendar"
- [ ] Verificar o fluxo de ligação nas definições do utilizador e confirmar os dados enviados para o OAuth
- [ ] Verificar o callback da Google e a persistência em `google_calendar_integrations`
- [ ] Corrigir o fluxo de ligação e validar que a conta fica ligada e visível na agenda

## Acceptance
Ao clicar em "Conectar Google Calendar" nas definições do utilizador, a app redireciona corretamente para o OAuth da Google sem erro imediato.
Depois do regresso da Google, a ligação fica gravada para o utilizador autenticado e a agenda deixa de mostrar "Google Calendar not connected".