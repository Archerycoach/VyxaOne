-- Cache da série do Índice de Preços da Habitação do INE (IPHab).
--
-- Indicador 0014767 — "Índice de preços da habitação (Taxa de variação
-- homóloga - Base 2025 - %)", trimestral, nacional, por categoria de
-- alojamento: H11 Novos · H12 Existentes · H1 Total.
--
-- Usado para projetar a valorização de um empreendimento em construção até à
-- data de entrega. Tabela própria (e não a ine_price_reference) porque aquela
-- guarda €/m² e valida os valores no intervalo 200–20000 — uma percentagem
-- seria rejeitada.
--
-- Idempotente: pode correr mais do que uma vez sem efeito.

create table if not exists ine_house_price_index (
  id uuid primary key default uuid_generate_v4(),
  indicator text not null,
  category text not null,          -- H11 (novos) | H12 (existentes) | H1 (total)
  period_code text not null,       -- ex.: S5A20261
  period_label text,               -- ex.: "1.º Trimestre de 2026"
  period_order text,               -- ex.: "20260101" (ordenação cronológica)
  yoy_pct numeric not null,        -- taxa de variação homóloga, em %
  fetched_at timestamptz not null default now(),
  unique (indicator, category, period_code)
);

create index if not exists ine_house_price_index_lookup
  on ine_house_price_index (indicator, category, period_order);

alter table ine_house_price_index enable row level security;

-- Dados públicos do INE: qualquer utilizador autenticado pode ler.
-- A escrita é sempre feita pelo servidor com service_role (que ignora RLS).
drop policy if exists "ine_hpi_read_authenticated" on ine_house_price_index;
create policy "ine_hpi_read_authenticated" on ine_house_price_index
  for select using (auth.role() = 'authenticated');
