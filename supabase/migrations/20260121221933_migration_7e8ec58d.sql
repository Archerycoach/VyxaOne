-- Renomear a coluna service_name para integration_name na tabela integration_settings
ALTER TABLE integration_settings 
RENAME COLUMN service_name TO integration_name;