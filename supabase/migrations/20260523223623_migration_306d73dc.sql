-- 1. Garantir que as colunas existem
ALTER TABLE integration_settings ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT false;
ALTER TABLE integration_settings ADD COLUMN IF NOT EXISTS settings jsonb DEFAULT '{}'::jsonb;

-- 2. Limpar a cache imediatamente a seguir
NOTIFY pgrst, 'reload schema';

-- 3. Devolver a lista de colunas para termos a certeza
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'integration_settings';