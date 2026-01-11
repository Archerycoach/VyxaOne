-- SOLUÇÃO FINAL: Criar política que verifica role diretamente sem recursão
-- Usando a função CURRENT_SETTING que não causa recursão

-- Primeiro, dropar a política atual
DROP POLICY IF EXISTS profiles_view_policy ON profiles;

-- Criar nova política que funciona para admins E users normais
CREATE POLICY "profiles_view_policy" ON profiles
  FOR SELECT
  USING (
    -- Ver próprio perfil
    auth.uid() = id
    OR
    -- OU se o usuário atual é admin (verificação direta na tabela)
    EXISTS (
      SELECT 1 
      FROM profiles p 
      WHERE p.id = auth.uid() 
      AND p.role = 'admin'
    )
  );

-- Verificar política criada
SELECT policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'profiles'
AND policyname = 'profiles_view_policy';