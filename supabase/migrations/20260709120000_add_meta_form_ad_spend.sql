-- ROI por formulário/campanha da Meta: o broker/team_lead insere manualmente
-- o valor investido (não há ligação à API de Insights de Anúncios da Meta,
-- que exigiria uma permissão "ads_read" separada da ligação de Página já
-- usada para receber leads). O custo por lead/venda é calculado no cliente
-- cruzando este valor com as leads e vendas já associadas a este formulário.
ALTER TABLE meta_form_configs
  ADD COLUMN IF NOT EXISTS total_ad_spend numeric NOT NULL DEFAULT 0;
