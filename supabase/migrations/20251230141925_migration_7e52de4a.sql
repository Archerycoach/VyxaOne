-- Criar política para team leads verem seus agentes
CREATE POLICY "Team leads can view their agents"
ON profiles
FOR SELECT
USING (
  public.get_current_user_role() = 'team_lead'
  AND (team_lead_id = auth.uid() OR id = auth.uid())
);