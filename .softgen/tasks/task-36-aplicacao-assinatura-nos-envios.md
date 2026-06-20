---
title: Aplicação da assinatura nos envios
status: done
priority: high
type: feature
tags: [email, assinatura, mensagens, automacoes]
created_by: agent
created_at: 2026-06-20T10:36:00Z
position: 36
---
## Notes
A necessidade era que a assinatura com imagem pudesse ser redimensionada tanto nas mensagens manuais como nos emails automáticos. Como ambos os fluxos usam o editor rico para compor o conteúdo HTML, a capacidade de redimensionamento foi aplicada diretamente nesse editor e exposta com instruções claras nas páginas de Mensagens e de Workflows.

## Checklist
- [x] Aplicar o redimensionamento de imagem no fluxo de mensagens manuais
- [x] Aplicar o redimensionamento de imagem no fluxo de emails automáticos
- [x] Mostrar orientação ao utilizador sobre como ajustar a largura da assinatura
- [x] Confirmar que o comportamento não ativa envios automáticos indevidos
- [x] Validar tecnicamente a alteração com verificação limpa

## Acceptance
A assinatura aparece com o tamanho ajustado nas mensagens manuais.
A assinatura aparece com o tamanho ajustado nos emails automáticos.