-- Update RLS policy to block read of idealista_rapidapi_key (add to secrets list)
DROP POLICY IF EXISTS "public_read_non_secrets" ON system_settings;

CREATE POLICY "public_read_non_secrets" ON system_settings
FOR SELECT
USING (
  key NOT IN (
    'stripe_secret_key',
    'openai_api_key',
    'google_client_secret',
    'meta_app_secret',
    'idealista_rapidapi_key',
    'smtp_password',
    'notion_client_secret',
    'whatsapp_access_token'
  )
);

COMMENT ON POLICY "public_read_non_secrets" ON system_settings IS
'Allow authenticated users to read non-secret system settings. Secrets (API keys, passwords) are blocked from client access.';