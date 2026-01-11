-- Agora criar o índice que usa deleted_at
CREATE INDEX IF NOT EXISTS idx_profiles_active 
ON profiles(is_active) 
WHERE deleted_at IS NULL;

COMMENT ON INDEX idx_profiles_active IS 'Index for active profiles only (not soft-deleted)';