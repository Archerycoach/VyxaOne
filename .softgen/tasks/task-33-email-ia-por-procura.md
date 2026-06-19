---
title: Email IA por critérios de procura
status: done
priority: high
type: feature
tags: [ia, leads, email, segmentacao]
created_by: agent
created_at: 2026-06-19T16:00:19Z
position: 33
---
## Notes
O utilizador quer que o agente de IA consiga preparar um email para um conjunto de leads segmentadas por critérios de procura, como zona, tipologia ou outros filtros ligados à intenção de compra. A funcionalidade deve permitir selecionar ou inferir o segmento, recolher as leads correspondentes e gerar um rascunho de email utilizável sem envio automático nesta fase. O rascunho deve poder seguir para a página de Mensagens para revisão manual de destinatários, assunto e corpo antes do envio.

## Checklist
- [x] Identificar onde o agente de IA atual recebe instruções e onde pode apresentar um rascunho de email
- [x] Identificar como as leads podem ser filtradas por critérios de procura existentes no sistema
- [x] Implementar geração de rascunho de email com contexto do segmento encontrado
- [x] Mostrar no interface o público encontrado e o conteúdo preparado pela IA
- [x] Validar que o fluxo não envia emails automaticamente sem revisão

## Acceptance
O utilizador consegue pedir ao agente de IA um email para leads com critérios específicos de procura, como zona ou tipologia.
O sistema mostra as leads abrangidas e um rascunho de email preparado pela IA antes de qualquer envio.