/*
# 010 — نظام قياسات وألوان المنتجات مع تتبع المخزون

## نظرة عامة
يضيف جدول product_variants الذي يخزّن خيارات القياس (S,M,L...) وخيارات
اللون لكل منتج، مع عدد القطع المتوفرة لكل خيار على حدة. عند إتمام أي
طلب يحتوي قياساً و/أو لوناً محدداً، يُخصَم المخزون تلقائياً وبأمان
(بدون احتمال بيع نفس القطعة الأخيرة لشخصين في نفس اللحظة)، وإذا نفدت
الكمية تُرفض عملية إدراج الطلب برسالة واضحة. كما يُعاد المخزون تلقائياً
إذا أُلغي الطلب لاحقاً.
*/

-- ============================================================
-- 1) جدول خيارات المنتج (قياس أو لون) مع الكمية المتوفرة لكل خيار
-- ============================================================
CREATE TABLE IF NOT EXISTS product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  variant_type text NOT NULL CHECK (variant_type IN ('size', 'color')),
  option_name text NOT NULL,
  option_hex text,
  stock integer NOT NULL DEFAULT 0 CHECK (stock >= 0),
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE (video_id, variant_type, option_name)
);

ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_variants_video ON product_variants(video_id);

-- أي شخص (حتى الزوار) يحتاج يشوف الخيارات والكمية المتاحة لإتمام الشراء
DROP POLICY IF EXISTS "variants_select_all" ON product_variants;
CREATE POLICY "variants_select_all" ON product_variants FOR SELECT TO anon, authenticated USING (true);

-- فقط صاحب المنتج أو الأدمن يستطيع إضافة/تعديل/حذف الخيارات
DROP POLICY IF EXISTS "variants_insert_own" ON product_variants;
CREATE POLICY "variants_insert_own" ON product_variants FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM videos v WHERE v.id = product_variants.video_id AND (v.user_id = auth.uid() OR is_admin())));

DROP POLICY IF EXISTS "variants_update_own" ON product_variants;
CREATE POLICY "variants_update_own" ON product_variants FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM videos v WHERE v.id = product_variants.video_id AND (v.user_id = auth.uid() OR is_admin())))
  WITH CHECK (EXISTS (SELECT 1 FROM videos v WHERE v.id = product_variants.video_id AND (v.user_id = auth.uid() OR is_admin())));

DROP POLICY IF EXISTS "variants_delete_own" ON product_variants;
CREATE POLICY "variants_delete_own" ON product_variants FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM videos v WHERE v.id = product_variants.video_id AND (v.user_id = auth.uid() OR is_admin())));

-- ============================================================
-- 2) أعمدة جديدة في جدول الطلبات لتسجيل القياس/اللون المختار
-- ============================================================
ALTER TABLE orders ADD COLUMN IF NOT EXISTS selected_size text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS selected_color text;

-- ============================================================
-- 3) خصم المخزون تلقائياً وبأمان عند إنشاء الطلب
--    UPDATE ... WHERE stock > 0 يمنع بيع نفس القطعة الأخيرة مرتين
--    حتى لو جاء طلبان في نفس اللحظة بالضبط
-- ============================================================
CREATE OR REPLACE FUNCTION decrement_variant_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_stock integer;
BEGIN
  IF NEW.selected_size IS NOT NULL THEN
    UPDATE product_variants
    SET stock = stock - 1
    WHERE video_id = NEW.video_id AND variant_type = 'size' AND option_name = NEW.selected_size AND stock > 0
    RETURNING stock INTO v_new_stock;

    IF v_new_stock IS NULL THEN
      RAISE EXCEPTION 'نفذت الكمية لهذا القياس، الرجاء اختيار قياس آخر';
    END IF;
  END IF;

  IF NEW.selected_color IS NOT NULL THEN
    UPDATE product_variants
    SET stock = stock - 1
    WHERE video_id = NEW.video_id AND variant_type = 'color' AND option_name = NEW.selected_color AND stock > 0
    RETURNING stock INTO v_new_stock;

    IF v_new_stock IS NULL THEN
      RAISE EXCEPTION 'نفذت الكمية لهذا اللون، الرجاء اختيار لون آخر';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_order_decrement_variant ON orders;
CREATE TRIGGER on_order_decrement_variant
  BEFORE INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION decrement_variant_stock();

-- ============================================================
-- 4) إعادة المخزون تلقائياً إذا أُلغي الطلب لاحقاً
-- ============================================================
CREATE OR REPLACE FUNCTION restore_variant_stock_on_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' THEN
    IF NEW.selected_size IS NOT NULL THEN
      UPDATE product_variants SET stock = stock + 1
      WHERE video_id = NEW.video_id AND variant_type = 'size' AND option_name = NEW.selected_size;
    END IF;
    IF NEW.selected_color IS NOT NULL THEN
      UPDATE product_variants SET stock = stock + 1
      WHERE video_id = NEW.video_id AND variant_type = 'color' AND option_name = NEW.selected_color;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_order_restore_variant ON orders;
CREATE TRIGGER on_order_restore_variant
  AFTER UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION restore_variant_stock_on_cancel();
