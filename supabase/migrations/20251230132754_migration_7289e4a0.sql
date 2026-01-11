-- Criar política para admins atualizarem qualquer perfil
CREATE POLICY "Admins can update all profiles"
ON profiles
FOR UPDATE
TO public
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
);