-- Proteção de dados — PARTE 2 (complemento de 20260717140000).
--
-- A parte 1 tratou as políticas que davam acesso ao admin via is_admin() e
-- get_visible_user_ids(). Faltavam tabelas cujas políticas usam um check
-- INLINE `role IN ('broker','admin', ...)` — não apanhado pelo inventário
-- anterior. É por isso que o admin ainda via as TAREFAS.
--
-- Tabelas de dados/atividade de clientes onde o admin (operador) é removido,
-- mantendo broker e team_lead onde já existiam:
--   tasks, deals, goals, radar_items, image_uploads.
-- (Config/contas — subscriptions, payment_history, meta_app_settings,
--  frontend_settings, org_ai_keys, lead_columns_config, profiles — ficam
--  intactas: o admin mantém configuração.)
--
-- Transformação: reproduzir cada política EXATAMENTE, apenas removendo
-- 'admin' do array de papéis. Idempotente. Rollback ao lado.

-- ============================================================
-- tasks (SELECT / UPDATE / DELETE)
-- ============================================================
drop policy if exists "select_tasks_hierarchy" on public.tasks;
create policy "select_tasks_hierarchy" on public.tasks
  for select using (
    (auth.uid() = user_id)
    or (auth.uid() = assigned_to)
    or (exists (select 1 from profiles where profiles.id = auth.uid() and (profiles.role)::text = any (array['broker'::text])))
    or ((exists (select 1 from profiles where profiles.id = auth.uid() and (profiles.role)::text = 'team_lead'::text))
        and ((exists (select 1 from profiles o where o.id = tasks.user_id and (o.team_lead_id = auth.uid() or o.manager_id = auth.uid())))
             or (exists (select 1 from profiles a where a.id = tasks.assigned_to and (a.team_lead_id = auth.uid() or a.manager_id = auth.uid())))))
  );

drop policy if exists "update_tasks_hierarchy" on public.tasks;
create policy "update_tasks_hierarchy" on public.tasks
  for update using (
    (auth.uid() = user_id)
    or (auth.uid() = assigned_to)
    or (exists (select 1 from profiles where profiles.id = auth.uid() and (profiles.role)::text = any (array['broker'::text])))
    or ((exists (select 1 from profiles where profiles.id = auth.uid() and (profiles.role)::text = 'team_lead'::text))
        and ((exists (select 1 from profiles o where o.id = tasks.user_id and (o.team_lead_id = auth.uid() or o.manager_id = auth.uid())))
             or (exists (select 1 from profiles a where a.id = tasks.assigned_to and (a.team_lead_id = auth.uid() or a.manager_id = auth.uid())))))
  );

drop policy if exists "delete_tasks_owner_or_admin" on public.tasks;
create policy "delete_tasks_owner_or_admin" on public.tasks
  for delete using (
    (auth.uid() = user_id)
    or (exists (select 1 from profiles where profiles.id = auth.uid() and (profiles.role)::text = any (array['broker'::text])))
  );

-- ============================================================
-- deals (SELECT "ver todos") — remover admin, manter broker + team_lead
-- ============================================================
drop policy if exists "Admins can view all deals" on public.deals;
create policy "Admins can view all deals" on public.deals
  for select using (
    exists (select 1 from profiles where profiles.id = auth.uid()
            and profiles.role = any (array['broker'::user_role, 'team_lead'::user_role]))
  );

-- ============================================================
-- goals (ALL gerir metas de equipa / SELECT ver todas)
-- ============================================================
drop policy if exists "Admins and team leads can manage team goals" on public.goals;
create policy "Admins and team leads can manage team goals" on public.goals
  for all using (
    (goal_type = 'team'::text)
    and (exists (select 1 from profiles where profiles.id = auth.uid()
                 and (profiles.role)::text = any (array['broker'::text, 'team_lead'::text])))
  );

drop policy if exists "Admins and team leads can view all goals" on public.goals;
create policy "Admins and team leads can view all goals" on public.goals
  for select using (
    (exists (select 1 from profiles where profiles.id = auth.uid()
             and (profiles.role)::text = any (array['broker'::text, 'team_lead'::text])))
    or (user_id = auth.uid())
  );

-- ============================================================
-- image_uploads (SELECT "ver todos") — só broker
-- ============================================================
drop policy if exists "Admins can view all uploads" on public.image_uploads;
create policy "Admins can view all uploads" on public.image_uploads
  for select using (
    exists (select 1 from profiles where profiles.id = auth.uid()
            and (profiles.role)::text = any (array['broker'::text]))
  );

-- ============================================================
-- radar_items (SELECT admin) — só broker
-- ============================================================
drop policy if exists "radar admin read" on public.radar_items;
create policy "radar admin read" on public.radar_items
  for select using (
    exists (select 1 from profiles where profiles.id = auth.uid()
            and profiles.role = any (array['broker'::user_role]))
  );
