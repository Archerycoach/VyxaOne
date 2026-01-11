-- Adicionar política para ADMINS verem TODOS os perfis
-- Manter política para users normais verem apenas o próprio

-- Dropar política antiga que é muito restritiva
DROP POLICY IF EXISTS profiles_view_own ON profiles;

-- Criar nova política que permite:
-- 1. Qualquer user ver o próprio perfil
-- 2. Admins verem todos os perfis
CREATE POLICY "profiles_view_policy" ON profiles
  FOR SELECT
  USING (
    auth.uid() = id  -- Ver próprio perfil
    OR
    (auth.jwt() ->> 'user_role' = 'admin')  -- Admins veem todos
  );

-- Verificar política criada
SELECT policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'profiles'
AND policyname = 'profiles_view_policy';