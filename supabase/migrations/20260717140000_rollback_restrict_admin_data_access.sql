-- ROLLBACK de 20260717140000_restrict_admin_data_access.sql
-- Repõe o estado anterior: o admin volta a ver/gerir todos os dados
-- (get_visible_user_ids devolve todos para broker+admin; as 11 políticas
-- voltam a usar is_admin()). Correr só se for preciso reverter.
--
-- Reproduz EXATAMENTE os quais que estavam na BD viva antes da migração.

-- 1. get_visible_user_ids(): broker+admin voltam a ver todos.
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

  if v_role in ('broker', 'admin') then
    return array(select id from profiles);
  end if;

  if v_role = 'team_lead' then
    return array(
      select id from profiles
      where id = auth.uid()
         or manager_id = auth.uid()
         or team_lead_id = auth.uid()
    );
  end if;

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

-- 2. Políticas de dados: voltar a is_admin().
drop policy if exists "delete_leads_owner_or_admin" on public.leads;
create policy "delete_leads_owner_or_admin" on public.leads
  for delete using ((auth.uid() = user_id) or is_admin());

drop policy if exists "delete_contacts_owner_or_admin" on public.contacts;
create policy "delete_contacts_owner_or_admin" on public.contacts
  for delete using ((auth.uid() = user_id) or is_admin());

drop policy if exists "delete_properties_owner_or_admin" on public.properties;
create policy "delete_properties_owner_or_admin" on public.properties
  for delete using ((auth.uid() = user_id) or is_admin());

drop policy if exists "delete_calendar_events_owner_or_admin" on public.calendar_events;
create policy "delete_calendar_events_owner_or_admin" on public.calendar_events
  for delete using ((auth.uid() = user_id) or is_admin());

drop policy if exists "delete_developments_owner_or_admin" on public.developments;
create policy "delete_developments_owner_or_admin" on public.developments
  for delete using ((auth.uid() = user_id) or is_admin());

drop policy if exists "Users can delete own documents or admin" on public.documents;
create policy "Users can delete own documents or admin" on public.documents
  for delete using ((auth.uid() = user_id) or is_admin());

drop policy if exists "delete_interactions_owner_or_admin" on public.interactions;
create policy "delete_interactions_owner_or_admin" on public.interactions
  for delete using ((auth.uid() = user_id) or is_admin());

drop policy if exists "update_interactions_hierarchy" on public.interactions;
create policy "update_interactions_hierarchy" on public.interactions
  for update using ((auth.uid() = user_id) or is_admin());

drop policy if exists "select_interactions_hierarchy" on public.interactions;
create policy "select_interactions_hierarchy" on public.interactions
  for select using (
    can_access_record(user_id)
    or is_admin()
    or (exists (
      select 1 from leads l
      where l.id = interactions.lead_id
        and (can_access_record(l.user_id) or (l.assigned_to is not null and can_access_record(l.assigned_to)))
    ))
  );

drop policy if exists "Users can delete own lead notes or admin" on public.lead_notes;
create policy "Users can delete own lead notes or admin" on public.lead_notes
  for delete using ((auth.uid() = created_by) or is_admin());

drop policy if exists "Users can update accessible lead notes" on public.lead_notes;
create policy "Users can update accessible lead notes" on public.lead_notes
  for update using ((auth.uid() = created_by) or is_admin());

-- 3. profiles: repor a política original (sem o OR is_admin() extra).
drop policy if exists "profiles_select_scoped" on public.profiles;
create policy "profiles_select_scoped" on public.profiles
  for select using (
    id = auth.uid()
    or id = any (get_visible_user_ids())
  );

-- Nota: is_agency_manager() pode ficar (não é usada por ninguém após o
-- rollback). Para remover: drop function if exists public.is_agency_manager();
