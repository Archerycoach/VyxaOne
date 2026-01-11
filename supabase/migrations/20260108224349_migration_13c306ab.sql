-- Criar política para INSERT (apenas admins podem criar configurações)
CREATE POLICY "Admins can create system settings"
ON system_settings
FOR INSERT
TO public
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Criar política para UPDATE (apenas admins podem atualizar configurações)
CREATE POLICY "Admins can update system settings"
ON system_settings
FOR UPDATE
TO public
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Criar política para DELETE (apenas admins podem apagar configurações)
CREATE POLICY "Admins can delete system settings"
ON system_settings
FOR DELETE
TO public
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);