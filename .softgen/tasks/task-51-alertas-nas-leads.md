---
title: Configuração de Alertas em Leads
status: done
priority: high
type: feature
tags: [alerts, leads, database]
created_by: agent
created_at: 2026-06-23T14:15:00Z
position: 51
---

## Notes
- O utilizador solicitou que os alertas fossem configuráveis não só nos "Contactos", mas também nas "Leads".
- Os alertas/matches devem sempre notificar o consultor (criar tarefa para o consultor agir) e não enviar notificação direta ao cliente por defeito.
- A tabela `contact_alert_requests` e `contact_opportunity_matches` precisam de um campo `lead_id`.

## Checklist
- [x] Alterar o esquema de DB (`contact_alert_requests` e `contact_opportunity_matches`) adicionando `lead_id`.
- [x] Atualizar tipos em `types/index.ts`.
- [x] Atualizar `contactAlertsService.ts` e métodos de DB para suportar `lead_id`.
- [x] Integrar o painel de configuração de alertas na vista de detalhes da Lead (`LeadDetailsDialog`).
- [x] Garantir que o texto na interface é claro: a notificação vai para o Consultor.