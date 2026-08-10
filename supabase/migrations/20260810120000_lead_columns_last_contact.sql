-- Coluna "Último Contacto" na lista de leads (lead_columns_config).
-- Idempotente: o unique(column_key) garante que repetir não duplica.
insert into lead_columns_config (column_key, column_label, is_visible, column_order, column_width)
values ('last_contact_date', 'Último Contacto', true, 18, '150px')
on conflict (column_key) do nothing;
