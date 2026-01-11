-- Adicionar constraints de validação de dados para garantir integridade

-- Validação de emails
ALTER TABLE profiles 
DROP CONSTRAINT IF EXISTS profiles_email_format_check;

ALTER TABLE profiles 
ADD CONSTRAINT profiles_email_format_check 
CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' OR email IS NULL);

ALTER TABLE leads 
DROP CONSTRAINT IF EXISTS leads_email_format_check;

ALTER TABLE leads 
ADD CONSTRAINT leads_email_format_check 
CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' OR email IS NULL);

-- Validação de telefones (formato português e internacional)
ALTER TABLE profiles 
DROP CONSTRAINT IF EXISTS profiles_phone_format_check;

ALTER TABLE profiles 
ADD CONSTRAINT profiles_phone_format_check 
CHECK (phone ~ '^\+?[0-9\s\-\(\)]{9,20}$' OR phone IS NULL);

ALTER TABLE leads 
DROP CONSTRAINT IF EXISTS leads_phone_format_check;

ALTER TABLE leads 
ADD CONSTRAINT leads_phone_format_check 
CHECK (phone ~ '^\+?[0-9\s\-\(\)]{9,20}$' OR phone IS NULL);

-- Validação de preços (sempre positivos)
ALTER TABLE properties 
DROP CONSTRAINT IF EXISTS properties_positive_price_check;

ALTER TABLE properties 
ADD CONSTRAINT properties_positive_price_check 
CHECK (price IS NULL OR price >= 0);

ALTER TABLE properties 
DROP CONSTRAINT IF EXISTS properties_positive_rental_check;

ALTER TABLE properties 
ADD CONSTRAINT properties_positive_rental_check 
CHECK (rental_price IS NULL OR rental_price >= 0);

-- Validação de datas (end_time deve ser depois de start_time)
ALTER TABLE calendar_events 
DROP CONSTRAINT IF EXISTS calendar_events_time_order_check;

ALTER TABLE calendar_events 
ADD CONSTRAINT calendar_events_time_order_check 
CHECK (end_time > start_time);