-- =====================================================
-- CREATE HELPER FUNCTIONS
-- =====================================================

-- Function to calculate lead score based on engagement
CREATE OR REPLACE FUNCTION calculate_lead_score(lead_id UUID)
RETURNS INTEGER AS $$
DECLARE
  base_score INTEGER := 0;
  interaction_count INTEGER;
  days_since_contact INTEGER;
BEGIN
  -- Get interaction count
  SELECT COUNT(*) INTO interaction_count
  FROM interactions
  WHERE interactions.lead_id = calculate_lead_score.lead_id;
  
  -- Base score from interactions (max 50 points)
  base_score := LEAST(interaction_count * 10, 50);
  
  -- Get days since last contact
  SELECT EXTRACT(DAY FROM (NOW() - last_contact_date)) INTO days_since_contact
  FROM leads
  WHERE id = calculate_lead_score.lead_id;
  
  -- Deduct points for inactivity (max -30 points)
  IF days_since_contact IS NOT NULL THEN
    IF days_since_contact > 30 THEN
      base_score := base_score - 30;
    ELSIF days_since_contact > 14 THEN
      base_score := base_score - 15;
    END IF;
  END IF;
  
  -- Ensure score is between 0 and 100
  RETURN GREATEST(0, LEAST(base_score, 100));
END;
$$ LANGUAGE plpgsql;

-- Function to handle new user creation (create profile automatically)
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();