-- lead_visibility_grants (team_lead_id, consultant_id) é uma tabela
-- independente: nunca era limpa quando profiles.team_lead_id mudava. Por
-- isso, ao remover um consultor da equipa (ou mudá-lo para outra), ele
-- continuava a ver as leads do antigo team lead através do grant que
-- ficou "pendurado". Um trigger na própria tabela profiles garante que
-- isto é limpo seja qual for o caminho usado para mudar de equipa
-- (team.tsx -> assign_consultant_to_manager, ou admin/users.tsx -> update
-- direto de team_lead_id).

CREATE OR REPLACE FUNCTION public.revoke_lead_visibility_on_team_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.team_lead_id IS DISTINCT FROM OLD.team_lead_id THEN
    DELETE FROM lead_visibility_grants WHERE consultant_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_revoke_lead_visibility_on_team_change ON profiles;
CREATE TRIGGER trg_revoke_lead_visibility_on_team_change
  AFTER UPDATE OF team_lead_id ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.revoke_lead_visibility_on_team_change();

-- Limpar já agora os grants que já ficaram órfãos (consultor já não está
-- na equipa do team lead que lhe deu o grant).
DELETE FROM lead_visibility_grants g
WHERE NOT EXISTS (
  SELECT 1 FROM profiles p WHERE p.id = g.consultant_id AND p.team_lead_id = g.team_lead_id
);
