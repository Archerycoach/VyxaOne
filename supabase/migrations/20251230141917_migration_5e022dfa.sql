-- Criar política para admins verem todos os perfis (SEM RECURSÃO)
-- Usa a função que faz cache do resultado
CREATE POLICY "Admins can view all profiles"
ON profiles
FOR SELECT
USING (
  public.get_current_user_role() = 'admin'
  OR id = auth.uid()
);