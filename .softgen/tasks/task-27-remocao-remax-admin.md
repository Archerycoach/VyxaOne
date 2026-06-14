---
title: Remoção REMAX no admin
status: done
priority: high
type: feature
tags: [remax, admin, cleanup]
created_by: agent
created_at: 2026-06-14T19:21:40Z
position: 27
---
## Notes
Remover a configuração REMAX da área de administração e de Portais Externos para que o produto deixe de expor uma integração indisponível.

A configuração restante estava concentrada em `src/components/settings/ExternalPortalsSettings.tsx`. A secção REMAX foi removida e o painel mantém apenas os portais ativos e configuráveis.

## Checklist
- [x] Localizar entradas de configuração REMAX em Admin e Portais Externos
- [x] Remover campos, switches e textos da REMAX
- [x] Garantir que a navegação Admin não aponta para REMAX
- [x] Validar que o painel Admin continua consistente

## Acceptance
A área de administração deixa de mostrar configuração REMAX.
Os Portais Externos ficam apenas com integrações ativas.