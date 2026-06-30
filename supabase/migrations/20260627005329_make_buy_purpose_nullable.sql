-- Make buy_purpose nullable in leads table
-- buy_purpose não deve ser obrigatório pois nem todas as leads têm finalidade de compra definida

ALTER TABLE leads ALTER COLUMN buy_purpose DROP NOT NULL;
