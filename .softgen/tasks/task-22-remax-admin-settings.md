---
title: Configuração REMAX em Portais Externos
status: done
priority: urgent
type: feature
tags: [remax, settings, admin, external-portals]
created_by: agent
created_at: 2026-06-14T18:53:30Z
position: 22
---
## Notes
Adicionar a configuração da chave da API REMAX no painel Portais Externos para que um administrador a defina uma vez e essa configuração seja usada globalmente por todos os utilizadores. A integração atual lê a chave de variável de ambiente; o objetivo é passar a usar configuração persistida na aplicação, mantendo fallback seguro apenas se já existir valor legado. É necessário validar a persistência existente para portais externos e ajustar também o backend REMAX para ler essa configuração central.

## Checklist
- [x] Rever o painel atual Portais Externos e o serviço de configurações existente
- [x] Confirmar no schema onde guardar a chave REMAX ou criar suporte persistente se faltar
- [x] Adicionar campo REMAX no painel de administração com guardar/carregar
- [x] Atualizar a integração REMAX para ler a chave central configurada pelo admin
- [x] Validar a funcionalidade sem erros de compilação

## Acceptance
Um administrador consegue configurar a chave REMAX em Portais Externos sem editar ficheiros de ambiente.
A pesquisa REMAX na ficha da lead e no Agente IA passa a usar essa configuração global.