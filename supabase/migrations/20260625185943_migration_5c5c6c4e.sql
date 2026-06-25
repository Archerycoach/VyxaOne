-- Create the profile bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('profile', 'profile', true) 
ON CONFLICT (id) DO NOTHING;

-- Create policies for the profile bucket
-- Allow public read access
CREATE POLICY "Public Access profile" ON storage.objects
FOR SELECT USING (bucket_id = 'profile');

-- Allow authenticated users to insert
CREATE POLICY "Auth Insert profile" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'profile' AND auth.role() = 'authenticated');

-- Allow authenticated users to update
CREATE POLICY "Auth Update profile" ON storage.objects
FOR UPDATE USING (bucket_id = 'profile' AND auth.role() = 'authenticated');

-- Allow authenticated users to delete
CREATE POLICY "Auth Delete profile" ON storage.objects
FOR DELETE USING (bucket_id = 'profile' AND auth.role() = 'authenticated');