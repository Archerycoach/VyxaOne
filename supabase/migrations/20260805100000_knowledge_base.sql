-- ============================================================================
-- Base de Conhecimento (RAG) — documentos que a IA consulta antes de responder.
--
-- Dois âmbitos, ambos suportados:
--   'user'   → documento privado do consultor (só ele o vê e só a ele serve).
--   'agency' → documento da agência/instância, partilhado por toda a gente.
--              Só broker/admin (is_agency_manager()) pode criar ou alterar.
--
-- Cada documento é dividido em pedaços (knowledge_chunks) e cada pedaço tem o
-- seu embedding. Mantemos os DOIS espaços vetoriais (OpenAI 1536 e Google 768),
-- exatamente como no lead_memory e no property_embeddings, porque a Anthropic
-- não tem API de embeddings própria e o espaço usado depende da chave do
-- consultor.
--
-- content_hash no documento evita voltar a gerar (e a pagar) os embeddings de
-- um documento que não mudou — mesmo padrão do property_embeddings.
--
-- Idempotente: pode ser aplicada mais do que uma vez sem erro.
--   .\scripts\apply-migration.ps1 -File supabase\migrations\20260805100000_knowledge_base.sql
-- ============================================================================

create extension if not exists vector;

-- ── Documentos ──────────────────────────────────────────────────────────────

create table if not exists public.knowledge_docs (
  id uuid primary key default gen_random_uuid(),

  -- Quem o carregou. Nos documentos de agência é o gestor que o criou; a
  -- visibilidade não depende dele (ver scope).
  user_id uuid not null references public.profiles(id) on delete cascade,

  -- 'user' | 'agency'
  scope text not null default 'user',

  title text not null,
  -- 'upload' | 'text'
  source text not null default 'text',
  file_name text,
  mime_type text,

  -- Texto integral já extraído (o ficheiro original não é guardado).
  content text not null,
  content_hash text not null,
  char_count integer not null default 0,

  -- 'pending' | 'indexed' | 'failed'
  status text not null default 'pending',
  error text,
  chunk_count integer not null default 0,

  tags text[] not null default '{}',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint knowledge_docs_scope_check check (scope in ('user', 'agency')),
  constraint knowledge_docs_status_check check (status in ('pending', 'indexed', 'failed'))
);

create index if not exists idx_knowledge_docs_user
  on public.knowledge_docs(user_id, created_at desc);

create index if not exists idx_knowledge_docs_scope
  on public.knowledge_docs(scope);

-- Não vale a pena indexar duas vezes o mesmo conteúdo no mesmo âmbito.
create unique index if not exists idx_knowledge_docs_hash
  on public.knowledge_docs(user_id, scope, content_hash);

-- ── Pedaços com embedding ───────────────────────────────────────────────────

create table if not exists public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  doc_id uuid not null references public.knowledge_docs(id) on delete cascade,

  -- Desnormalizados de propósito: a pesquisa filtra por eles sem precisar do
  -- join, e o join só serve depois para ir buscar o título.
  user_id uuid not null references public.profiles(id) on delete cascade,
  scope text not null default 'user',

  chunk_index integer not null,
  content text not null,

  embedding vector(1536),
  embedding_google vector(768),

  created_at timestamptz not null default now(),

  constraint knowledge_chunks_scope_check check (scope in ('user', 'agency'))
);

create index if not exists idx_knowledge_chunks_doc
  on public.knowledge_chunks(doc_id, chunk_index);

create index if not exists idx_knowledge_chunks_user
  on public.knowledge_chunks(user_id);

create index if not exists idx_knowledge_chunks_vec
  on public.knowledge_chunks using hnsw (embedding vector_cosine_ops);

create index if not exists idx_knowledge_chunks_vec_google
  on public.knowledge_chunks using hnsw (embedding_google vector_cosine_ops);

-- ── RLS ─────────────────────────────────────────────────────────────────────
--
-- A escrita é feita pelo servidor (service role, que ignora RLS) depois de
-- autenticar pelo token e de validar o âmbito. As policies abaixo existem para
-- a leitura no cliente e como rede de segurança.

alter table public.knowledge_docs enable row level security;
alter table public.knowledge_chunks enable row level security;

drop policy if exists "select knowledge docs" on public.knowledge_docs;
create policy "select knowledge docs" on public.knowledge_docs
  for select using (
    user_id = auth.uid()
    or scope = 'agency'
    or can_access_record(user_id)
  );

-- Documento de agência só pode ser criado por quem gere a agência.
drop policy if exists "insert knowledge docs" on public.knowledge_docs;
create policy "insert knowledge docs" on public.knowledge_docs
  for insert with check (
    user_id = auth.uid()
    and (scope = 'user' or is_agency_manager())
  );

drop policy if exists "update knowledge docs" on public.knowledge_docs;
create policy "update knowledge docs" on public.knowledge_docs
  for update using (
    (user_id = auth.uid() and scope = 'user') or is_agency_manager()
  );

drop policy if exists "delete knowledge docs" on public.knowledge_docs;
create policy "delete knowledge docs" on public.knowledge_docs
  for delete using (
    (user_id = auth.uid() and scope = 'user') or is_agency_manager()
  );

drop policy if exists "select knowledge chunks" on public.knowledge_chunks;
create policy "select knowledge chunks" on public.knowledge_chunks
  for select using (
    user_id = auth.uid()
    or scope = 'agency'
    or can_access_record(user_id)
  );

-- ── Pesquisa por semelhança ─────────────────────────────────────────────────
--
-- Aceita um embedding de qualquer um dos espaços e usa o que for fornecido —
-- mesma convenção do match_lead_memory e do match_properties.
--
-- Devolve o que o consultor pode ver: os documentos dele mais os da agência.

create or replace function match_knowledge(
  p_user_id uuid,
  p_query_embedding vector(1536) default null,
  p_query_embedding_google vector(768) default null,
  p_match_count int default 6,
  p_min_similarity float default 0.0
)
returns table (
  doc_id uuid,
  title text,
  scope text,
  content text,
  similarity float
)
language plpgsql
as $$
begin
  if p_query_embedding is not null then
    return query
    select
      kc.doc_id,
      kd.title,
      kc.scope,
      kc.content,
      1 - (kc.embedding <=> p_query_embedding) as similarity
    from public.knowledge_chunks kc
    join public.knowledge_docs kd on kd.id = kc.doc_id
    where (kc.scope = 'agency' or kc.user_id = p_user_id)
      and kc.embedding is not null
      and 1 - (kc.embedding <=> p_query_embedding) >= p_min_similarity
    order by kc.embedding <=> p_query_embedding
    limit p_match_count;

  elsif p_query_embedding_google is not null then
    return query
    select
      kc.doc_id,
      kd.title,
      kc.scope,
      kc.content,
      1 - (kc.embedding_google <=> p_query_embedding_google) as similarity
    from public.knowledge_chunks kc
    join public.knowledge_docs kd on kd.id = kc.doc_id
    where (kc.scope = 'agency' or kc.user_id = p_user_id)
      and kc.embedding_google is not null
      and 1 - (kc.embedding_google <=> p_query_embedding_google) >= p_min_similarity
    order by kc.embedding_google <=> p_query_embedding_google
    limit p_match_count;
  end if;
end;
$$;

grant execute on function match_knowledge to authenticated;

notify pgrst, 'reload schema';
