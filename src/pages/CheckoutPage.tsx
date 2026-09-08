import { useEffect, useState, FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ShoppingCart, CheckCircle2, ArrowRight, MessageCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { Video } from '../lib/types'

const PROVINCES = [
  'بغداد', 'البصرة', 'أربيل', 'الموصل', 'النجف', 'كربلاء', 'كركوك',
  'الأنبار', 'ديالى', 'صلاح الدين', 'ذي قار', 'ميسان', 'المثنى',
  'واسط', 'بابل', 'القادسية', 'سليمانية', 'دهوك',
]

const SIZES = ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL']

export default function CheckoutPage() {
  const { videoId } = useParams<{ videoId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [video, setVideo] = useState<Video | null>(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [province, setProvince] = useState('')
  const [address, setAddress] = useState('')
  const [selectedSize, setSelectedSize] = useState('')
  const [selectedColor, setSelectedColor] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [orderCode, setOrderCode] = useState('')
  const [error, setError] = useState('')

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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!video || !user) return
    setSubmitting(true)
    setError('')

    const { data, error: rpcError } = await supabase.rpc('create_order', {
      p_video_id: video.id,
      p_buyer_name: name,
      p_phone: phone,
      p_province: province,
      p_address: `${province} - ${address}`,
      p_selected_size: selectedSize,
      p_selected_color: selectedColor,
    })

    setSubmitting(false)
    if (rpcError) {
      setError(rpcError.message.includes('suspended') ? 'حسابك موقوف. تواصل مع الدعم.' : 'تعذّر إنشاء الطلب. حاول مرة أخرى.')
      return
    }
    const { data: orderData } = await supabase
      .from('orders')
      .select('order_code')
      .eq('id', data as string)
      .maybeSingle()
    if (orderData?.order_code) setOrderCode(orderData.order_code)
    setSuccess(true)
  }

  const handleMessage = async () => {
    if (!video || !user) return
    const { data } = await supabase.rpc('start_conversation', { p_other_user_id: video.user_id })
    if (data) navigate(`/messages/${data}`)
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
          <button onClick={() => navigate('/feed')} className="px-6 py-3 bg-slate-800 rounded-xl text-sm font-bold">العودة</button>
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
          <button onClick={() => navigate(`/track/${orderCode}`)} className="w-full py-3.5 bg-cyan-600 hover:bg-cyan-500 rounded-xl text-sm font-bold transition mb-2">
            تتبع الطلب الآن
          </button>
          <button onClick={() => navigate('/feed')} className="w-full py-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm font-bold transition">
            العودة للريلز
          </button>
        </div>
      </div>
    )
  }

  const hasSizes = video.sizes && video.sizes.length > 0
  const hasColors = video.colors && video.colors.length > 0

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4 relative overflow-hidden pb-20">
      <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-600/10 rounded-full blur-[80px]" />
      <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 p-6 rounded-3xl w-full max-w-md space-y-5 shadow-2xl relative z-10">
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
          <div className="flex justify-between items-center">
            <span className="text-sm font-bold text-slate-300">المبلغ الإجمالي:</span>
            <span className="text-lg font-black text-amber-400">{video.price.toLocaleString('ar')} د.ع</span>
          </div>
        </div>

        {/* Size selector */}
        {hasSizes && (
          <div>
            <label className="block text-xs font-bold text-slate-400 mb-2">اختر القياس</label>
            <div className="flex flex-wrap gap-2">
              {video.sizes.map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSelectedSize(s)}
                  className={`px-4 py-2.5 rounded-xl text-sm font-bold border transition ${
                    selectedSize === s
                      ? 'bg-emerald-600 text-white border-emerald-500'
                      : 'bg-black/40 text-slate-300 border-slate-700 hover:border-emerald-600/50'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Color selector */}
        {hasColors && (
          <div>
            <label className="block text-xs font-bold text-slate-400 mb-2">اختر اللون</label>
            <div className="flex flex-wrap gap-2">
              {video.colors.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setSelectedColor(c)}
                  className={`px-4 py-2.5 rounded-xl text-sm font-bold border transition ${
                    selectedColor === c
                      ? 'bg-emerald-600 text-white border-emerald-500'
                      : 'bg-black/40 text-slate-300 border-slate-700 hover:border-emerald-600/50'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
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
          {error && (
            <div className="bg-brand-600/15 border border-brand-600/30 text-brand-400 text-xs font-bold py-2.5 px-4 rounded-xl">
              {error}
            </div>
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
          onClick={handleMessage}
          className="w-full py-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm font-bold text-cyan-400 transition flex items-center justify-center gap-2"
        >
          <MessageCircle className="w-4 h-4" />
          راسل التاجر
        </button>

        <button
          onClick={() => navigate('/feed')}
          className="w-full text-center text-xs font-bold text-slate-500 hover:text-white transition flex items-center justify-center gap-1"
        >
          <ArrowRight className="w-4 h-4" />
          إلغاء والعودة للريلز
        </button>
      </div>
    </div>
  )
}
