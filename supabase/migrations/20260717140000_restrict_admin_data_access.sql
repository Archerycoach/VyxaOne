-- Proteção de dados: o admin (operador da plataforma) deixa de ver/editar
-- dados de CLIENTES (leads, contactos, imóveis, interações, notas, agenda,
-- empreendimentos, documentos). Mantém apenas configuração (integrações,
-- planos, pagamentos) e gestão de contas (utilizadores/perfis).
--
-- O broker (dono de agência) NÃO é afetado — continua com acesso total à sua
-- agência. Só o admin fica restrito.
--
-- Princípio de prudência: NÃO se toca em is_admin() (= role IN
-- ('broker','admin')), porque também é usada por can_invite_user,
-- update_user_role, transfer_lead e pelas tabelas de config — mudá-la partiria
-- o convite/gestão de contas do admin. Em vez disso:
--   1. get_visible_user_ids(): o admin passa a "ver" só o próprio (corta o
--      SELECT/UPDATE de dados via can_access_record).
--   2. As 11 políticas de dados que davam acesso por is_admin() passam a usar
--      is_agency_manager() (só broker) — o admin sai, o broker mantém.
--   3. profiles mantém-se acessível ao admin (gestão de contas = config).
--
-- Idempotente. Rollback: 20260717140000_rollback_restrict_admin_data_access.sql

-- ============================================================
-- 1. Função: gestor de agência (broker) — acesso elevado a dados
-- ============================================================
create or replace function public.is_agency_manager()
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role::text = 'broker'
  );
$$;

-- ============================================================
-- 2. get_visible_user_ids(): admin deixa de ver todos os perfis
--    (corpo idêntico ao vivo; só muda o ramo do topo)
-- ============================================================
create or replace function public.get_visible_user_ids()
returns uuid[]
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  v_role text;
  v_team_lead_id uuid;
  v_result uuid[];
begin
  select role::text, team_lead_id into v_role, v_team_lead_id
  from profiles where id = auth.uid();

  -- Broker (dono de agência) vê todos. Admin (operador) NÃO — só o próprio.
  if v_role = 'broker' then
    return array(select id from profiles);
  end if;

  if v_role = 'admin' then
    return array[auth.uid()];
  end if;

  if v_role = 'team_lead' then
    return array(
      select id from profiles
      where id = auth.uid()
         or manager_id = auth.uid()
         or team_lead_id = auth.uid()
    );
  end if;

  -- Consultor: sempre a si próprio, mais quaisquer partilhas explícitas.
  v_result := array[auth.uid()];

  v_result := v_result || coalesce(
    (select array_agg(team_lead_id) from lead_visibility_grants where consultant_id = auth.uid()),
    array[]::uuid[]
  );

  if v_team_lead_id is not null then
    if exists (select 1 from profiles where id = v_team_lead_id and team_shares_all_leads = true) then
      v_result := v_result || v_team_lead_id;
      v_result := v_result || coalesce(
        array(select id from profiles where team_lead_id = v_team_lead_id),
        array[]::uuid[]
      );
    end if;
  end if;

  return array(select distinct unnest(v_result));
end;
$function$;

-- ============================================================
-- 3. Políticas de dados: is_admin() -> is_agency_manager()
--    (quais reproduzidos exatamente da BD viva; só muda o token)
-- ============================================================

-- leads
drop policy if exists "delete_leads_owner_or_admin" on public.leads;
create policy "delete_leads_owner_or_admin" on public.leads
  for delete using ((auth.uid() = user_id) or is_agency_manager());

-- contacts
drop policy if exists "delete_contacts_owner_or_admin" on public.contacts;
create policy "delete_contacts_owner_or_admin" on public.contacts
  for delete using ((auth.uid() = user_id) or is_agency_manager());

-- properties
drop policy if exists "delete_properties_owner_or_admin" on public.properties;
create policy "delete_properties_owner_or_admin" on public.properties
  for delete using ((auth.uid() = user_id) or is_agency_manager());

-- calendar_events
drop policy if exists "delete_calendar_events_owner_or_admin" on public.calendar_events;
create policy "delete_calendar_events_owner_or_admin" on public.calendar_events
  for delete using ((auth.uid() = user_id) or is_agency_manager());

-- developments
drop policy if exists "delete_developments_owner_or_admin" on public.developments;
create policy "delete_developments_owner_or_admin" on public.developments
  for delete using ((auth.uid() = user_id) or is_agency_manager());

-- documents
drop policy if exists "Users can delete own documents or admin" on public.documents;
create policy "Users can delete own documents or admin" on public.documents
  for delete using ((auth.uid() = user_id) or is_agency_manager());

-- interactions (DELETE, UPDATE, SELECT)
drop policy if exists "delete_interactions_owner_or_admin" on public.interactions;
create policy "delete_interactions_owner_or_admin" on public.interactions
  for delete using ((auth.uid() = user_id) or is_agency_manager());

drop policy if exists "update_interactions_hierarchy" on public.interactions;
create policy "update_interactions_hierarchy" on public.interactions
  for update using ((auth.uid() = user_id) or is_agency_manager());

drop policy if exists "select_interactions_hierarchy" on public.interactions;
create policy "select_interactions_hierarchy" on public.interactions
  for select using (
    can_access_record(user_id)
    or is_agency_manager()
    or (exists (
      select 1 from leads l
      where l.id = interactions.lead_id
        and (can_access_record(l.user_id) or (l.assigned_to is not null and can_access_record(l.assigned_to)))
    ))
  );

-- lead_notes (DELETE, UPDATE)
drop policy if exists "Users can delete own lead notes or admin" on public.lead_notes;
create policy "Users can delete own lead notes or admin" on public.lead_notes
  for delete using ((auth.uid() = created_by) or is_agency_manager());

drop policy if exists "Users can update accessible lead notes" on public.lead_notes;
create policy "Users can update accessible lead notes" on public.lead_notes
  for update using ((auth.uid() = created_by) or is_agency_manager());

-- ============================================================
-- 4. profiles: o admin mantém a gestão de contas (configuração).
--    Como get_visible_user_ids passou a devolver só o próprio para o
--    admin, é preciso o OR is_admin() (intacta) para ele listar utilizadores.
-- ============================================================
drop policy if exists "profiles_select_scoped" on public.profiles;
create policy "profiles_select_scoped" on public.profiles
  for select using (
    id = auth.uid()
    or id = any (get_visible_user_ids())
    or is_admin()
  );
