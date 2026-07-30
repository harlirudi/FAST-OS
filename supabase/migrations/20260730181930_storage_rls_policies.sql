-- Allow authenticated users to upload to attendance-photos bucket
CREATE POLICY "Authenticated users can upload attendance photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'attendance-photos');

CREATE POLICY "Authenticated users can read attendance photos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'attendance-photos');

CREATE POLICY "Authenticated users can update own attendance photos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'attendance-photos' AND owner = auth.uid());

CREATE POLICY "Authenticated users can delete own attendance photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'attendance-photos' AND owner = auth.uid());
