-- Permite o método de pagamento 'card' (cartão de crédito via EuPago) no
-- histórico de pagamentos. Idempotente.

DO $$
DECLARE
  c record;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'payment_history'
  ) THEN
    RAISE NOTICE 'Tabela payment_history inexistente; nada a fazer.';
    RETURN;
  END IF;

  -- Remover qualquer CHECK atual sobre payment_method (o nome pode variar).
  FOR c IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE rel.relname = 'payment_history'
      AND nsp.nspname = 'public'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%payment_method%'
  LOOP
    EXECUTE format('ALTER TABLE public.payment_history DROP CONSTRAINT %I', c.conname);
  END LOOP;

  ALTER TABLE public.payment_history
    ADD CONSTRAINT payment_history_payment_method_check
    CHECK (payment_method IS NULL OR payment_method = ANY (ARRAY['stripe', 'card', 'multibanco', 'mbway', 'paypal']));
END $$;
