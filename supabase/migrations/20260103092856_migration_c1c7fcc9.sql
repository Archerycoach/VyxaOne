-- CANCELAR a política anterior que causa recursão
DROP POLICY IF EXISTS profiles_view_policy ON profiles;

-- SOLUÇÃO SEM RECURSÃO: Criar 2 políticas separadas
-- Política 1: Users normais veem apenas próprio perfil
CREATE POLICY "profiles_users_view_own" ON profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Política 2: Bypass RLS para service_role (usado por admins via API)
-- Admins farão queries via service_role que ignora RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles FORCE ROW LEVEL SECURITY;

-- Verificar políticas
SELECT policyname, cmd 
FROM pg_policies 
WHERE tablename = 'profiles';