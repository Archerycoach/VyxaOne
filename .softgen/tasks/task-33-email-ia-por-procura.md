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
O utilizador quer que o agente de IA consiga preparar um email para um conjunto de leads segmentadas por critérios de procura, como zona, tipologia ou outros filtros ligados à intenção de compra. A funcionalidade permite definir o segmento, recolher as leads correspondentes e gerar um rascunho de email utilizável sem envio automático. O rascunho pode seguir para a página de Mensagens para revisão manual de destinatários, assunto e corpo antes do envio. O fluxo ficou também exposto de forma explícita dentro do menu Inteligência Artificial através de uma página dedicada. Durante a validação surgiu um erro "Unknown error" causado pela seleção da coluna inexistente `typology` no endpoint `src/pages/api/gpt/chat.ts`; a correção passou a derivar a tipologia a partir de `bedrooms` e `property_type`.

## Checklist
- [x] Identificar onde o agente de IA atual recebe instruções e onde pode apresentar um rascunho de email
- [x] Identificar como as leads podem ser filtradas por critérios de procura existentes no sistema
- [x] Implementar geração de rascunho de email com contexto do segmento encontrado
- [x] Mostrar no interface o público encontrado e o conteúdo preparado pela IA
- [x] Validar que o fluxo não envia emails automaticamente sem revisão
- [x] Integrar esta capacidade de forma explícita no menu Inteligência Artificial
- [x] Garantir que a navegação para o fluxo de email por procura é clara e utilizável
- [x] Investigar o erro reportado após a página dedicada
- [x] Corrigir a regressão sem remover o fluxo de email por procura

## Acceptance
O utilizador consegue pedir ao agente de IA um email para leads com critérios específicos de procura, como zona ou tipologia.
O sistema mostra as leads abrangidas e um rascunho de email preparado pela IA antes de qualquer envio.
A funcionalidade fica acessível de forma clara dentro da área de Inteligência Artificial.