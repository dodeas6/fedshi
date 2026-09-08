/*
# Storage policies for videos bucket
Allows authenticated users to upload videos, and public read access.
*/

DROP POLICY IF EXISTS "videos_bucket_read" ON storage.objects;
CREATE POLICY "videos_bucket_read" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'videos');

DROP POLICY IF EXISTS "videos_bucket_upload" ON storage.objects;
CREATE POLICY "videos_bucket_upload" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'videos');

DROP POLICY IF EXISTS "videos_bucket_delete_own" ON storage.objects;
CREATE POLICY "videos_bucket_delete_own" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'videos' AND owner = auth.uid());