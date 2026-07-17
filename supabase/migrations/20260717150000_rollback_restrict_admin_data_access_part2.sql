-- ROLLBACK de 20260717150000_restrict_admin_data_access_part2.sql
-- Repõe o 'admin' nas políticas inline de tasks/deals/goals/image_uploads/
-- radar_items (estado anterior). Correr só se for preciso reverter.

-- tasks
drop policy if exists "select_tasks_hierarchy" on public.tasks;
create policy "select_tasks_hierarchy" on public.tasks
  for select using (
    (auth.uid() = user_id)
    or (auth.uid() = assigned_to)
    or (exists (select 1 from profiles where profiles.id = auth.uid() and (profiles.role)::text = any (array['broker'::text, 'admin'::text])))
    or ((exists (select 1 from profiles where profiles.id = auth.uid() and (profiles.role)::text = 'team_lead'::text))
        and ((exists (select 1 from profiles o where o.id = tasks.user_id and (o.team_lead_id = auth.uid() or o.manager_id = auth.uid())))
             or (exists (select 1 from profiles a where a.id = tasks.assigned_to and (a.team_lead_id = auth.uid() or a.manager_id = auth.uid())))))
  );

drop policy if exists "update_tasks_hierarchy" on public.tasks;
create policy "update_tasks_hierarchy" on public.tasks
  for update using (
    (auth.uid() = user_id)
    or (auth.uid() = assigned_to)
    or (exists (select 1 from profiles where profiles.id = auth.uid() and (profiles.role)::text = any (array['broker'::text, 'admin'::text])))
    or ((exists (select 1 from profiles where profiles.id = auth.uid() and (profiles.role)::text = 'team_lead'::text))
        and ((exists (select 1 from profiles o where o.id = tasks.user_id and (o.team_lead_id = auth.uid() or o.manager_id = auth.uid())))
             or (exists (select 1 from profiles a where a.id = tasks.assigned_to and (a.team_lead_id = auth.uid() or a.manager_id = auth.uid())))))
  );

drop policy if exists "delete_tasks_owner_or_admin" on public.tasks;
create policy "delete_tasks_owner_or_admin" on public.tasks
  for delete using (
    (auth.uid() = user_id)
    or (exists (select 1 from profiles where profiles.id = auth.uid() and (profiles.role)::text = any (array['broker'::text, 'admin'::text])))
  );

-- deals
drop policy if exists "Admins can view all deals" on public.deals;
create policy "Admins can view all deals" on public.deals
  for select using (
    exists (select 1 from profiles where profiles.id = auth.uid()
            and profiles.role = any (array['admin'::user_role, 'broker'::user_role, 'team_lead'::user_role]))
  );

-- goals
drop policy if exists "Admins and team leads can manage team goals" on public.goals;
create policy "Admins and team leads can manage team goals" on public.goals
  for all using (
    (goal_type = 'team'::text)
    and (exists (select 1 from profiles where profiles.id = auth.uid()
                 and (profiles.role)::text = any (array['broker'::text, 'admin'::text, 'team_lead'::text])))
  );

drop policy if exists "Admins and team leads can view all goals" on public.goals;
create policy "Admins and team leads can view all goals" on public.goals
  for select using (
    (exists (select 1 from profiles where profiles.id = auth.uid()
             and (profiles.role)::text = any (array['broker'::text, 'admin'::text, 'team_lead'::text])))
    or (user_id = auth.uid())
  );

-- image_uploads
drop policy if exists "Admins can view all uploads" on public.image_uploads;
create policy "Admins can view all uploads" on public.image_uploads
  for select using (
    exists (select 1 from profiles where profiles.id = auth.uid()
            and (profiles.role)::text = any (array['broker'::text, 'admin'::text]))
  );

-- radar_items
drop policy if exists "radar admin read" on public.radar_items;
create policy "radar admin read" on public.radar_items
  for select using (
    exists (select 1 from profiles where profiles.id = auth.uid()
            and profiles.role = any (array['admin'::user_role, 'broker'::user_role]))
  );
