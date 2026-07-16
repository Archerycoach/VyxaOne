-- Igualização de schemas entre TODAS as bases (fecho do drift detetado pelo
-- scripts/compare-db-schemas.ps1 em 2026-07-16):
--
-- Base ymxttvcmalpsdguednqw (em atraso):
--   - extensões vector/pg_trgm/pg_cron/pg_net em falta
--   - tabela lead_memory (memória de IA, migração 20260626151337) em falta
-- Base ykkorjrxomtevcdlyaan (referência):
--   - coluna embedding_google + match_lead_memory novo (migração 20260709170000)
--     nunca aplicados
--   - sem a salvaguarda rls_auto_enable/ensure_rls (ativa RLS automaticamente
--     em tabelas novas do schema public) que a outra base tem
--
-- TUDO idempotente e condicional: pode correr em qualquer base, em qualquer
-- estado, quantas vezes for preciso. Aplicar com scripts/apply-migration.ps1.

-- ============================================================
-- 1. Extensões
-- ============================================================
-- vector em "public" (é onde a referência o tem — as funções pgvector vivem
-- no schema public); pg_trgm no schema "extensions" (convenção Supabase).
create extension if not exists vector with schema public;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ============================================================
-- 2. Tabela lead_memory (memória de longo prazo da IA)
-- ============================================================
create table if not exists public.lead_memory (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  source text not null,
  content text not null,
  embedding vector(1536),
  created_at timestamptz default now()
);

-- Coluna para embeddings Google/Gemini (768 dim) — em falta em AMBAS as bases.
alter table public.lead_memory
  add column if not exists embedding_google vector(768);

-- Índices (nomes exatamente como na referência + os desta ronda de performance)
create index if not exists idx_lead_memory_lead_id on public.lead_memory (lead_id);
create index if not exists idx_lead_memory_user_id on public.lead_memory (user_id);
create index if not exists idx_lead_memory_created_at on public.lead_memory (created_at desc);
create index if not exists idx_lead_memory_lead on public.lead_memory (lead_id, created_at desc);
create index if not exists idx_lead_memory_embedding on public.lead_memory
  using hnsw (embedding vector_cosine_ops);
create index if not exists idx_lead_memory_embedding_google on public.lead_memory
  using hnsw (embedding_google vector_cosine_ops);

-- RLS + políticas (condicionais — CREATE POLICY não tem IF NOT EXISTS)
alter table public.lead_memory enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'lead_memory' and policyname = 'select_own_memory') then
    create policy "select_own_memory" on public.lead_memory for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'lead_memory' and policyname = 'insert_own_memory') then
    create policy "insert_own_memory" on public.lead_memory for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'lead_memory' and policyname = 'update_own_memory') then
    create policy "update_own_memory" on public.lead_memory for update using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'lead_memory' and policyname = 'delete_own_memory') then
    create policy "delete_own_memory" on public.lead_memory for delete using (auth.uid() = user_id);
  end if;
end $$;

-- ============================================================
-- 3. match_lead_memory — versão atual (OpenAI 1536 + Google 768)
-- ============================================================
-- Remove as assinaturas antigas que possam existir e cria a definitiva.
drop function if exists match_lead_memory(uuid, vector, int);
drop function if exists match_lead_memory(uuid, vector, vector, int);

create function match_lead_memory(
  p_lead_id uuid,
  p_query_embedding vector(1536) default null,
  p_query_embedding_google vector(768) default null,
  p_match_count int default 5
)
returns table (
  id uuid,
  lead_id uuid,
  source text,
  content text,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select * from (
    select
      lm.id,
      lm.lead_id,
      lm.source,
      lm.content,
      1 - (lm.embedding <=> p_query_embedding) as similarity
    from lead_memory lm
    where lm.lead_id = p_lead_id
      and lm.embedding is not null
      and p_query_embedding is not null

    union all

    select
      lm.id,
      lm.lead_id,
      lm.source,
      lm.content,
      1 - (lm.embedding_google <=> p_query_embedding_google) as similarity
    from lead_memory lm
    where lm.lead_id = p_lead_id
      and lm.embedding_google is not null
      and p_query_embedding_google is not null
  ) combined
  order by similarity desc
  limit p_match_count;
end;
$$;

grant execute on function match_lead_memory to authenticated;

-- ============================================================
-- 4. Salvaguarda RLS automática (replicada da base pública)
-- ============================================================
-- Qualquer tabela nova criada no schema public fica automaticamente com RLS
-- ativo — rede de segurança contra tabelas criadas à mão sem RLS.
create or replace function public.rls_auto_enable()
returns event_trigger
language plpgsql
security definer
set search_path to 'pg_catalog'
as $function$
declare
  cmd record;
begin
  for cmd in
    select *
    from pg_event_trigger_ddl_commands()
    where command_tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      and object_type in ('table','partitioned table')
  loop
     if cmd.schema_name is not null and cmd.schema_name in ('public') and cmd.schema_name not in ('pg_catalog','information_schema') and cmd.schema_name not like 'pg_toast%' and cmd.schema_name not like 'pg_temp%' then
      begin
        execute format('alter table if exists %s enable row level security', cmd.object_identity);
        raise log 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      exception
        when others then
          raise log 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      end;
     else
        raise log 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     end if;
  end loop;
end;
$function$;

-- O event trigger em si (condicional; se o role não tiver privilégios para
-- criar event triggers nesta base, fica um aviso em vez de falhar tudo).
do $$
begin
  if not exists (select 1 from pg_event_trigger where evtname = 'ensure_rls') then
    begin
      create event trigger ensure_rls
        on ddl_command_end
        execute function public.rls_auto_enable();
      raise notice 'Event trigger ensure_rls criado.';
    exception
      when insufficient_privilege then
        raise notice 'AVISO: sem privilégios para criar o event trigger ensure_rls nesta base — criar manualmente no SQL Editor do Supabase.';
    end;
  end if;
end $$;
