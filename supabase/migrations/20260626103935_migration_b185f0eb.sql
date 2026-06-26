DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lead_follow_up_state') THEN
        CREATE TYPE lead_follow_up_state AS ENUM (
            'new', 
            'first_contact', 
            'in_conversation', 
            'qualified', 
            'no_reply', 
            'reengagement', 
            'archived', 
            'opt_out'
        );
    END IF;
END $$;

ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS follow_up_state lead_follow_up_state DEFAULT 'new',
ADD COLUMN IF NOT EXISTS archive_reason TEXT;