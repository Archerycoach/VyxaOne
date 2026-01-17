-- Adicionar coluna recipient_emails à tabela email_templates
ALTER TABLE email_templates 
ADD COLUMN IF NOT EXISTS recipient_emails TEXT[] DEFAULT '{}';

-- Adicionar comentário explicativo
COMMENT ON COLUMN email_templates.recipient_emails IS 'Lista de emails destinatários para este template (além do email do utilizador)';