-- Passo 2: Criar políticas ULTRA SIMPLES usando APENAS auth.uid()
-- SEM subqueries, SEM funções customizadas, SEM joins

-- RLS já está ativado, apenas criar políticas básicas
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- POLÍTICA 1: SELECT - Cada user vê apenas o próprio perfil
CREATE POLICY "Users can view own profile"
ON profiles FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- POLÍTICA 2: INSERT - Permitir criação durante signup
CREATE POLICY "Users can insert own profile"
ON profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- POLÍTICA 3: UPDATE - Cada user atualiza apenas o próprio perfil
CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- POLÍTICA 4: DELETE - Apenas o próprio user pode deletar seu perfil
CREATE POLICY "Users can delete own profile"
ON profiles FOR DELETE
TO authenticated
USING (auth.uid() = id);

-- Verificar políticas criadas
SELECT policyname, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'profiles';