---
title: Destaque visual de leads contactadas
status: done
priority: high
type: feature
tags: [leads, pipeline, interactions, visual-state]
created_by: agent
created_at: 2026-06-20T11:30:40Z
position: 39
---
## Notes
O utilizador quer que as leads que já tenham sido contactadas e tenham qualquer interação registada fiquem visualmente destacadas durante 5 dias. O destaque deve aparecer na Lista de Leads e no Pipeline. O estilo pedido é combinação de fundo colorido suave com badge visível. Após 5 dias desde a interação mais recente, a lead deve voltar ao estado visual normal (branco). A implementação usa a data real de último contacto da lead e passa agora a atualizá-la também sempre que qualquer interação é criada pelo fluxo normal de interações em `src/services/interactionsService.ts`.

## Checklist
- [x] Identificar onde a Lista de Leads e o Pipeline recebem os dados das leads
- [x] Confirmar que campo ou relação permite determinar a data da interação mais recente
- [x] Implementar a regra de destaque por 5 dias com base em interação registada
- [x] Aplicar fundo colorido suave e badge na Lista de Leads
- [x] Aplicar fundo colorido suave e badge no Pipeline
- [x] Validar que após 5 dias o destaque desaparece automaticamente

## Acceptance
As leads com interação registada nos últimos 5 dias aparecem destacadas na Lista de Leads e no Pipeline.
O destaque usa fundo suave colorido e badge visível.
Após 5 dias sem nova interação, a lead volta ao aspeto normal.