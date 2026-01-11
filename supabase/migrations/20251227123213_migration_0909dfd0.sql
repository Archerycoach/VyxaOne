-- Create documents table
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('contract', 'checklist', 'guide', 'legal')),
  file_path TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT,
  tags JSONB DEFAULT '[]',
  uploaded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Documents policies
CREATE POLICY "Users can view all documents" ON documents FOR SELECT USING (true);
CREATE POLICY "Users can insert documents" ON documents FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can delete their documents" ON documents FOR DELETE USING (auth.uid() = uploaded_by);

-- Create index
CREATE INDEX idx_documents_category ON documents(category);