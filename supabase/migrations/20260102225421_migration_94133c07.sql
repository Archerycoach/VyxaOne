-- CRIAR POLÍTICAS SIMPLES PARA PROFILES - VERSÃO FINAL
-- APENAS auth.uid(), SEM funções, SEM subqueries

-- 1. SELECT: Usuários veem seu próprio perfil
CREATE POLICY "profiles_view_own" ON profiles
  FOR SELECT
  USING (auth.uid() = id);

-- 2. INSERT: Permitir signup (qualquer autenticado pode inserir)
CREATE POLICY "profiles_signup" ON profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- 3. UPDATE: Usuários podem atualizar seu próprio perfil
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 4. DELETE: Ninguém pode deletar perfis (nem o próprio usuário)
-- Admins devem usar service role para isso

-- Verificar políticas criadas
SELECT policyname, cmd 
FROM pg_policies 
WHERE tablename = 'profiles'
ORDER BY policyname;