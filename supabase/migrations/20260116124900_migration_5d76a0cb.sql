-- Create a dedicated extensions schema
CREATE SCHEMA IF NOT EXISTS extensions;

-- Move pg_trgm extension to the extensions schema
ALTER EXTENSION pg_trgm SET SCHEMA extensions;

-- Grant usage on the extensions schema to authenticated users
GRANT USAGE ON SCHEMA extensions TO authenticated;
GRANT USAGE ON SCHEMA extensions TO anon;
GRANT USAGE ON SCHEMA extensions TO service_role;