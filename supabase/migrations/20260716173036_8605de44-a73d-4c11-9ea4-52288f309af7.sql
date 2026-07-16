
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Storage policies for recordings bucket
CREATE POLICY "Owners upload own recordings"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'recordings' AND (auth.uid()::text = (storage.foldername(name))[1]));

CREATE POLICY "Owners manage own recording objects"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'recordings' AND (auth.uid()::text = (storage.foldername(name))[1]))
  WITH CHECK (bucket_id = 'recordings' AND (auth.uid()::text = (storage.foldername(name))[1]));

CREATE POLICY "Anyone can view recording objects"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'recordings');
