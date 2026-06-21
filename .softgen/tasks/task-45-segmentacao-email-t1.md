---
title: Alinhamento entre emails por procura e agente IA
status: done
priority: urgent
type: feature
tags: [ai, email, leads, segmentation]
created_by: agent
created_at: 2026-06-21T20:18:27Z
position: 45
---
## Notes
O utilizador quer que a lógica de “emails por procura” seja a mesma da conversa em tempo real com o agente IA. Isso significa que o fluxo de geração/refinamento de emails deve usar o mesmo contexto completo de leads, imóveis e empreendimentos, em vez de depender apenas da filtragem local do ecrã de mensagens em massa. Também deve permitir conversar com o agente para afinar a procura e o texto do email antes de enviar.

Nova exigência: o fluxo precisa de uma forma de debug para descobrir a causa real quando a geração do email falha. Atualmente o utilizador vê apenas um erro genérico (“Unknown error”), o que impede perceber se a falha vem da API, da autenticação, do parse da resposta da IA ou de outro passo intermédio. O objetivo é expor informação útil de diagnóstico no próprio fluxo sem quebrar a experiência normal.

## Checklist
- [x] Comparar o fluxo atual de conversa em tempo real com o fluxo de emails por procura para mapear onde a lógica diverge
- [x] Identificar como o ecrã de emails por procura monta a audiência e onde perde acesso ao contexto completo do agente
- [x] Redesenhar o handoff para que a geração/refinamento do email reutilize a mesma lógica e contexto do agente IA
- [x] Atualizar a interface para suportar afinação iterativa da procura e do conteúdo do email com o agente
- [x] Remover a validação que bloqueia a geração de email quando os critérios estruturados estão vazios
- [x] Garantir que o endpoint do agente aceita instruções livres e infere a audiência a partir da mensagem e do contexto disponível
- [x] Validar no código que o fluxo passa a considerar corretamente todas as leads, imóveis e empreendimentos visíveis ao agente, mesmo sem critérios preenchidos na UI
- [x] Localizar onde o fluxo transforma a falha real num erro genérico “Unknown error”
- [x] Expor informação de debug útil no frontend e/ou na API para diagnosticar falhas de geração do email
- [x] Validar que o utilizador passa a ver uma mensagem de erro útil ou detalhes de debug acionáveis

## Acceptance
No fluxo de emails por procura, o agente usa a mesma visão de dados da conversa em tempo real.
O utilizador consegue afinar a pesquisa e o email conversando com o agente antes do envio.
O agente consegue gerar o email e selecionar as leads apenas com base nas instruções escritas, mesmo com os critérios da interface em branco.
Quando a geração falha, o utilizador deixa de ver apenas “Unknown error” e passa a ter detalhes úteis para diagnosticar a causa.