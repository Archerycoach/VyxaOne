-- Add payment_date column to payment_history if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payment_history' AND column_name = 'payment_date') THEN
        ALTER TABLE payment_history ADD COLUMN payment_date TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;