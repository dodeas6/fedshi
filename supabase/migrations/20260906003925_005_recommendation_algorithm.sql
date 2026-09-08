/*
# Add engagement score + view tracking for recommendation algorithm

## Overview
Adds a TikTok-style recommendation engine. Instead of ordering by date,
videos are ranked by an engagement score combining:
- likes (weight 5)
- comments (weight 3)
- views (weight 1, logarithmic to prevent viral monopoly)
- recency boost (newer videos get a small boost so the feed stays fresh)

## Changes
1. Add `engagement_score` column to videos (float, default 0)
2. Add `watch_count` column to track full watches
3. Add `completion_rate` column (watch_count / views_count)
4. Create function `recalculate_engagement()` that updates all scores
5. Create trigger to recalculate on likes/comments changes
6. Add index on engagement_score for fast ordering
*/

ALTER TABLE videos ADD COLUMN IF NOT EXISTS engagement_score float DEFAULT 0;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS watch_count integer DEFAULT 0;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS completion_rate float DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_videos_engagement ON videos(engagement_score DESC);

CREATE OR REPLACE FUNCTION recalculate_video_score(v_uuid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_likes int;
  v_comments int;
  v_views int;
  v_watches int;
  v_score float;
  v_created timestamptz;
  v_age_hours float;
  v_recency float;
BEGIN
  SELECT likes_count, comments_count, views_count, watch_count, created_at
  INTO v_likes, v_comments, v_views, v_watches, v_created
  FROM videos WHERE id = v_uuid;

  IF NOT FOUND THEN RETURN; END IF;

  -- Recency boost: newer videos get up to 1.5x multiplier, decays over 7 days
  v_age_hours := EXTRACT(EPOCH FROM (now() - v_created)) / 3600.0;
  v_recency := 1.0 + GREATEST(0.0, 1.0 - (v_age_hours / 168.0)) * 0.5;

  -- Engagement score: weighted combination with logarithmic views
  v_score := (
    (v_likes * 5.0) +
    (v_comments * 3.0) +
    (ln(GREATEST(v_views, 1)::float) * 2.0) +
    (v_watches * 4.0) +
    (CASE WHEN v_views > 0 THEN (v_watches::float / v_views::float) * 10.0 ELSE 0 END)
  ) * v_recency;

  UPDATE videos SET engagement_score = v_score WHERE id = v_uuid;
END;
$$;

-- Trigger to recalculate score when likes change
CREATE OR REPLACE FUNCTION trigger_recalc_on_like()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    PERFORM recalculate_video_score(NEW.video_id);
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    PERFORM recalculate_video_score(OLD.video_id);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS on_like_recalc ON likes;
CREATE TRIGGER on_like_recalc
  AFTER INSERT OR DELETE ON likes
  FOR EACH ROW EXECUTE FUNCTION trigger_recalc_on_like();

-- Trigger to recalculate score when comments change
CREATE OR REPLACE FUNCTION trigger_recalc_on_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    PERFORM recalculate_video_score(NEW.video_id);
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    PERFORM recalculate_video_score(OLD.video_id);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS on_comment_recalc ON comments;
CREATE TRIGGER on_comment_recalc
  AFTER INSERT OR DELETE ON comments
  FOR EACH ROW EXECUTE FUNCTION trigger_recalc_on_comment();