---
title: Acesso a imóveis no agente IA
status: done
priority: urgent
type: bug
tags: [ai, properties, supabase]
created_by: agent
created_at: 2026-06-21T20:13:27Z
position: 44
---
## Notes
O agente IA está a responder que o utilizador não tem imóveis criados, mas o utilizador confirma que existem 10 imóveis na plataforma. É necessário validar a query usada no endpoint do chat, confirmar o campo correto de associação ao utilizador e garantir que o contexto enviado ao modelo inclui os imóveis reais.

## Checklist
- [x] Inspecionar o endpoint do chat do agente IA e localizar a query que carrega imóveis e empreendimentos
- [x] Confirmar no schema da base de dados os campos reais da tabela properties e developments usados para filtrar por utilizador
- [x] Comparar a query do agente com o fluxo já usado nas páginas de imóveis para identificar divergências
- [x] Corrigir a query ou o mapeamento do contexto para que os imóveis reais cheguem ao agente IA
- [x] Validar no código que a resposta do agente deixa de afirmar incorretamente que não existem imóveis

## Acceptance
O agente IA consegue listar e analisar os imóveis já existentes do utilizador.
Quando o utilizador pergunta pelos seus imóveis, a resposta deixa de dizer incorretamente que não há imóveis criados.