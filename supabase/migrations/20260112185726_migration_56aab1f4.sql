ALTER TABLE user_smtp_settings 
ADD COLUMN IF NOT EXISTS reject_unauthorized BOOLEAN DEFAULT true;

COMMENT ON COLUMN user_smtp_settings.reject_unauthorized IS 'Whether to reject unauthorized SSL certificates (false = aceita certificados inválidos)';