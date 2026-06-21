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

Nova exigência: o agente deve conseguir escrever o email e selecionar as leads apenas com base nas instruções em linguagem natural, mesmo quando os campos de critérios da interface estão em branco. O bloqueio atual estava no frontend a impedir submissão sem critérios e no endpoint a depender demasiado de critérios estruturados.

## Checklist
- [x] Comparar o fluxo atual de conversa em tempo real com o fluxo de emails por procura para mapear onde a lógica diverge
- [x] Identificar como o ecrã de emails por procura monta a audiência e onde perde acesso ao contexto completo do agente
- [x] Redesenhar o handoff para que a geração/refinamento do email reutilize a mesma lógica e contexto do agente IA
- [x] Atualizar a interface para suportar afinação iterativa da procura e do conteúdo do email com o agente
- [x] Remover a validação que bloqueia a geração de email quando os critérios estruturados estão vazios
- [x] Garantir que o endpoint do agente aceita instruções livres e infere a audiência a partir da mensagem e do contexto disponível
- [x] Validar no código que o fluxo passa a considerar corretamente todas as leads, imóveis e empreendimentos visíveis ao agente, mesmo sem critérios preenchidos na UI

## Acceptance
No fluxo de emails por procura, o agente usa a mesma visão de dados da conversa em tempo real.
O utilizador consegue afinar a pesquisa e o email conversando com o agente antes do envio.
O agente consegue gerar o email e selecionar as leads apenas com base nas instruções escritas, mesmo com os critérios da interface em branco.