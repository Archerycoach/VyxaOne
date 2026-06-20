---
title: Configuração do tamanho da assinatura
status: done
priority: high
type: feature
tags: [email, assinatura, editor]
created_by: agent
created_at: 2026-06-20T10:36:00Z
position: 35
---
## Notes
O utilizador precisava de conseguir aumentar a imagem da assinatura, porque a assinatura estava a sair demasiado pequena nos emails. A solução foi implementada no editor rico partilhado, permitindo clicar numa imagem inserida e ajustar a largura com presets ou valor personalizado em píxeis. Isto cobre a edição de mensagens manuais e também os emails automáticos configurados nas automações.

## Checklist
- [x] Identificar onde a assinatura é inserida nas mensagens e automações
- [x] Implementar controlo visual para redimensionar imagens no editor rico
- [x] Permitir presets de largura e largura personalizada em píxeis
- [x] Garantir que o HTML final preserva a largura escolhida
- [x] Validar tecnicamente a alteração sem erros

## Acceptance
O utilizador consegue clicar numa imagem da assinatura e ajustar a largura antes de guardar ou enviar.
O tamanho configurado da imagem fica refletido no conteúdo final do email.