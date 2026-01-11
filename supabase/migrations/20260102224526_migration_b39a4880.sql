-- Passo 2: Criar políticas SEGURAS sem recursão para PROFILES
-- Usar APENAS auth.uid() sem subqueries ou JOINs

-- Política para SELECT (leitura)
CREATE POLICY "profiles_select_policy" ON profiles
  FOR SELECT
  USING (
    -- Usuários podem ver seu próprio perfil
    auth.uid() = id
    OR
    -- Ou se estiverem autenticados (para ver perfis de equipe)
    auth.uid() IS NOT NULL
  );

-- Política para INSERT (criação)
CREATE POLICY "profiles_insert_policy" ON profiles
  FOR INSERT
  WITH CHECK (
    -- Usuários podem criar apenas seu próprio perfil
    auth.uid() = id
  );

-- Política para UPDATE (atualização)
CREATE POLICY "profiles_update_policy" ON profiles
  FOR UPDATE
  USING (
    -- Usuários podem atualizar apenas seu próprio perfil
    auth.uid() = id
  )
  WITH CHECK (
    -- Verificar que não estão mudando o ID
    auth.uid() = id
  );

-- Política para DELETE (exclusão)
CREATE POLICY "profiles_delete_policy" ON profiles
  FOR DELETE
  USING (
    -- Apenas o próprio usuário pode deletar seu perfil
    auth.uid() = id
  );

-- Verificar políticas criadas
SELECT policyname, cmd 
FROM pg_policies 
WHERE tablename = 'profiles';