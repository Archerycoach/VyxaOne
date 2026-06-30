---
title: Exportação de Leads para Excel
status: in_progress
priority: high
type: feature
tags: [leads, export, excel]
created_by: agent
created_at: 2026-06-27T01:45:00Z
position: 56
---

## Notes
O utilizador pretende poder exportar a listagem de leads para um ficheiro Excel. 
Devemos utilizar o serviço `excelService.ts` (já existente no projeto) para gerar o ficheiro `.xlsx` e adicionar um botão de exportação no painel principal das leads.

## Checklist
- [x] Adicionar método no `excelService.ts` para formatar os dados e exportar as leads.
- [x] Adicionar um botão "Exportar para Excel" na listagem de leads (`LeadsListContainer.tsx` ou `LeadsList.tsx`).
- [x] Integrar a chamada à base de dados para garantir que descarrega todas as leads (ou as leads atualmente filtradas) em vez de apenas a primeira página, e gerar o ficheiro.