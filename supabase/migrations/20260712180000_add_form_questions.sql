-- Perguntas personalizadas para os formulários próprios da app (formulário de
-- contacto das landing pages e formulário de reserva). Cada consultor define
-- as suas; as respostas ficam guardadas na lead (custom_fields + notas).
CREATE TABLE IF NOT EXISTS form_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  form_type text NOT NULL CHECK (form_type IN ('landing', 'booking')),
  label text NOT NULL,
  field_type text NOT NULL DEFAULT 'text' CHECK (field_type IN ('text', 'textarea', 'select', 'number', 'phone')),
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  required boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_form_questions_owner ON form_questions(user_id, form_type, sort_order);

ALTER TABLE form_questions ENABLE ROW LEVEL SECURITY;

-- O consultor gere as suas próprias perguntas. As páginas públicas leem via
-- service-role (endpoints), que ignora a RLS — não é preciso política pública.
DROP POLICY IF EXISTS "owner manages own form questions" ON form_questions;
CREATE POLICY "owner manages own form questions" ON form_questions
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
