---
title: Empreendimentos module
status: in_progress
priority: high
type: feature
tags:
  - crm
  - empreendimentos
  - supabase
created_by: agent
created_at: 2026-05-05T16:54:06Z
position: 8
---

## Notes
Criar um módulo próprio de Empreendimentos dentro da aplicação, separado de Imóveis. A primeira fase inclui base de dados, serviço, tipos, página, navegação, listagem e formulário para gestão manual dentro da app. Deve seguir o padrão já usado no módulo de imóveis, mas com campos próprios de empreendimento e data de publicação para suportar a lógica futura de "novo nos últimos 30 dias".

## Checklist
- [ ] Validar o schema atual e criar a tabela de empreendimentos no Supabase com campos próprios e RLS compatível com utilizadores autenticados
- [ ] Adicionar tipos TypeScript e serviço de dados para listar, criar, editar e apagar empreendimentos
- [ ] Criar página e container de Empreendimentos com cabeçalho, listagem e ação de novo registo
- [ ] Criar formulário de Empreendimento com campos de publicação, localização, preços, tipologias, estado e destaques
- [ ] Atualizar a navegação para expor o novo módulo Empreendimentos

## Acceptance
A aplicação mostra um item "Empreendimentos" no menu e abre uma página própria.
É possível criar, editar e apagar empreendimentos dentro da aplicação.
Os empreendimentos ficam guardados no Supabase com data de publicação e estado.