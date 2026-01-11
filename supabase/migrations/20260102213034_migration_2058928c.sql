-- MELHORIA #3: CONSOLIDAR POLÍTICAS RLS REDUNDANTES
-- Simplifica manutenção e melhora performance

-- 1. Remover políticas redundantes da tabela profiles
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Admins have full access" ON profiles;
DROP POLICY IF EXISTS "Team leads can view their team" ON profiles;

-- 2. Criar políticas consolidadas e otimizadas

-- Política 1: Self-management (utilizador gere o próprio perfil)
CREATE POLICY "self_management" ON profiles
FOR ALL
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Política 2: Admin full access (admins acedem a tudo)
CREATE POLICY "admin_full_access" ON profiles
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Política 3: Team lead view team (team leads vêem a sua equipa)
CREATE POLICY "team_lead_view_team" ON profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() 
    AND p.role = 'team_lead'
    AND (profiles.team_lead_id = auth.uid() OR profiles.id = auth.uid())
  )
);

-- Verificar políticas consolidadas
SELECT 
  'Políticas RLS consolidadas com sucesso!' as status,
  COUNT(*) as total_politicas
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'profiles';