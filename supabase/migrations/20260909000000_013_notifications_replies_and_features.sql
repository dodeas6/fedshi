/*
# 013 — إشعارات بالاسم، الرد على التعليقات، نوع المحتوى، الترند، الموقع

## التغييرات
1. كل الإشعارات (متابعة، إعجاب) أصبحت تتضمن اسم المستخدم الفعلي فاعل
   الحدث، بدل "أحدهم" العامة.
2. الرد على التعليقات: العمود parent_id كان موجوداً أصلاً في الجدول
   الأساسي لكن غير مستخدم — الآن يُنشئ إشعاراً لصاحب التعليق الأصلي
   يتضمن اسم من ردّ عليه.
3. video_type: يميّز بين "reel" (ريلز عادي بدون بيع، لكل الأعضاء) و
   "product" (فيديو منتج للبيع، للتجار فقط).
4. is_trending: يتيح للمشرف رفع أي فيديو ليظهر أولاً في التوصيات
   (ترند) بغض النظر عن نقاط التفاعل الطبيعية.
5. shared_location: حقل اختياري في الطلب يسمح للزبون بمشاركة موقعه
   الجغرافي مع التاجر لتسهيل التوصيل.
*/

-- ============================================================
-- 1) إصلاح نصوص الإشعارات لتتضمن اسم المستخدم الفعلي
-- ============================================================
CREATE OR REPLACE FUNCTION notify_on_follow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_username text;
BEGIN
  SELECT username INTO v_username FROM profiles WHERE id = NEW.follower_id;
  INSERT INTO notifications (user_id, actor_id, type, text)
  VALUES (NEW.following_id, NEW.follower_id, 'follow', '@' || COALESCE(v_username, 'مستخدم') || ' بدأ بمتابعتك');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION notify_on_like()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_owner uuid; v_username text;
BEGIN
  SELECT user_id INTO v_owner FROM videos WHERE id = NEW.video_id;
  SELECT username INTO v_username FROM profiles WHERE id = NEW.user_id;
  IF v_owner IS NOT NULL AND v_owner != NEW.user_id THEN
    INSERT INTO notifications (user_id, actor_id, type, video_id, text)
    VALUES (v_owner, NEW.user_id, 'like', NEW.video_id, '@' || COALESCE(v_username, 'مستخدم') || ' أعجب بفيديوك');
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================================
-- 2) الرد على التعليقات: إشعار لصاحب التعليق الأصلي فقط (وليس
--    صاحب الفيديو مرتين إن كان نفس الشخص)
-- ============================================================
CREATE OR REPLACE FUNCTION notify_on_comment_reply()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_parent_owner uuid; v_username text;
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    SELECT user_id INTO v_parent_owner FROM comments WHERE id = NEW.parent_id;
    SELECT username INTO v_username FROM profiles WHERE id = NEW.user_id;
    IF v_parent_owner IS NOT NULL AND v_parent_owner != NEW.user_id THEN
      INSERT INTO notifications (user_id, actor_id, type, video_id, text)
      VALUES (v_parent_owner, NEW.user_id, 'comment', NEW.video_id, '@' || COALESCE(v_username, 'مستخدم') || ' ردّ على تعليقك');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_comment_reply_notify ON comments;
CREATE TRIGGER on_comment_reply_notify
  AFTER INSERT ON comments
  FOR EACH ROW
  WHEN (NEW.parent_id IS NOT NULL)
  EXECUTE FUNCTION notify_on_comment_reply();

-- ============================================================
-- 3) تمييز نوع المحتوى: ريلز عادي (للجميع) أو منتج للبيع (للتجار)
-- ============================================================
ALTER TABLE videos ADD COLUMN IF NOT EXISTS video_type text NOT NULL DEFAULT 'product'
  CHECK (video_type IN ('reel', 'product'));
CREATE INDEX IF NOT EXISTS idx_videos_type ON videos(video_type);

-- ============================================================
-- 4) ترند: يتيح للمشرف رفع أي فيديو ليظهر أولاً بغض النظر عن نقاطه
-- ============================================================
ALTER TABLE videos ADD COLUMN IF NOT EXISTS is_trending boolean DEFAULT false;

DROP POLICY IF EXISTS "videos_update_trending_admin" ON videos;
-- (السياسة العامة videos_update_admin الموجودة أصلاً تكفي فعلياً
-- لتحديث هذا العمود أيضاً بما أن الأدمن يملك صلاحية تحديث كاملة)

-- ============================================================
-- 5) مشاركة الموقع الجغرافي اختيارياً بين الزبون والتاجر
-- ============================================================
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shared_location text;
