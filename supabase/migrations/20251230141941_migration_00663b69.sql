-- Criar política para admins deletarem qualquer perfil
CREATE POLICY "Admins can delete all profiles"
ON profiles
FOR DELETE
USING (
  public.get_current_user_role() = 'admin'
);