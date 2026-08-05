-- ============================================================================
-- Amostras de escrita — o sinal com que o Perfil da IA aprende.
--
-- Guarda o par (rascunho proposto pela IA, texto que o consultor realmente
-- enviou). A diferença entre os dois é o que ensina a voz dele: ninguém precisa
-- de descrever como escreve se corrigir o rascunho já o demonstra.
--
-- RGPD: estes textos são emails para clientes. Por isso o corpo é APAGADO
-- assim que a amostra é usada numa proposta de perfil (used_at preenchido) —
-- fica a lição aprendida, não a correspondência do cliente. Ver
-- /api/ai-profile/learn.
--
-- Idempotente.
--   .\scripts\apply-migration.ps1 -File supabase\migrations\20260805160000_ai_writing_samples.sql
-- ============================================================================

create table if not exists public.ai_writing_samples (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,

  -- 'lead_email' por agora; deixa espaço para outros redatores.
  kind text not null default 'lead_email',

  draft_subject text,
  draft_body text,
  sent_subject text,
  sent_body text,

  -- Quanto é que o consultor mexeu (0 = enviou tal e qual). Serve para ignorar
  -- as amostras que não ensinam nada sem ter de ler o texto.
  change_ratio numeric not null default 0,

  -- Preenchido quando a amostra já foi usada numa proposta. Nesse momento os
  -- corpos são apagados.
  used_at timestamptz,

  created_at timestamptz not null default now()
);

create index if not exists idx_ai_writing_samples_user
  on public.ai_writing_samples(user_id, used_at, created_at desc);

alter table public.ai_writing_samples enable row level security;

-- Só o próprio. Não é dado de gestão — é a correspondência dele com clientes.
drop policy if exists "select own writing samples" on public.ai_writing_samples;
create policy "select own writing samples" on public.ai_writing_samples
  for select using (user_id = auth.uid());

drop policy if exists "insert own writing samples" on public.ai_writing_samples;
create policy "insert own writing samples" on public.ai_writing_samples
  for insert with check (user_id = auth.uid());

drop policy if exists "delete own writing samples" on public.ai_writing_samples;
create policy "delete own writing samples" on public.ai_writing_samples
  for delete using (user_id = auth.uid());

notify pgrst, 'reload schema';
