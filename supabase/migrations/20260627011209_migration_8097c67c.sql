-- A coluna buy_purpose ainda está NOT NULL - aplicar a migração novamente
ALTER TABLE leads ALTER COLUMN buy_purpose DROP NOT NULL;