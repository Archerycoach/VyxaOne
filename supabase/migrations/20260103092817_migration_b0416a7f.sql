-- Dropar a política antiga que pode estar conflitando
DROP POLICY IF EXISTS profiles_view_own ON profiles;

-- Verificar políticas restantes
SELECT policyname, cmd 
FROM pg_policies 
WHERE tablename = 'profiles';