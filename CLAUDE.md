# VyxaOne — CRM imobiliário (Next.js + Supabase)

App **em produção** para consultores imobiliários em Portugal. Interface, comentários
e mensagens de commit em **português de Portugal**.

## Regras de trabalho (não negociáveis)

1. **Verificação final: `npm run build`** (tem de dar exit 0). Corre `tsc --noEmit` +
   `next build` — o `next build` trata regras de lint como **erros** que o `tsc` sozinho
   não apanha (ex.: `no-unused-expressions`: `ok ? a++ : b++` falha; usar `if/else`).
2. **Nunca fazer commit nem push.** O utilizador faz sempre.
3. **Migrações SQL são manuais.** Escrever SQL **idempotente** em
   `supabase/migrations/<timestamp>_<nome>.sql` e entregar sempre o comando pronto:
   ```bash
   .\scripts\apply-migration.ps1 -File supabase\migrations\<ficheiro>.sql
   ```
   (o script aplica a **todas** as instâncias). Dizer se a migração tem de ser aplicada
   **antes** do deploy.
4. **Está em produção**: mudanças pequenas, verificadas, reversíveis. Entregar sempre um
   **checklist de verificação** para o utilizador testar antes de publicar.
5. **A IA nunca envia emails a clientes sozinha** — propõe, o consultor confirma.
6. Segredos em `scripts/*.local.sql` (gitignored). Nunca expor chaves em logs/erros.

## Arquitetura

- **Next.js 15 (pages router)** + TypeScript + Tailwind/shadcn + Supabase.
- **Multi-instância**: 1 repositório → N projetos Vercel, cada um com a **sua** base de
  dados Supabase. Nada pode assumir uma instância única.
- `src/pages/api/**` — endpoints; `src/lib/server/**` — lógica de servidor (service-role);
  `src/services/**` — acesso a dados do lado do cliente; `src/features/**` — UI por domínio.
- **Crons** em `vercel.json`, protegidos por `CRON_SECRET`
  (`req.headers.authorization !== \`Bearer ${process.env.CRON_SECRET}\``), `maxDuration` 60.

### Supabase — padrões
- **Cliente**: `src/integrations/supabase/client` (respeita RLS).
- **Servidor**: `supabaseAdmin` (`src/lib/supabaseAdmin`) ou `createClient(...SERVICE_ROLE...)`.
  Autenticar sempre pelo token do utilizador antes de usar service-role:
  ```ts
  const token = req.headers.authorization?.split(" ")[1];
  const { data: { user } } = await supabaseAdmin.auth.getUser(token);
  ```
- **A BD viva diverge das migrações** (drift do RLS). Se uma leitura vier vazia mas a
  escrita funcionar, suspeitar de policy em falta — a solução usada é ler/escrever por
  endpoint com service-role, limitado ao `user.id` do token.
- Tabelas recentes **não estão nos tipos gerados** → usar `supabase.from("x" as any)` ou
  `(supabaseAdmin as any)`. Um `.select()` com coluna desconhecida dá
  `TS2589: Type instantiation is excessively deep` — destipar a query resolve.

## Notas específicas (poupam tempo)

- **PDF (jsPDF)**: fontes standard só suportam WinAnsi. Passar tudo por `pdfSafeText()`
  (`src/lib/pdfDocument.ts`) — setas `→` e espaços especiais do `toLocaleString` saem como
  lixo e desalinham a linha.
- **Email em massa**: sai **sempre pelo SMTP do consultor** (o Resend/ESP foi removido —
  não é possível enviar como `@remax.pt` sem domínio verificado). O ritmo (lotes, msg/s,
  cooldown) configura-se em Admin › Envio em Massa.
- **ifthenpay** (substituiu a EuPago, 2026-08): **uma chave por método** (MB WAY, Multibanco,
  Cartão — contrato à parte para cada), sem sandbox (mesmo URL para testes e produção). O
  callback é **GET** com parâmetros na query string (`val`/`oid`/`tid`/`ref`/`apk`), não POST
  com corpo — o oposto da EuPago. Regista o URL de callback no backoffice da ifthenpay, por
  chave. Ver `src/lib/ifthenpay.ts`.
- **IA**: `runAI()` (`src/lib/ai/provider`) regista custo em `ai_usage_logs`. A chave usada
  depende do plano (`subscription_plans.ai_included`): plano com IA → chave da agência;
  senão → chave própria do consultor, sem reserva.
- **Datas**: fuso `Europe/Lisbon` (não UTC) em tudo o que é agenda/lembretes.

## Memória

O contexto detalhado de cada funcionalidade (decisões, bugs corrigidos, gotchas) está na
memória do projeto em `~/.claude/projects/C--Github-VyxaOne/memory/` — consultar antes de
reimplementar algo que possa já existir.

Essa pasta é uma junction para `OneDrive\Work\Work\10 Vyxa\Memória` (vault do Obsidian).
O repositório trabalha-se em `C:\Github\VyxaOne` — nunca dentro do OneDrive.

## Sobre o Eduardo Santos

Eduardo (eduardo.santos@archerycoach.pt) é consultor imobiliário (RE/MAX) e fundador da Vyxa. Não é engenheiro de infra — em tarefas de DevOps precisa de orientação passo-a-passo. Faz ele próprio os commits/push de git e as migrações SQL — nunca as faças por ele sem pedir.

**Como trabalha:** organiza-se por blocos de tempo agendados; rende mais ao fim do dia/noite. Perante decisões difíceis, começa pelo panorama geral antes dos detalhes. Confortável com risco calculado. Tira-lhe energia: reuniões desnecessárias, pedidos pouco claros, interrupções constantes.

**Valores:** honestidade direta e rigor/qualidade acima de velocidade são inegociáveis, mesmo quando incómodo. Sucesso = feito com rigor, sem erros. Perante erros (seus ou teus), foca-se em corrigir rápido e seguir em frente.

**Como comunicar:** trata-o pelo nome próprio, tom de colega — nunca corporativo. Ajusta a extensão da resposta ao assunto (conciso no simples, detalhado quando a decisão importa). Se discordares de algo que ele pediu, diz isso diretamente e explica porquê — não fiques em silêncio nem só apresentes alternativas neutras.

**Autonomia:** confirma sempre antes de enviar mensagens/emails em nome dele, apagar ou alterar ficheiros importantes, tomar decisões financeiras, incluir preços/descontos/ofertas/prazos em documentos para clientes que ele não tenha aprovado explicitamente para aquele documento (encontrar um valor numa nota de estratégia não é aprovação — ver `feedback-nao-decidir-condicoes-comerciais-sem-aprovacao.md`), ou assumir factos sem verificar. Fora isso, podes agir livremente em tarefas pequenas e reversíveis.

**Missão:** curto prazo, recuperar financeiramente; médio prazo, autonomia financeira — o imobiliário estável e com continuidade, a Vyxa a gerar rendimento passivo e escalável sem lhe consumir muito tempo.

_Perfil completo e sempre atualizado: `user-eduardo-santos.md` e `reference-identidade-e-comunicacao.md` no vault Obsidian (OneDrive\Work\Work\10 Vyxa\Memória)._
