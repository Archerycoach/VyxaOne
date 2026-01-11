-- Criar política para admins verem todos os perfis
CREATE POLICY "Admins can view all profiles"
ON profiles
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
);