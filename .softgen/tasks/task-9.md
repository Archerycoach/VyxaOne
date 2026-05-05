---
title: Pedidos de alerta de contactos
status: done
priority: high
type: feature
tags:
  - contactos
  - matching
  - agenda
created_by: agent
created_at: 2026-05-05
position: 9
---

## Notes
Implementar pedidos estruturados de alerta associados a contactos para que a equipa possa registar interesse em novos imóveis ou empreendimentos. Esta fase deve incluir persistência em Supabase, gestão no interface de contactos e ligação operacional à agenda através de tarefas. O objetivo é preparar a base para matching automático e para consumo pelo agente IA.

## Checklist
- [x] Criar tabela de pedidos de alerta de contactos no Supabase com preferências, urgência, canal de aviso e estado ativo
- [x] Adicionar tipos TypeScript e serviço dedicado para gerir pedidos de alerta
- [x] Integrar gestão de pedidos no módulo de contactos com criação, edição, ativação e desativação
- [x] Permitir associar pedidos a imóveis, empreendimentos ou ambos e definir filtros por zona, tipologia e preço

## Acceptance
Ao abrir um contacto, é possível registar um pedido estruturado de alerta com preferências e canal de aviso.
Os pedidos ficam guardados no Supabase e podem ser editados sem recorrer a notas livres.