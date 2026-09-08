/*
# Add increment_view function for atomic view counting

## Overview
Creates an atomic RPC function to increment views_count and watch_count,
then recalculates the engagement score. This avoids race conditions
when multiple users view the same video simultaneously.
*/

CREATE OR REPLACE FUNCTION increment_view(v_uuid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE videos
  SET views_count = views_count + 1
  WHERE id = v_uuid;
  PERFORM recalculate_video_score(v_uuid);
END;
$$;

GRANT EXECUTE ON FUNCTION increment_view(uuid) TO authenticated;