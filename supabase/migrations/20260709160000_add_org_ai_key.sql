-- Chave de IA centralizada, opcional, ao nível da agência: só broker/admin
-- podem configurar; nunca é lida pelo browser (só usada server-side), serve
-- de fallback quando um consultor ainda não configurou a sua própria chave
-- pessoal em "gpt_api_keys".
CREATE TABLE IF NOT EXISTS org_ai_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  model text NOT NULL,
  api_key text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE org_ai_keys ENABLE ROW LEVEL SECURITY;

-- Só para gestão no ecrã de Definições (broker/admin); o uso efetivo da
-- chave nas rotas de IA é sempre feito com o cliente de serviço (service
-- role), que ignora RLS, para nenhum consultor conseguir ler a chave.
DROP POLICY IF EXISTS "broker admin manage org ai key" ON org_ai_keys;
CREATE POLICY "broker admin manage org ai key" ON org_ai_keys
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'broker'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'broker'))
  );
