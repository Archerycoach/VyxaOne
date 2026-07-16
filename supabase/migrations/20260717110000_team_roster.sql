-- Roster da equipa: todos os membros de uma equipa (team lead + consultores
-- com o mesmo team_lead_id) podem VER quem faz parte da equipa na página
-- "Equipa" — incluindo consultores, que até aqui não tinham acesso.
--
-- NOTA de segurança: esta função devolve apenas a LISTA de pessoas (nome,
-- email, papel, contadores agregados de leads). NÃO altera a
-- get_visible_user_ids(), que continua a controlar a visibilidade de
-- leads/contactos/imóveis (Modo Equipa / partilhas explícitas).
--
-- Visibilidade do roster:
--   broker/admin  → todos os perfis (como na get_team_overview)
--   team_lead     → o próprio + a sua equipa
--   consultant    → o próprio + o seu team lead + os colegas da mesma equipa
--   consultant sem equipa → apenas o próprio
--
-- Idempotente (create or replace).

create or replace function get_team_roster()
returns table (
  user_id uuid,
  full_name text,
  email text,
  role user_role,
  manager_id uuid,
  manager_name text,
  total_leads bigint,
  active_leads bigint,
  last_login timestamptz,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role text;
  v_team_lead_id uuid;
  visible_ids uuid[];
begin
  select p.role::text, p.team_lead_id into v_role, v_team_lead_id
  from profiles p where p.id = auth.uid();

  if v_role in ('broker', 'admin') then
    visible_ids := array(select p.id from profiles p);
  elsif v_role = 'team_lead' then
    visible_ids := array(
      select p.id from profiles p
      where p.id = auth.uid()
         or p.manager_id = auth.uid()
         or p.team_lead_id = auth.uid()
    );
  elsif v_team_lead_id is not null then
    -- Consultor com equipa: o próprio, o team lead e os colegas
    visible_ids := array(
      select p.id from profiles p
      where p.id = auth.uid()
         or p.id = v_team_lead_id
         or p.team_lead_id = v_team_lead_id
    );
  else
    visible_ids := array[auth.uid()];
  end if;

  return query
  select
    p.id,
    p.full_name,
    p.email,
    p.role,
    p.team_lead_id,
    tl.full_name,
    coalesce((select count(*) from leads l where l.assigned_to = p.id), 0),
    coalesce(
      (select count(*) from leads l
       where l.assigned_to = p.id and l.archived_at is null and l.status not in ('won', 'lost')),
      0
    ),
    u.last_sign_in_at,
    p.created_at
  from profiles p
  left join profiles tl on tl.id = p.team_lead_id
  left join auth.users u on u.id = p.id
  where p.id = any(visible_ids)
  order by p.full_name;
end;
$$;

grant execute on function get_team_roster to authenticated;
