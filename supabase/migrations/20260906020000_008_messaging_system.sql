/*
# 008 — نظام الرسائل المباشرة (Direct Messages)

## نظرة عامة
يضيف جدولين: conversations (محادثة بين شخصين) وmessages (الرسائل
داخلها)، مع RLS تضمن أن كل طرف يرى فقط محادثاته الخاصة، بالإضافة إلى
دالة get_or_create_conversation التي تُستخدم من الواجهة لبدء أو
إيجاد محادثة موجودة بين مستخدمين بأمان دون تعارض.
*/

-- ============================================================
-- 1) جدول المحادثات
--    user_a < user_b دائماً (نفرضها بقيد CHECK) لضمان عدم تكرار
--    نفس زوج المستخدمين في صفّين مختلفين
-- ============================================================
CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_b uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  last_message text DEFAULT '',
  last_message_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  CONSTRAINT ordered_pair CHECK (user_a < user_b),
  CONSTRAINT unique_pair UNIQUE (user_a, user_b)
);
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_conv_user_a ON conversations(user_a);
CREATE INDEX IF NOT EXISTS idx_conv_user_b ON conversations(user_b);

DROP POLICY IF EXISTS "conversations_select_own" ON conversations;
CREATE POLICY "conversations_select_own" ON conversations FOR SELECT TO authenticated
  USING (auth.uid() = user_a OR auth.uid() = user_b);

DROP POLICY IF EXISTS "conversations_insert_own" ON conversations;
CREATE POLICY "conversations_insert_own" ON conversations FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = user_a OR auth.uid() = user_b) AND is_not_banned());

-- ============================================================
-- 2) جدول الرسائل
-- ============================================================
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, created_at);

DROP POLICY IF EXISTS "messages_select_own" ON messages;
CREATE POLICY "messages_select_own" ON messages FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.id = messages.conversation_id AND (c.user_a = auth.uid() OR c.user_b = auth.uid())
  ));

DROP POLICY IF EXISTS "messages_insert_own" ON messages;
CREATE POLICY "messages_insert_own" ON messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND is_not_banned()
    AND EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id AND (c.user_a = auth.uid() OR c.user_b = auth.uid())
    )
  );

DROP POLICY IF EXISTS "messages_update_own" ON messages;
CREATE POLICY "messages_update_own" ON messages FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.id = messages.conversation_id AND (c.user_a = auth.uid() OR c.user_b = auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.id = messages.conversation_id AND (c.user_a = auth.uid() OR c.user_b = auth.uid())
  ));

-- ============================================================
-- 3) تحديث آخر رسالة في المحادثة تلقائياً (لعرضها في قائمة الوارد)
-- ============================================================
CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE conversations
  SET last_message = NEW.content, last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_message_update_conversation ON messages;
CREATE TRIGGER on_message_update_conversation
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION update_conversation_last_message();

-- ============================================================
-- 4) إشعار للطرف الآخر عند استلام رسالة جديدة
-- ============================================================
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('like','comment','follow','order','system','message'));

CREATE OR REPLACE FUNCTION notify_on_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recipient uuid;
BEGIN
  SELECT (CASE WHEN c.user_a = NEW.sender_id THEN c.user_b ELSE c.user_a END)
  INTO v_recipient
  FROM conversations c WHERE c.id = NEW.conversation_id;

  IF v_recipient IS NOT NULL THEN
    INSERT INTO notifications (user_id, actor_id, type, text)
    VALUES (v_recipient, NEW.sender_id, 'message', 'وصلتك رسالة جديدة');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_message_notify ON messages;
CREATE TRIGGER on_message_notify AFTER INSERT ON messages FOR EACH ROW EXECUTE FUNCTION notify_on_message();

-- ============================================================
-- 5) دالة آمنة لإيجاد محادثة موجودة أو إنشاء واحدة جديدة
--    تُستخدم من الواجهة بدل التعامل المباشر مع ترتيب user_a/user_b
-- ============================================================
CREATE OR REPLACE FUNCTION get_or_create_conversation(other_user uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_a uuid; v_b uuid; v_id uuid;
BEGIN
  IF other_user = auth.uid() THEN
    RAISE EXCEPTION 'لا يمكن مراسلة نفسك';
  END IF;

  IF NOT is_not_banned() THEN
    RAISE EXCEPTION 'حسابك محظور من إنشاء محادثات جديدة';
  END IF;

  IF auth.uid() < other_user THEN
    v_a := auth.uid(); v_b := other_user;
  ELSE
    v_a := other_user; v_b := auth.uid();
  END IF;

  SELECT id INTO v_id FROM conversations WHERE user_a = v_a AND user_b = v_b;

  IF v_id IS NULL THEN
    INSERT INTO conversations (user_a, user_b) VALUES (v_a, v_b)
    ON CONFLICT (user_a, user_b) DO NOTHING
    RETURNING id INTO v_id;

    IF v_id IS NULL THEN
      SELECT id INTO v_id FROM conversations WHERE user_a = v_a AND user_b = v_b;
    END IF;
  END IF;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION get_or_create_conversation(uuid) TO authenticated;

-- ============================================================
-- 6) تفعيل التحديث اللحظي (Realtime) على الجدولين إن لم يكن مفعّلاً
-- ============================================================
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE messages;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
