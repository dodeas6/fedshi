/*
# 007 — إصلاحات أمنية وإضافة صلاحيات الإدارة الحقيقية

## المشاكل التي يحلها هذا الملف
1. ثغرة حرجة: أي مستخدم كان يستطيع تعديل role/coins/is_verified
   الخاصة به مباشرة (تصعيد صلاحيات ذاتي إلى admin/super_admin).
2. لا توجد أي صلاحية للأدمن لرؤية/إدارة كل الفيديوهات والبلاغات
   والمستخدمين والطلبات — فقط الصفوف المملوكة له كانت مرئية له.
3. الزوار (بدون تسجيل دخول) لا يرون أي محتوى إطلاقاً لأن كل السياسات
   كانت مقيّدة بـ TO authenticated فقط.
4. السعر الإجمالي للطلب (total_price) كان يُرسَل من المتصفح مباشرة
   بدون أي تحقق من الخادم أنه يطابق سعر المنتج الحقيقي.
5. لا توجد آلية حظر (ban) فعلية للمستخدمين المخالفين.

## ملاحظة مهمة عن حدود هذا الحل
هذا يوفر "حظراً ناعماً" (soft ban): يمنع المستخدم المحظور من النشر/
التعليق/الطلب، لكنه لا يسجّل خروجه فوراً من جلسته الحالية ولا يمنعه
تقنياً من الدخول مرة أخرى (فقط يمنعه من الكتابة). حظر كامل يمنع تسجيل
الدخول نفسه يتطلب استدعاء Supabase Admin API بمفتاح service_role،
وهذا لا يمكن تنفيذه من المتصفح مباشرة لأسباب أمنية (يجب أن يمر عبر
Edge Function) — إذا احتجته أخبرني وأبنيه كخطوة منفصلة.
*/

-- ============================================================
-- 1) أعمدة جديدة مطلوبة للحظر ومراجعة المحتوى
-- ============================================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_banned boolean DEFAULT false;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS moderation_note text DEFAULT '';

-- ============================================================
-- 2) دوال مساعدة آمنة (SECURITY DEFINER) للتحقق من الصلاحيات
--    بدون التسبب في "infinite recursion" على سياسات profiles
-- ============================================================
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  );
$$;

CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'
  );
$$;

CREATE OR REPLACE FUNCTION is_not_banned()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT NOT COALESCE((SELECT is_banned FROM profiles WHERE id = auth.uid()), false);
$$;

-- ============================================================
-- 3) الإصلاح الحرج: منع أي مستخدم من ترقية نفسه بنفسه
-- ============================================================
CREATE OR REPLACE FUNCTION protect_privileged_profile_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF NEW.role = 'super_admin' THEN
      -- منح صلاحية "مشرف عام" يتطلب أن يكون الفاعل مشرفاً عاماً هو نفسه، أو الخادم
      IF auth.role() <> 'service_role' AND NOT is_super_admin() THEN
        RAISE EXCEPTION 'فقط المشرف العام يمنح صلاحية مشرف عام';
      END IF;
    ELSIF NOT (OLD.role = 'viewer' AND NEW.role = 'merchant')
          AND auth.role() <> 'service_role'
          AND NOT is_admin() THEN
      -- الانتقال الذاتي المسموح به فقط: viewer -> merchant (تفعيل حساب تاجر)
      -- أي تغيير آخر (خصوصاً إلى admin) يتطلب أن يكون الفاعل أدمن أصلاً
      RAISE EXCEPTION 'غير مسموح بتغيير هذه الصلاحية';
    END IF;
  END IF;

  IF (NEW.coins IS DISTINCT FROM OLD.coins
      OR NEW.is_verified IS DISTINCT FROM OLD.is_verified
      OR NEW.is_banned IS DISTINCT FROM OLD.is_banned)
     AND auth.role() <> 'service_role'
     AND NOT is_admin() THEN
    -- هذا يمنع أيضاً مستخدماً محظوراً من إلغاء حظر نفسه بنفسه
    RAISE EXCEPTION 'غير مسموح بتعديل هذا الحقل من هنا';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_fields ON profiles;
CREATE TRIGGER protect_profile_fields
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION protect_privileged_profile_fields();

-- ============================================================
-- 4) سياسات جديدة تمنح الأدمن رؤية وإدارة كل شيء
--    (سياسات إضافية Permissive تُدمَج بـ OR مع السياسات القديمة
--    ولا تحذف صلاحيات المستخدم العادي على بياناته الخاصة)
-- ============================================================
DROP POLICY IF EXISTS "profiles_update_admin" ON profiles;
CREATE POLICY "profiles_update_admin" ON profiles FOR UPDATE TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "videos_select_admin" ON videos;
CREATE POLICY "videos_select_admin" ON videos FOR SELECT TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "videos_update_admin" ON videos;
CREATE POLICY "videos_update_admin" ON videos FOR UPDATE TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "videos_delete_admin" ON videos;
CREATE POLICY "videos_delete_admin" ON videos FOR DELETE TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "reports_select_admin" ON reports;
CREATE POLICY "reports_select_admin" ON reports FOR SELECT TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "reports_update_admin" ON reports;
CREATE POLICY "reports_update_admin" ON reports FOR UPDATE TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "orders_select_admin" ON orders;
CREATE POLICY "orders_select_admin" ON orders FOR SELECT TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "orders_update_admin" ON orders;
CREATE POLICY "orders_update_admin" ON orders FOR UPDATE TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "comments_delete_admin" ON comments;
CREATE POLICY "comments_delete_admin" ON comments FOR DELETE TO authenticated USING (is_admin());

-- ============================================================
-- 5) إصلاح تصفح الزوار: السماح لغير المسجّلين (anon) بقراءة
--    المحتوى العام فقط للتصفح قبل التسجيل
-- ============================================================
DROP POLICY IF EXISTS "videos_select_public_anon" ON videos;
CREATE POLICY "videos_select_public_anon" ON videos FOR SELECT TO anon
  USING (status = 'approved' AND is_private = false);

DROP POLICY IF EXISTS "profiles_select_anon" ON profiles;
CREATE POLICY "profiles_select_anon" ON profiles FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "comments_select_anon" ON comments;
CREATE POLICY "comments_select_anon" ON comments FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "likes_select_anon" ON likes;
CREATE POLICY "likes_select_anon" ON likes FOR SELECT TO anon USING (true);

-- ============================================================
-- 6) منع المستخدم المحظور من النشر/التعليق/الإعجاب/الطلب
--    (إعادة إنشاء سياسات INSERT القديمة بشرط إضافي is_not_banned)
-- ============================================================
DROP POLICY IF EXISTS "videos_insert_own" ON videos;
CREATE POLICY "videos_insert_own" ON videos FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND is_not_banned());

DROP POLICY IF EXISTS "comments_insert_own" ON comments;
CREATE POLICY "comments_insert_own" ON comments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND is_not_banned());

DROP POLICY IF EXISTS "likes_insert_own" ON likes;
CREATE POLICY "likes_insert_own" ON likes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND is_not_banned());

DROP POLICY IF EXISTS "orders_insert_own" ON orders;
CREATE POLICY "orders_insert_own" ON orders FOR INSERT TO authenticated
  WITH CHECK ((buyer_id = auth.uid() OR buyer_id IS NULL) AND is_not_banned());

-- ============================================================
-- 7) التحقق من السعر من طرف الخادم — يمنع التلاعب بـ total_price
--    من المتصفح؛ السعر الحقيقي دائماً يُقرأ من جدول videos نفسه
-- ============================================================
CREATE OR REPLACE FUNCTION enforce_order_price()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_price integer;
BEGIN
  SELECT price INTO v_price FROM videos WHERE id = NEW.video_id;
  IF v_price IS NULL THEN
    RAISE EXCEPTION 'المنتج غير موجود';
  END IF;
  NEW.total_price := v_price;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_order_enforce_price ON orders;
CREATE TRIGGER on_order_enforce_price
  BEFORE INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION enforce_order_price();
