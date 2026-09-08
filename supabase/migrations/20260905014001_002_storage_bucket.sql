/*
# Create videos storage bucket
Adds a public storage bucket for video uploads.
*/
INSERT INTO storage.buckets (id, name, public)
VALUES ('videos', 'videos', true)
ON CONFLICT (id) DO NOTHING;