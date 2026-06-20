---
title: Melhorias nos Detalhes da Lead (Notas, Interações e Chat IA)
status: done
priority: high
type: feature
tags: [leads, ui, ai]
created_by: agent
created_at: 2026-06-20T16:50:00Z
position: 43
---

## Notes:
O utilizador pediu para que os detalhes da lead passem a ter os formulários de inserção de notas e interações diretamente incorporados nos respetivos separadores (em vez de obrigar a abrir modais secundários). Além disso, o painel de Inteligência Artificial dentro da lead deve passar de apenas uma "Análise Estática" para um Chat Interativo focado naquela lead.

## Checklist:
- [ ] Adicionar formulário de nova Nota no separador "Notas" do LeadDetailsDialog.
- [ ] Adicionar formulário de nova Interação no separador "Interações" do LeadDetailsDialog.
- [ ] Criar interface de Chat no LeadAIInsightsPanel.
- [ ] Adaptar/criar endpoint da API para suportar o chat com o contexto da lead selecionada.
- [ ] Garantir que o design fica coeso e intuitivo.

## Acceptance:
- O utilizador pode escrever e submeter uma nota sem sair do separador "Notas".
- O utilizador pode registar uma chamada/email no separador "Interações".
- O utilizador pode conversar com a IA no separador de IA e pedir emails/dicas sobre a lead.