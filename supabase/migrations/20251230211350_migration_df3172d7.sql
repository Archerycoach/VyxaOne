-- Permitir que administradores vejam TODAS as subscrições
CREATE POLICY "Admins can view all subscriptions" 
ON subscriptions FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
);

-- Permitir que administradores atualizem TODAS as subscrições
CREATE POLICY "Admins can update all subscriptions" 
ON subscriptions FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
);

-- Permitir que administradores vejam TODO o histórico de pagamentos
CREATE POLICY "Admins can view all payment history" 
ON payment_history FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
);