-- "Facebook Login for Business" (a variante usada pela app Meta atual)
-- passa as permissões através de uma "Configuration" criada no painel da
-- Meta, identificada por um config_id — em vez do parâmetro "scope" clássico
-- usado no fluxo de OAuth antigo. Guardamos esse ID aqui para poder incluí-lo
-- no URL de autorização em /api/meta/auth.ts sem o hardcodar no código.
ALTER TABLE meta_app_settings
  ADD COLUMN IF NOT EXISTS login_config_id text;

COMMENT ON COLUMN meta_app_settings.login_config_id IS 'Configuration ID do Facebook Login for Business (painel da Meta > Facebook Login for Business > Configurations)';
