-- ============================================================
-- Envio de emails em massa EM SEGUNDO PLANO (fila + worker)
--
-- Antes, o envio em massa corria no browser (um pedido por destinatário),
-- prendendo o utilizador na página até ao fim e parando se ele navegasse
-- para fora. Passa agora a uma fila no servidor: ao carregar em enviar, os
-- destinatários entram nesta tabela e um worker envia-os em segundo plano,
-- gradualmente, com o progresso a refletir-se nas colunas de contagem da
-- campanha (bulk_email_campaigns) — que o "Histórico de envios" já mostra.
--
-- Idempotente: pode ser aplicada mais do que uma vez sem efeito.
-- ============================================================

-- 1. A campanha passa a guardar o MODELO do email (para o worker o compor por
--    destinatário) e o estado do processamento.
alter table public.bulk_email_campaigns
  add column if not exists body_html text,
  add column if not exists attachments jsonb not null default '[]'::jsonb,
  add column if not exists copy_to_email text,
  add column if not exists copy_sent boolean not null default false,
  add column if not exists status text not null default 'completed';
-- Nota: default 'completed' para as linhas antigas (já enviadas) não ficarem
-- eternamente "por processar". As novas campanhas são criadas como 'queued'.

-- 2. A fila: uma linha por destinatário por enviar.
create table if not exists public.bulk_email_queue (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.bulk_email_campaigns(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,

  to_email text not null,
  recipient_name text,
  -- Variáveis a substituir no modelo, por destinatário (mala-direta).
  vars jsonb not null default '{}'::jsonb,
  -- Para registar a interação na lead/contacto quando aplicável.
  lead_id uuid,
  contact_id uuid,

  status text not null default 'pending', -- pending | processing | sent | failed
  attempts integer not null default 0,
  error text,

  created_at timestamptz not null default now(),
  -- Momento em que o worker reivindicou a linha (status→processing). Usado
  -- para recuperar linhas presas SEM repor as que estão a ser enviadas agora.
  claimed_at timestamptz,
  sent_at timestamptz
);

-- Colunas acrescentadas via ALTER (idempotente) para apanharem também as bases
-- onde a tabela já foi criada por uma versão anterior desta migração.
alter table public.bulk_email_queue
  add column if not exists claimed_at timestamptz,
  -- Não tentar antes desta hora: usado para recuar após um erro TEMPORÁRIO do
  -- SMTP (ex.: "exceeded the hourly outbound message limit" / 450 / IHL), em
  -- vez de marcar o email como falhado definitivo.
  add column if not exists next_attempt_at timestamptz;

create index if not exists idx_bulk_email_queue_pending
  on public.bulk_email_queue (status, campaign_id)
  where status in ('pending', 'processing');

create index if not exists idx_bulk_email_queue_campaign
  on public.bulk_email_queue (campaign_id);

alter table public.bulk_email_queue enable row level security;

-- O worker corre com a service_role (ignora RLS). Aos utilizadores só
-- permitimos LER a sua própria fila (o broker/admin vê tudo, como no resto).
drop policy if exists "bulk_email_queue_select" on public.bulk_email_queue;
create policy "bulk_email_queue_select"
  on public.bulk_email_queue for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('broker', 'admin', 'team_lead')
    )
  );
