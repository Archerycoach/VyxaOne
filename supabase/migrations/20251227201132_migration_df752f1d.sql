-- Update RLS policies for documents - Multi-tenancy isolation
DROP POLICY IF EXISTS "Users can view all documents" ON documents;

-- Users can only see their own documents
CREATE POLICY "Users can view their own documents"
  ON documents FOR SELECT
  USING (auth.uid() = uploaded_by);