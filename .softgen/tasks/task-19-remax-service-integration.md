---
title: Integração base REMAX
status: done
priority: urgent
type: feature
tags: [remax, api, backend, search]
created_by: agent
created_at: 2026-06-14T18:39:35Z
position: 19
---
## Notes
Integrar a API da REMAX usando a Parse.bot para replicar o padrão já existente com o Idealista. Esta tarefa cobre a análise do contrato disponível, a criação do serviço/backend de pesquisa e a normalização dos resultados para reutilização noutros pontos da app. A chave deve ser lida de variável de ambiente PARSE_API_KEY e nunca hardcoded.

## Checklist
- [x] Inspecionar a documentação disponível da API REMAX e confirmar formato de request/response
- [x] Criar serviço de pesquisa REMAX com chamada autenticada e normalização de resultados
- [x] Criar endpoint interno que permita pesquisar por lead reutilizando os dados reais da base de dados
- [x] Garantir tratamento de erros e fallback claro quando a API não responder
- [x] Validar a integração sem erros de compilação

## Acceptance
Existe uma integração backend REMAX funcional, equivalente ao fluxo base do Idealista.
Os resultados da REMAX ficam disponíveis num formato reutilizável para painel da lead e Agente IA.