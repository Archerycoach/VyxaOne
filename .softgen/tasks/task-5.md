---
title: "Fluxos dos botões de IA"
status: "in_progress"
priority: "urgent"
type: "bug"
tags:
  - "bug"
  - "ia"
  - "navegação"
created_by: "agent"
created_at: "2026-05-02 21:39:19 UTC"
position: 5
---

## Notes
O utilizador reportou que os botões "Organizar o meu dia" e "coach de performance" não fazem nada e não apresentam erro visível. É preciso verificar os componentes/páginas onde estes CTAs são renderizados, confirmar se existe handler, navegação ou chamada API associada, e corrigir o fluxo com o menor impacto possível.
Os handlers `runAnalysis` já estavam ligados nas páginas `src/pages/ai-organizer.tsx` e `src/pages/ai-performance-coach.tsx`. A falha confirmada numa iteração anterior foi a ausência do `Toaster` global em `src/pages/_app.tsx`, o que escondia totalmente os `toast(...)` de erro e sucesso.
Nova causa confirmada: as rotas `src/pages/api/gpt/agents/organizer.ts` e `src/pages/api/gpt/agents/coach.ts` estavam a ler `gpt_api_keys.api_key` como se fosse uma chave OpenAI, mas `src/components/settings/GptApiSettings.tsx` gera nessa tabela tokens internos `sk_gpt_...` para integração ChatGPT. Foi aplicada correção para estes agentes usarem apenas `OPENAI_API_KEY` do ambiente do servidor.

## Checklist
- [x] Localizar onde os botões são renderizados e que ação deveriam executar
- [x] Verificar se os handlers de clique, links ou estados de loading estão ligados corretamente
- [x] Corrigir o fluxo dos botões afetados
- [ ] Validar se a navegação/ação volta a responder sem erros de build

## Acceptance
Os botões "Organizar o meu dia" e "coach de performance" reagem ao clique e executam a ação esperada.
Não fica um clique silencioso sem feedback nem navegação.