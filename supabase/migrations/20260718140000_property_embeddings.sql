-- Matching semântico de imóveis.
--
-- Guarda um embedding por imóvel (o mesmo padrão já usado no lead_memory,
-- incluindo os dois espaços vetoriais: OpenAI 1536 e Google 768, porque a
-- Anthropic não tem API de embeddings própria).
--
-- Permite procurar imóveis a partir de linguagem natural — "luminoso, com
-- vistas e espaço para escritório" — em vez de filtros rígidos.
--
-- content_hash evita voltar a gerar (e a pagar) o embedding de um imóvel que
-- não mudou.
--
-- Idempotente: pode ser aplicada mais do que uma vez sem erro.

create extension if not exists vector;

create table if not exists public.property_embeddings (
  property_id uuid primary key references public.properties(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  content_hash text not null,
  embedding vector(1536),
  embedding_google vector(768),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_property_embeddings_user
  on public.property_embeddings(user_id);

create index if not exists idx_property_embeddings_vec
  on public.property_embeddings using hnsw (embedding vector_cosine_ops);

create index if not exists idx_property_embeddings_vec_google
  on public.property_embeddings using hnsw (embedding_google vector_cosine_ops);

alter table public.property_embeddings enable row level security;

drop policy if exists "select own property embeddings" on public.property_embeddings;
create policy "select own property embeddings" on public.property_embeddings
  for select using (user_id = auth.uid() or can_access_record(user_id));

-- Escrita é feita pelo servidor (service role, que ignora RLS).
drop policy if exists "insert own property embeddings" on public.property_embeddings;
create policy "insert own property embeddings" on public.property_embeddings
  for insert with check (user_id = auth.uid());

drop policy if exists "update own property embeddings" on public.property_embeddings;
create policy "update own property embeddings" on public.property_embeddings
  for update using (user_id = auth.uid());

-- Pesquisa por semelhança. Aceita um embedding de qualquer um dos espaços;
-- usa o que for fornecido (mesma convenção do match_lead_memory).
create or replace function match_properties(
  p_user_id uuid,
  p_query_embedding vector(1536) default null,
  p_query_embedding_google vector(768) default null,
  p_match_count int default 10,
  p_min_similarity float default 0.0
)
returns table (
  property_id uuid,
  content text,
  similarity float
)
language plpgsql
as $$
begin
  if p_query_embedding is not null then
    return query
    select
      pe.property_id,
      pe.content,
      1 - (pe.embedding <=> p_query_embedding) as similarity
    from public.property_embeddings pe
    where pe.user_id = p_user_id
      and pe.embedding is not null
      and 1 - (pe.embedding <=> p_query_embedding) >= p_min_similarity
    order by pe.embedding <=> p_query_embedding
    limit p_match_count;

  elsif p_query_embedding_google is not null then
    return query
    select
      pe.property_id,
      pe.content,
      1 - (pe.embedding_google <=> p_query_embedding_google) as similarity
    from public.property_embeddings pe
    where pe.user_id = p_user_id
      and pe.embedding_google is not null
      and 1 - (pe.embedding_google <=> p_query_embedding_google) >= p_min_similarity
    order by pe.embedding_google <=> p_query_embedding_google
    limit p_match_count;
  end if;
end;
$$;

grant execute on function match_properties to authenticated;
