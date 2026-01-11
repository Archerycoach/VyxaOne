-- Criar política para admins deletarem qualquer perfil
CREATE POLICY "Admins can delete all profiles"
ON profiles
FOR DELETE
TO public
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
);