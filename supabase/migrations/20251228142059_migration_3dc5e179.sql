-- If the foreign key doesn't exist or is incorrect, drop it first
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'activity_logs_user_id_fkey'
    AND table_name = 'activity_logs'
  ) THEN
    ALTER TABLE activity_logs DROP CONSTRAINT activity_logs_user_id_fkey;
  END IF;
END $$;

-- Now create the correct foreign key relationship
ALTER TABLE activity_logs
ADD CONSTRAINT activity_logs_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES profiles(id)
ON DELETE CASCADE;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);

-- Verify the foreign key was created
SELECT
  tc.constraint_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'activity_logs'
  AND tc.constraint_name = 'activity_logs_user_id_fkey';