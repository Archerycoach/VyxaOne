DROP POLICY IF EXISTS "service_role_only_select" ON system_settings;

CREATE POLICY "public_read_non_secrets" ON system_settings 
FOR SELECT 
USING (
  key NOT IN (
    'stripe_secret_key', 
    'stripe_webhook_secret', 
    'eupago_api_key', 
    'openai_api_key', 
    'smtp_password', 
    'jwt_secret',
    'admin_email_recipients'
  )
);