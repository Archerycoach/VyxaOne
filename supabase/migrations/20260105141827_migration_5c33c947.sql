-- ============================================
-- CORRIGIR POLÍTICAS RLS DA TABELA PROFILES
-- ============================================

-- 1. Remover políticas duplicadas
DROP POLICY IF EXISTS "profiles_signup" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
DROP POLICY IF EXISTS "profiles_users_view_own" ON profiles;

-- 2. Manter e atualizar políticas existentes
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
CREATE POLICY "Users can update their own profile" ON profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 3. Adicionar política para ADMINS poderem atualizar qualquer perfil
CREATE POLICY "Admins can update any profile" ON profiles
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- 4. Adicionar política para ADMINS poderem deletar perfis
CREATE POLICY "Admins can delete any profile" ON profiles
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );