-- ============================================================================
-- Idealista: garantir a configuração CORRETA e UNIFORME em todas as instâncias.
--
-- O que a busca (searchIdealistaProperties) realmente usa:
--   - `idealista_rapidapi_key`  → a CHAVE RapidAPI (secreta; NÃO vai aqui — é
--     distribuída pelo scripts/set-idealista-key.local.sql, aplicado a todas as
--     bases pelo apply-migration.ps1).
--   - `idealista_provider`      → "auto" (tenta idealista2 e, se falhar, cai no
--     idealista17). É o modo ROBUSTO: funciona haja qual for o fornecedor
--     subscrito, porque o fallback apanha o que estiver ativo.
-- O host/endpoint em system_settings são LEGADO (a busca usa constantes
-- fixas por fornecedor); mantêm-se aqui só canónicos, para o painel de admin
-- não mostrar valores antigos.
--
-- Força `idealista_provider` = "auto" (do update), para nenhuma instância ficar
-- com um valor em falta ou partido. Idempotente.
--   .\scripts\apply-migration.ps1 supabase\migrations\20260728160000_idealista_config_ensure.sql
-- ============================================================================

insert into public.system_settings (key, value) values
  ('idealista_provider',            to_jsonb('auto'::text)),
  ('idealista_rapidapi_host',       to_jsonb('idealista17.p.rapidapi.com'::text)),
  ('idealista_rapidapi_list_endpoint', to_jsonb('/property-search'::text))
on conflict (key) do update set value = excluded.value;
