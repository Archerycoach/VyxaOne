---
title: Matching automático de oportunidades
status: done
priority: high
type: feature
tags:
  - matching
  - agenda
  - ia
created_by: agent
created_at: 2026-05-05
position: 10
---

## Notes
Depois de existirem pedidos estruturados por contacto, o sistema deve detetar imóveis e empreendimentos publicados recentemente e criar matches sem duplicação. Os matches devem gerar tarefas operacionais na agenda e alimentar o resumo do agente IA com oportunidades pendentes por trabalhar.

## Checklist
- [x] Criar tabela de matches entre pedidos de alerta e imóveis/empreendimentos com score, estado e controlo de duplicados
- [x] Implementar serviço de matching para imóveis e empreendimentos publicados nos últimos 30 dias
- [x] Criar tarefas automaticamente para matches prioritários e evitar duplicados operacionais
- [x] Incluir matches pendentes no endpoint de execução manual do agente IA

## Acceptance
Quando surge um imóvel ou empreendimento recente compatível com um pedido ativo, é criado um match único.
Os matches prioritários geram tarefa operacional e passam a aparecer no contexto do agente IA.