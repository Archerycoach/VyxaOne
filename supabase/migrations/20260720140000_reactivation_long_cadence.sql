-- Cadência longa de reativação de leads frias.
--
-- Antes: 3 emails em 7 dias e a lead era arquivada. Pouco tempo para alguém
-- que está a decidir uma compra de casa — um processo de meses.
--
-- Agora: até 6 emails espaçados ao longo de ~6 meses (dia 0, +7, +21, +45,
-- +90, +180), cada um escrito pela IA com um ângulo diferente. No fim, a lead
-- NÃO é arquivada em silêncio: volta ao Radar para o consultor decidir.
--
-- Porque não uma sequência indefinida: manter alguém a receber emails para
-- sempre por nunca ter dito "não" inverte a lógica do consentimento (RGPD,
-- Art. 5.º) e destrói a reputação do domínio de envio — a partir de ~7 emails
-- sem abertura, o Gmail e o Outlook começam a penalizar TODO o correio do
-- domínio, incluindo o dirigido a clientes ativos.
--
-- reactivation_angles_used  → ângulos já usados, para a IA nunca repetir
-- reactivation_next_at      → quando está prevista a próxima tentativa
-- reactivation_started_at   → início da sequência (base para a cadência)
--
-- Idempotente: pode ser aplicada mais do que uma vez sem erro.

-- Contador PRÓPRIO dos emails de reativação.
--
-- Antes, o email a enviar era decidido contando registos em
-- automated_email_log — uma tabela partilhada por todos os envios
-- automáticos. Se essa contagem falhasse, o código caía no
-- reactivation_attempts, que é partilhado com o WhatsApp e podia estar à
-- frente: a lead recebia o "última mensagem" como PRIMEIRO email.
--
-- Este contador conta só emails de reativação, por lead. É a fonte de
-- verdade da sequência.
alter table public.leads
  add column if not exists reactivation_emails_sent integer not null default 0;

alter table public.leads
  add column if not exists reactivation_angles_used text[] default '{}';

alter table public.leads
  add column if not exists reactivation_next_at timestamptz;

alter table public.leads
  add column if not exists reactivation_started_at timestamptz;

-- O cron procura leads cuja próxima tentativa já venceu.
create index if not exists idx_leads_reactivation_next
  on public.leads(reactivation_next_at)
  where reactivation_next_at is not null and archived_at is null;

-- Retropreenchimento: leads que já receberam emails de reativação ficam com
-- o contador certo, para não recomeçarem a sequência do princípio.
-- Idempotente: só preenche onde ainda está a 0.
update public.leads l
set reactivation_emails_sent = sub.total
from (
  select lead_id, count(*)::int as total
  from public.automated_email_log
  where source = 'lead_reactivation'
    and status = 'sent'
    and subject not ilike '[TESTE]%'
    and lead_id is not null
  group by lead_id
) sub
where l.id = sub.lead_id
  and l.reactivation_emails_sent = 0;

comment on column public.leads.reactivation_emails_sent is
  'Nº de emails de reativação enviados a esta lead. Fonte de verdade da sequência (não usa contadores partilhados).';
comment on column public.leads.reactivation_angles_used is
  'Ângulos de email já usados nesta sequência, para a IA variar a abordagem.';
comment on column public.leads.reactivation_next_at is
  'Data prevista da próxima tentativa de reativação.';
comment on column public.leads.reactivation_started_at is
  'Início da sequência de reativação, base para calcular a cadência.';
