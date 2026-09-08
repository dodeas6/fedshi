/*
# 011 — الفئات وتقييمات المنتجات

## نظرة عامة
1. عمود category على videos لتصنيف المنتجات (ملابس نسائية، رجالية،
   أحذية...) لدعم تصفح وفلترة أفضل.
2. جدول product_reviews: تقييم من 1-5 نجوم + تعليق، يقتصر فقط على
   المشتري الفعلي لطلب تم تسليمه (status = 'delivered')، بمراجعة
   واحدة لكل طلب. متوسط التقييم وعدد المراجعات محسوبان تلقائياً
   ومخزّنان على videos مباشرة (denormalized) لعرض سريع بدون حساب
   في كل مرة.
*/

-- ============================================================
-- 1) الفئات
-- ============================================================
ALTER TABLE videos ADD COLUMN IF NOT EXISTS category text DEFAULT 'أخرى';
CREATE INDEX IF NOT EXISTS idx_videos_category ON videos(category);

-- ============================================================
-- 2) جدول التقييمات
-- ============================================================
CREATE TABLE IF NOT EXISTS product_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  video_id uuid NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  buyer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE product_reviews ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_reviews_video ON product_reviews(video_id);

-- الجميع (حتى الزوار) يحتاج يشوف التقييمات ليقرر الشراء
DROP POLICY IF EXISTS "reviews_select_all" ON product_reviews;
CREATE POLICY "reviews_select_all" ON product_reviews FOR SELECT TO anon, authenticated USING (true);

-- فقط مشتري الطلب الفعلي، وفقط إذا استُلم الطلب (delivered)،
-- ومرة واحدة لكل طلب (UNIQUE على order_id أعلاه)
DROP POLICY IF EXISTS "reviews_insert_own" ON product_reviews;
CREATE POLICY "reviews_insert_own" ON product_reviews FOR INSERT TO authenticated
  WITH CHECK (
    buyer_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = product_reviews.order_id
        AND o.buyer_id = auth.uid()
        AND o.status = 'delivered'
        AND o.video_id = product_reviews.video_id
    )
  );

DROP POLICY IF EXISTS "reviews_update_own" ON product_reviews;
CREATE POLICY "reviews_update_own" ON product_reviews FOR UPDATE TO authenticated
  USING (buyer_id = auth.uid()) WITH CHECK (buyer_id = auth.uid());

DROP POLICY IF EXISTS "reviews_delete_own" ON product_reviews;
CREATE POLICY "reviews_delete_own" ON product_reviews FOR DELETE TO authenticated
  USING (buyer_id = auth.uid() OR is_admin());

-- ============================================================
-- 3) متوسط التقييم وعدده، محسوبان تلقائياً على videos
-- ============================================================
ALTER TABLE videos ADD COLUMN IF NOT EXISTS avg_rating numeric(2,1) DEFAULT 0;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS reviews_count integer DEFAULT 0;

CREATE OR REPLACE FUNCTION update_video_rating()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_video_id uuid;
BEGIN
  v_video_id := COALESCE(NEW.video_id, OLD.video_id);
  UPDATE videos v
  SET avg_rating = COALESCE((SELECT ROUND(AVG(rating)::numeric, 1) FROM product_reviews WHERE video_id = v_video_id), 0),
      reviews_count = (SELECT COUNT(*) FROM product_reviews WHERE video_id = v_video_id)
  WHERE v.id = v_video_id;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS on_review_change ON product_reviews;
CREATE TRIGGER on_review_change
  AFTER INSERT OR UPDATE OR DELETE ON product_reviews
  FOR EACH ROW EXECUTE FUNCTION update_video_rating();
