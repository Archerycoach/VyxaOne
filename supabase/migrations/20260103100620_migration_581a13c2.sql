-- Create financing_requests table
CREATE TABLE IF NOT EXISTS financing_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  
  -- Client information
  client_name TEXT NOT NULL,
  client_email TEXT,
  client_phone TEXT,
  client_nif TEXT,
  
  -- Property information
  property_value NUMERIC(12,2),
  property_address TEXT,
  
  -- Financing details
  loan_amount NUMERIC(12,2) NOT NULL,
  loan_term INTEGER, -- in months
  interest_rate NUMERIC(5,2),
  monthly_payment NUMERIC(10,2),
  down_payment NUMERIC(12,2),
  
  -- Status and tracking
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'approved', 'rejected', 'cancelled')),
  bank_name TEXT,
  bank_contact TEXT,
  submission_date TIMESTAMP WITH TIME ZONE,
  approval_date TIMESTAMP WITH TIME ZONE,
  
  -- Additional information
  notes TEXT,
  documents TEXT[],
  custom_fields JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE financing_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies for financing_requests
CREATE POLICY "Users can view own financing requests"
  ON financing_requests FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own financing requests"
  ON financing_requests FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own financing requests"
  ON financing_requests FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own financing requests"
  ON financing_requests FOR DELETE
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all financing requests"
  ON financing_requests FOR SELECT
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Team leads can view team financing requests"
  ON financing_requests FOR SELECT
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'team_lead' AND
    user_id IN (
      SELECT id FROM profiles 
      WHERE team_lead_id = auth.uid() OR id = auth.uid()
    )
  );