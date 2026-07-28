-- ============================================================================
-- Idealista: escolha de fornecedor (idealista2 / idealista17) com fallback.
--
-- Cria o setting `idealista_provider` (se ainda não existir), com valor por
-- defeito "auto": tenta o idealista2 e, se der erro, recorre ao idealista17.
-- Valores possíveis: "auto" | "idealista2" | "idealista17".
--
-- Idempotente: pode ser aplicado a todas as bases sem risco. NÃO sobrescreve
-- uma escolha já feita (do conflito, mantém o valor existente).
--   .\scripts\apply-migration.ps1 supabase\migrations\20260728120000_idealista_provider.sql
-- ============================================================================

insert into public.system_settings (key, value)
values ('idealista_provider', to_jsonb('auto'::text))
on conflict (key) do nothing;
