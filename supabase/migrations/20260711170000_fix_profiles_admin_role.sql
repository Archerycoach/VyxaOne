-- A migração 20260626194839_migration_b1e638dd.sql recriou as políticas de
-- UPDATE/DELETE da tabela profiles a exigir role = 'broker', esquecendo o
-- role legado 'admin' (ainda usado em toda a app). Resultado: um admin a
-- editar outro utilizador (ex: mudar Team Lead ou Role em /admin/users)
-- recebe "sucesso" mas a linha não é alterada, porque a RLS filtra o UPDATE
-- silenciosamente.

DROP POLICY IF EXISTS "Admins can update any profile" ON profiles;
CREATE POLICY "Admins can update any profile" ON profiles
  FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role::text IN ('broker', 'admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role::text IN ('broker', 'admin')));

DROP POLICY IF EXISTS "Admins can delete any profile" ON profiles;
CREATE POLICY "Admins can delete any profile" ON profiles
  FOR DELETE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role::text IN ('broker', 'admin')));
