-- Adicionar coluna purchase_timeline à tabela leads
ALTER TABLE leads
ADD COLUMN IF NOT EXISTS purchase_timeline TEXT;

COMMENT ON COLUMN leads.purchase_timeline IS 'Prazo/timing da compra pretendida (ex: imediato, 3-6 meses, 1 ano)';