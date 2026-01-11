-- SOLUÇÃO DEFINITIVA: Remover TODAS as políticas e recriar usando APENAS JWT
-- SEM FUNÇÕES CUSTOMIZADAS que possam causar recursão

-- Passo 1: Dropar TODAS as políticas de profiles
DROP POLICY IF EXISTS profiles_select_policy ON profiles;
DROP POLICY IF EXISTS profiles_insert_policy ON profiles;
DROP POLICY IF EXISTS profiles_update_policy ON profiles;
DROP POLICY IF EXISTS profiles_delete_policy ON profiles;

-- Verificar se foram removidas
SELECT COUNT(*) as policies_removed 
FROM pg_policies 
WHERE tablename = 'profiles';