---
title: Tracking de Pedidos de Oportunidade
status: in_progress
priority: high
type: feature
tags: ["contacts", "properties", "matching"]
created_by: agent
---

## Notes
Sistema de tracking para contactos que pedem para ser avisados quando aparecem novos imóveis ou empreendimentos.
A solução é um sistema híbrido: regista estruturadamente o que o contacto procura, cruza com novos imóveis e gera uma tarefa na agenda.

## Checklist
- [x] Criar tabela `contact_property_requests` na base de dados
- [ ] Criar `contactRequestsService.ts` com funções CRUD
- [ ] Adicionar interface de "Pedidos" no painel de detalhes do Contacto (`ContactDialogs.tsx`)
- [ ] Criar lógica de matching em `propertiesService.ts` (ao criar imóvel, procurar requests compatíveis)
- [ ] Gerar tarefa automática na agenda quando há um match (via `tasksService.ts`)
- [ ] Mostrar lista de matches no dashboard ou na ficha do contacto

## Acceptance
1. O utilizador consegue adicionar um pedido de imóvel à ficha do contacto.
2. Quando um imóvel compatível é adicionado, é criada uma tarefa "Match Encontrado" associada ao contacto.