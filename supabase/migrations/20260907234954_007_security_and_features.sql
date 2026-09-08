/*
# Security Hardening + Features

## Fixes
1. Column-level UPDATE on profiles: only full_name, bio, avatar_url writable by client
2. Ban system: is_banned column, RLS blocks banned users from writing
3. Admin functions (SECURITY DEFINER): ban, unban, verify, unverify, set_role, adjust_coins, delete_video, update_video_status
4. create_order function: enforces real price from DB
5. Guest browsing: anon can SELECT approved videos + profiles
6. Report uniqueness: one report per user per video
7. Conversations + messages tables with RLS
8. start_conversation + send_message functions
9. become_merchant self-service function
10. Product variants: sizes[] + colors[] on videos, selected_size/color on orders
*/

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_banned boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ban_reason text DEFAULT '';
ALTER TABLE videos ADD COLUMN IF NOT EXISTS sizes text[] DEFAULT '{}';
ALTER TABLE videos ADD COLUMN IF NOT EXISTS colors text[] DEFAULT '{}';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS selected_size text DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS selected_color text DEFAULT '';

-- ============ CONVERSATIONS ============
CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_b uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  last_message_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  CONSTRAINT conv_order CHECK (user_a < user_b),
  CONSTRAINT conv_unique UNIQUE (user_a, user_b)
);
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_conv_user_a ON conversations(user_a);
CREATE INDEX IF NOT EXISTS idx_conv_user_b ON conversations(user_b);

DROP POLICY IF EXISTS "conv_select_participant" ON conversations;
CREATE POLICY "conv_select_participant" ON conversations FOR SELECT
  TO authenticated USING (user_a = auth.uid() OR user_b = auth.uid());

DROP POLICY IF EXISTS "conv_insert_participant" ON conversations;
CREATE POLICY "conv_insert_participant" ON conversations FOR INSERT
  TO authenticated WITH CHECK (user_a = auth.uid() OR user_b = auth.uid());

-- ============ MESSAGES ============
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  text text NOT NULL,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_msg_conv ON messages(conversation_id, created_at DESC);

DROP POLICY IF EXISTS "msg_select_participant" ON messages;
CREATE POLICY "msg_select_participant" ON messages FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM conversations WHERE conversations.id = messages.conversation_id AND (conversations.user_a = auth.uid() OR conversations.user_b = auth.uid()))
  );

DROP POLICY IF EXISTS "msg_insert_sender" ON messages;
CREATE POLICY "msg_insert_sender" ON messages FOR INSERT
  TO authenticated WITH CHECK (
    sender_id = auth.uid()
    AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_banned = true)
    AND EXISTS (SELECT 1 FROM conversations WHERE conversations.id = messages.conversation_id AND (conversations.user_a = auth.uid() OR conversations.user_b = auth.uid()))
  );

DROP POLICY IF EXISTS "msg_update_read" ON messages;
CREATE POLICY "msg_update_read" ON messages FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM conversations WHERE conversations.id = messages.conversation_id AND (conversations.user_a = auth.uid() OR conversations.user_b = auth.uid()))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM conversations WHERE conversations.id = messages.conversation_id AND (conversations.user_a = auth.uid() OR conversations.user_b = auth.uid()))
  );

-- ============ REPORT UNIQUENESS ============
CREATE UNIQUE INDEX IF NOT EXISTS reports_one_per_user_video ON reports(reporter_id, video_id);

-- ============ COLUMN-LEVEL PRIVILEGES ============
REVOKE UPDATE ON profiles FROM anon, authenticated;
GRANT UPDATE (full_name, bio, avatar_url) ON profiles TO authenticated;

-- ============ GUEST BROWSING ============
DROP POLICY IF EXISTS "videos_select_public" ON videos;
CREATE POLICY "videos_select_public" ON videos FOR SELECT
  TO anon, authenticated USING (
    (status = 'approved' AND is_private = false) OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS "profiles_select" ON profiles;
CREATE POLICY "profiles_select" ON profiles FOR SELECT
  TO anon, authenticated USING (true);

-- ============ BAN CHECKS ON WRITE POLICIES ============
DROP POLICY IF EXISTS "videos_insert_own" ON videos;
CREATE POLICY "videos_insert_own" ON videos FOR INSERT
  TO authenticated WITH CHECK (
    auth.uid() = user_id
    AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_banned = true)
  );

DROP POLICY IF EXISTS "comments_insert_own" ON comments;
CREATE POLICY "comments_insert_own" ON comments FOR INSERT
  TO authenticated WITH CHECK (
    auth.uid() = user_id
    AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_banned = true)
  );

DROP POLICY IF EXISTS "likes_insert_own" ON likes;
CREATE POLICY "likes_insert_own" ON likes FOR INSERT
  TO authenticated WITH CHECK (
    auth.uid() = user_id
    AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_banned = true)
  );

DROP POLICY IF EXISTS "orders_insert_own" ON orders;
CREATE POLICY "orders_insert_own" ON orders FOR INSERT
  TO authenticated WITH CHECK (
    buyer_id = auth.uid()
    AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_banned = true)
  );

DROP POLICY IF EXISTS "follows_insert_own" ON follows;
CREATE POLICY "follows_insert_own" ON follows FOR INSERT
  TO authenticated WITH CHECK (
    auth.uid() = follower_id
    AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_banned = true)
  );

DROP POLICY IF EXISTS "reports_insert_own" ON reports;
CREATE POLICY "reports_insert_own" ON reports FOR INSERT
  TO authenticated WITH CHECK (
    auth.uid() = reporter_id
    AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_banned = true)
  );

-- ============ ADMIN FUNCTIONS ============
CREATE OR REPLACE FUNCTION admin_ban_user(target_id uuid, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','super_admin')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF target_id = auth.uid() THEN RAISE EXCEPTION 'Cannot ban yourself'; END IF;
  UPDATE profiles SET is_banned = true, ban_reason = COALESCE(p_reason,'') WHERE id = target_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION admin_ban_user(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION admin_ban_user(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION admin_unban_user(target_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','super_admin')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE profiles SET is_banned = false, ban_reason = '' WHERE id = target_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION admin_unban_user(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION admin_unban_user(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION admin_verify_user(target_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','super_admin')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE profiles SET is_verified = true WHERE id = target_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION admin_verify_user(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION admin_verify_user(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION admin_unverify_user(target_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','super_admin')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE profiles SET is_verified = false WHERE id = target_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION admin_unverify_user(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION admin_unverify_user(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION admin_set_role(target_id uuid, new_role text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF new_role NOT IN ('viewer','merchant','admin','super_admin') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;
  UPDATE profiles SET role = new_role WHERE id = target_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION admin_set_role(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION admin_set_role(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION admin_adjust_coins(target_id uuid, amount integer, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','super_admin')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE profiles SET coins = GREATEST(coins + amount, 0) WHERE id = target_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION admin_adjust_coins(uuid, integer, text) FROM anon;
GRANT EXECUTE ON FUNCTION admin_adjust_coins(uuid, integer, text) TO authenticated;

CREATE OR REPLACE FUNCTION admin_delete_video(target_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','super_admin')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  DELETE FROM videos WHERE id = target_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION admin_delete_video(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION admin_delete_video(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION admin_update_video_status(target_id uuid, new_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','super_admin')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF new_status NOT IN ('approved','pending','rejected') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;
  UPDATE videos SET status = new_status WHERE id = target_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION admin_update_video_status(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION admin_update_video_status(uuid, text) TO authenticated;

-- ============ MERCHANT SELF-SERVICE ============
CREATE OR REPLACE FUNCTION become_merchant()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'viewer' AND is_banned = false) THEN
    RAISE EXCEPTION 'Not eligible';
  END IF;
  UPDATE profiles SET role = 'merchant' WHERE id = auth.uid();
END;
$$;
REVOKE EXECUTE ON FUNCTION become_merchant() FROM anon;
GRANT EXECUTE ON FUNCTION become_merchant() TO authenticated;

-- ============ CREATE ORDER (price from DB) ============
CREATE OR REPLACE FUNCTION create_order(
  p_video_id uuid, p_buyer_name text, p_phone text, p_province text, p_address text,
  p_selected_size text DEFAULT '', p_selected_color text DEFAULT ''
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_video videos%ROWTYPE;
  v_order_id uuid;
  v_code text;
BEGIN
  IF EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_banned = true) THEN
    RAISE EXCEPTION 'Account suspended';
  END IF;
  SELECT * INTO v_video FROM videos WHERE id = p_video_id AND status = 'approved';
  IF NOT FOUND THEN RAISE EXCEPTION 'Product not available'; END IF;
  IF array_length(v_video.sizes, 1) > 0 AND p_selected_size != '' AND NOT p_selected_size = ANY(v_video.sizes) THEN
    RAISE EXCEPTION 'Invalid size';
  END IF;
  IF array_length(v_video.colors, 1) > 0 AND p_selected_color != '' AND NOT p_selected_color = ANY(v_video.colors) THEN
    RAISE EXCEPTION 'Invalid color';
  END IF;
  v_code := 'FED-' || upper(to_hex(extract(epoch from now())::bigint)) || '-' || upper(substr(encode(gen_random_bytes(3), 'hex'), 1, 5));
  INSERT INTO orders (order_code, video_id, merchant_id, buyer_id, buyer_name, phone, province, address, total_price, status, selected_size, selected_color)
  VALUES (v_code, p_video_id, v_video.user_id, auth.uid(), p_buyer_name, p_phone, p_province, p_address, v_video.price, 'pending', p_selected_size, p_selected_color)
  RETURNING id INTO v_order_id;
  INSERT INTO notifications (user_id, actor_id, type, video_id, text)
  VALUES (v_video.user_id, auth.uid(), 'order', p_video_id, 'طلب جديد: ' || v_code);
  RETURN v_order_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION create_order(uuid, text, text, text, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION create_order(uuid, text, text, text, text, text, text) TO authenticated;

-- ============ CONVERSATION + MESSAGE FUNCTIONS ============
CREATE OR REPLACE FUNCTION start_conversation(p_other_user_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_conv_id uuid; v_a uuid; v_b uuid;
BEGIN
  IF auth.uid() = p_other_user_id THEN RAISE EXCEPTION 'Cannot message yourself'; END IF;
  IF EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_banned = true) THEN RAISE EXCEPTION 'Account suspended'; END IF;
  v_a := least(auth.uid(), p_other_user_id);
  v_b := greatest(auth.uid(), p_other_user_id);
  SELECT id INTO v_conv_id FROM conversations WHERE user_a = v_a AND user_b = v_b;
  IF v_conv_id IS NOT NULL THEN RETURN v_conv_id; END IF;
  INSERT INTO conversations (user_a, user_b) VALUES (v_a, v_b) RETURNING id INTO v_conv_id;
  RETURN v_conv_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION start_conversation(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION start_conversation(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION send_message(p_conversation_id uuid, p_text text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_msg_id uuid; v_other uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_banned = true) THEN RAISE EXCEPTION 'Account suspended'; END IF;
  IF NOT EXISTS (SELECT 1 FROM conversations WHERE id = p_conversation_id AND (user_a = auth.uid() OR user_b = auth.uid())) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF length(trim(p_text)) = 0 OR length(p_text) > 1000 THEN RAISE EXCEPTION 'Invalid message'; END IF;
  INSERT INTO messages (conversation_id, sender_id, text) VALUES (p_conversation_id, auth.uid(), p_text) RETURNING id INTO v_msg_id;
  UPDATE conversations SET last_message_at = now() WHERE id = p_conversation_id;
  SELECT CASE WHEN user_a = auth.uid() THEN user_b ELSE user_a END INTO v_other FROM conversations WHERE id = p_conversation_id;
  IF v_other IS NOT NULL THEN
    INSERT INTO notifications (user_id, actor_id, type, text) VALUES (v_other, auth.uid(), 'system', 'رسالة جديدة');
  END IF;
  RETURN v_msg_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION send_message(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION send_message(uuid, text) TO authenticated;

-- ============ FIX increment_view ============
REVOKE EXECUTE ON FUNCTION increment_view(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION increment_view(uuid) TO authenticated;