-- FUGA DE DADOS (instância partilhada): a política de SELECT de "profiles" era
-- USING (true) — qualquer utilizador, de qualquer agência, via TODOS os perfis
-- (nome, email, telefone) e podia lê-los diretamente pela API pública.
--
-- Passa a ver apenas o próprio perfil e os perfis dentro do seu âmbito de
-- visibilidade (get_visible_user_ids) — a MESMA função já usada pelas políticas
-- de leads/contactos/imóveis. Consultores/team_leads ficam limitados à sua
-- equipa. (Brokers/admins continuam a ver todos os perfis porque
-- get_visible_user_ids devolve tudo para esses papéis; se a instância pública
-- tiver brokers de agências diferentes, é preciso o passo seguinte: escopar o
-- ramo broker/admin dessa função por agência.)
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "profiles_select_scoped" ON profiles;

CREATE POLICY "profiles_select_scoped" ON profiles
  FOR SELECT
  USING (
    id = auth.uid()
    OR id = ANY (get_visible_user_ids())
  );
