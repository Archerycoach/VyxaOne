-- Criar política para admins atualizarem qualquer perfil
CREATE POLICY "Admins can update all profiles"
ON profiles
FOR UPDATE
USING (
  public.get_current_user_role() = 'admin'
  OR id = auth.uid()
);