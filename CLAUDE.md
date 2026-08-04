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
- **EuPago**: MBWay e Cartão usam a API REST v1.02 (corpo **aninhado**, `payment.amount.value`);
  o **Multibanco** usa a API **clássica** (`/clientes/rest_api`, corpo plano `chave/valor/id`).
  Não são intermutáveis.
- **IA**: `runAI()` (`src/lib/ai/provider`) regista custo em `ai_usage_logs`. A chave usada
  depende do plano (`subscription_plans.ai_included`): plano com IA → chave da agência;
  senão → chave própria do consultor, sem reserva.
- **Datas**: fuso `Europe/Lisbon` (não UTC) em tudo o que é agenda/lembretes.

## Memória

O contexto detalhado de cada funcionalidade (decisões, bugs corrigidos, gotchas) está na
memória do projeto em `~/.claude/projects/C--Github-VyxaOne/memory/` — consultar antes de
reimplementar algo que possa já existir.
