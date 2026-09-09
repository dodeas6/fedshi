import { useEffect, useState, FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ShoppingCart, CheckCircle2, ArrowRight, Star, MapPin } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { Video, ProductVariant, ProductReview } from '../lib/types'

const PROVINCES = [
  'بغداد', 'البصرة', 'أربيل', 'الموصل', 'النجف', 'كربلاء', 'كركوك',
  'الأنبار', 'ديالى', 'صلاح الدين', 'ذي قار', 'ميسان', 'المثنى',
  'واسط', 'بابل', 'القادسية', 'سليمانية', 'دهوك',
]

export default function CheckoutPage() {
  const { videoId } = useParams<{ videoId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [video, setVideo] = useState<Video | null>(null)
  const [sizes, setSizes] = useState<ProductVariant[]>([])
  const [colors, setColors] = useState<ProductVariant[]>([])
  const [reviews, setReviews] = useState<ProductReview[]>([])
  const [selectedSize, setSelectedSize] = useState<string | null>(null)
  const [selectedColor, setSelectedColor] = useState<string | null>(null)
  const [variantNotice, setVariantNotice] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [province, setProvince] = useState('')
  const [address, setAddress] = useState('')
  const [sharedLocation, setSharedLocation] = useState('')

  const shareMyLocation = () => {
    if (!navigator.geolocation) {
      setSubmitError('متصفحك لا يدعم مشاركة الموقع الجغرافي')
      return
    }
    navigator.geolocation.getCurrentPosition(
      pos => setSharedLocation(`${pos.coords.latitude.toFixed(6)},${pos.coords.longitude.toFixed(6)}`),
      () => setSubmitError('تعذّر الوصول لموقعك — تأكد من السماح للمتصفح بذلك')
    )
  }
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [success, setSuccess] = useState(false)
  const [orderCode, setOrderCode] = useState('')

  const loadVariants = async (vId: string) => {
    const { data } = await supabase.from('product_variants').select('*').eq('video_id', vId).order('sort_order')
    const list = (data as ProductVariant[]) || []
    setSizes(list.filter(v => v.variant_type === 'size'))
    setColors(list.filter(v => v.variant_type === 'color'))
  }

  const loadReviews = async (vId: string) => {
    const { data } = await supabase
      .from('product_reviews')
      .select('*')
      .eq('video_id', vId)
      .order('created_at', { ascending: false })
      .limit(20)
    const list = (data as ProductReview[]) || []
    if (list.length === 0) { setReviews([]); return }
    const buyerIds = Array.from(new Set(list.map(r => r.buyer_id)))
    const { data: buyers } = await supabase.from('profiles').select('*').in('id', buyerIds)
    const buyerMap = new Map((buyers || []).map((b: any) => [b.id, b]))
    setReviews(list.map(r => ({ ...r, buyer: buyerMap.get(r.buyer_id) || null })))
  }

  useEffect(() => {
    if (!videoId) return
    supabase
      .from('videos')
      .select('*')
      .eq('id', videoId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setVideo(data as Video)
          loadVariants((data as Video).id)
          loadReviews((data as Video).id)
          if (user) {
            supabase
              .from('profiles')
              .select('full_name')
              .eq('id', user.id)
              .maybeSingle()
              .then(({ data: pData }) => {
                if (pData?.full_name) setName(pData.full_name)
              })
          }
        }
        setLoading(false)
      })
  }, [videoId, user])

  useEffect(() => {
    if (!variantNotice) return
    const t = setTimeout(() => setVariantNotice(''), 3500)
    return () => clearTimeout(t)
  }, [variantNotice])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!video || !user) return

    if (sizes.length > 0 && !selectedSize) {
      setSubmitError('الرجاء اختيار القياس')
      return
    }
    if (colors.length > 0 && !selectedColor) {
      setSubmitError('الرجاء اختيار اللون')
      return
    }

    setSubmitError('')
    setSubmitting(true)

    const code = `FED-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`

    const { error } = await supabase.from('orders').insert({
      order_code: code,
      video_id: video.id,
      merchant_id: video.user_id,
      buyer_id: user.id,
      buyer_name: name,
      phone: phone,
      province: province,
      address: `${province} - ${address}`,
      total_price: video.price,
      selected_size: selectedSize,
      selected_color: selectedColor,
      shared_location: sharedLocation || null,
      status: 'pending',
    })

    setSubmitting(false)
    if (error) {
      console.error('Order error:', error)
      if (error.message?.includes('نفذت الكمية')) {
        setSubmitError(error.message)
        loadVariants(video.id) // حدّث الكميات المعروضة فوراً لأن أحدهم اشترى القطعة الأخيرة للتو
      } else {
        setSubmitError('تعذّر إتمام الطلب، حاول مرة أخرى')
      }
      return
    }
    setOrderCode(code)
    setSuccess(true)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black text-white text-sm">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!video) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black text-white text-center p-6">
        <div>
          <p className="text-sm text-slate-400 mb-4">المنتج غير موجود</p>
          <button onClick={() => navigate('/feed')} className="px-6 py-3 bg-slate-800 rounded-xl text-sm font-bold">
            العودة
          </button>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-600/20 rounded-full blur-[100px]" />
        <div className="bg-slate-900/80 backdrop-blur-xl p-8 rounded-3xl text-center w-full max-w-sm border border-slate-800 relative z-10">
          <div className="w-20 h-20 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-6 border border-emerald-500/30">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h1 className="text-2xl font-black mb-2">تم استلام طلبك!</h1>
          <p className="text-sm text-slate-400 mb-6 leading-relaxed">
            رقم التتبع:<br />
            <b className="text-emerald-400 text-lg block mt-1">{orderCode}</b>
            <span className="text-xs block mt-3">سيتواصل معك التاجر قريباً لتأكيد الشحن.</span>
          </p>
          <button
            onClick={() => navigate('/feed')}
            className="w-full py-4 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm font-bold transition"
          >
            العودة للريلز
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-600/10 rounded-full blur-[80px]" />
      <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 p-8 rounded-3xl w-full max-w-md space-y-6 shadow-2xl relative z-10">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 bg-emerald-500/20 rounded-2xl flex items-center justify-center mx-auto">
            <ShoppingCart className="w-7 h-7 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-black">إتمام الشراء</h1>
          <p className="text-xs text-slate-400 font-bold">الدفع عند الاستلام بضمان فدشي</p>
        </div>

        <div className="bg-black/40 p-4 rounded-2xl border border-slate-800 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-400">المنتج:</span>
            <span className="text-sm font-bold text-white truncate max-w-[60%]">{video.title}</span>
          </div>
          {video.reviews_count > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-400">التقييم:</span>
              <span className="flex items-center gap-1 text-xs font-bold text-amber-400">
                <Star className="w-3.5 h-3.5 fill-amber-400" />
                {video.avg_rating} ({video.reviews_count} تقييم)
              </span>
            </div>
          )}
          <div className="flex justify-between items-center">
            <span className="text-sm font-bold text-slate-300">المبلغ الإجمالي:</span>
            <span className="text-lg font-black text-amber-400">{video.price.toLocaleString('ar')} د.ع</span>
          </div>
        </div>

        {sizes.length > 0 && (
          <div>
            <p className="text-xs font-bold text-slate-400 mb-2">اختر القياس:</p>
            <div className="flex flex-wrap gap-2">
              {sizes.map(s => {
                const soldOut = s.stock <= 0
                const active = selectedSize === s.option_name
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      if (soldOut) { setVariantNotice(`نفذت الكمية لقياس ${s.option_name} 😔`); return }
                      setSelectedSize(s.option_name)
                      setSubmitError('')
                    }}
                    className={`px-4 py-2 rounded-lg text-xs font-black border transition ${
                      soldOut
                        ? 'opacity-30 cursor-not-allowed border-slate-800 text-slate-500'
                        : active
                        ? 'border-emerald-500 bg-emerald-500/20 text-white'
                        : 'border-slate-700 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    {s.option_name}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {colors.length > 0 && (
          <div>
            <p className="text-xs font-bold text-slate-400 mb-2">اختر اللون:</p>
            <div className="flex flex-wrap gap-2">
              {colors.map(c => {
                const soldOut = c.stock <= 0
                const active = selectedColor === c.option_name
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      if (soldOut) { setVariantNotice(`نفذت الكمية للون ${c.option_name} 😔`); return }
                      setSelectedColor(c.option_name)
                      setSubmitError('')
                    }}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold border transition ${
                      soldOut
                        ? 'opacity-30 cursor-not-allowed border-slate-800 text-slate-500'
                        : active
                        ? 'border-emerald-500 bg-emerald-500/20 text-white'
                        : 'border-slate-700 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    {c.option_hex && (
                      <span className="w-3.5 h-3.5 rounded-full border border-white/20" style={{ background: c.option_hex }} />
                    )}
                    {c.option_name}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {variantNotice && (
          <div className="bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold py-2.5 px-3 rounded-xl text-center">
            {variantNotice}
          </div>
        )}

        {submitError && (
          <div className="bg-brand-600/15 border border-brand-600/30 text-brand-400 text-xs font-bold py-2.5 px-3 rounded-xl text-center">
            {submitError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="الاسم الكامل"
            required
            className="w-full px-4 py-3.5 bg-black/50 border border-slate-700 focus:border-emerald-500 rounded-xl text-sm text-white focus:outline-none transition"
          />
          <input
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="رقم الهاتف"
            required
            className="w-full px-4 py-3.5 bg-black/50 border border-slate-700 focus:border-emerald-500 rounded-xl text-sm text-white focus:outline-none transition"
          />
          <select
            value={province}
            onChange={e => setProvince(e.target.value)}
            required
            className="w-full px-4 py-3.5 bg-black/50 border border-slate-700 focus:border-emerald-500 rounded-xl text-sm text-slate-300 focus:outline-none transition"
          >
            <option value="" disabled>اختر المحافظة...</option>
            {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <textarea
            value={address}
            onChange={e => setAddress(e.target.value)}
            rows={2}
            placeholder="المنطقة، الشارع، أقرب نقطة دالة..."
            required
            className="w-full px-4 py-3.5 bg-black/50 border border-slate-700 focus:border-emerald-500 rounded-xl text-sm text-white focus:outline-none transition resize-none"
          />

          {sharedLocation ? (
            <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-2.5">
              <span className="text-[11px] text-emerald-400 font-bold flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" /> تم إرفاق موقعك مع الطلب
              </span>
              <button type="button" onClick={() => setSharedLocation('')} className="text-slate-500 text-xs">إزالة</button>
            </div>
          ) : (
            <button
              type="button"
              onClick={shareMyLocation}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 border border-dashed border-slate-700 rounded-xl text-[11px] font-bold text-slate-400 hover:border-emerald-500 hover:text-emerald-400 transition"
            >
              <MapPin className="w-3.5 h-3.5" /> مشاركة موقعي الجغرافي مع التاجر (اختياري)
            </button>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-90 disabled:opacity-50 rounded-xl text-sm font-black text-white shadow-lg shadow-emerald-500/30 transition active:scale-95"
          >
            {submitting ? 'جارٍ التأكيد...' : 'تأكيد الطلب'}
          </button>
        </form>

        <button
          onClick={() => navigate('/feed')}
          className="w-full text-center text-xs font-bold text-slate-500 hover:text-white transition flex items-center justify-center gap-1"
        >
          <ArrowRight className="w-4 h-4" />
          إلغاء والعودة للريلز
        </button>

        {reviews.length > 0 && (
          <div className="space-y-3 pt-2 border-t border-slate-800">
            <p className="text-xs font-bold text-slate-400">آراء المشترين ({reviews.length})</p>
            <div className="space-y-2 max-h-48 overflow-y-auto no-scrollbar">
              {reviews.map(r => (
                <div key={r.id} className="bg-black/30 p-3 rounded-xl">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-slate-300">@{r.buyer?.username || 'مشتري'}</span>
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map(n => (
                        <Star key={n} className={`w-3 h-3 ${n <= r.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-700'}`} />
                      ))}
                    </div>
                  </div>
                  {r.comment && <p className="text-[11px] text-slate-400">{r.comment}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
