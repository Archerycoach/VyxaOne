INSERT INTO storage.buckets (id, name, public) VALUES ('email_attachments', 'email_attachments', true) ON CONFLICT (id) DO NOTHING;
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'email_attachments');
CREATE POLICY "Authenticated users can upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'email_attachments' AND auth.role() = 'authenticated');