import { useState, FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Search, Package, ArrowRight, Clock, CheckCircle2, Truck, XCircle, MapPin, Phone, User } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { Order } from '../lib/types'

const STATUS_STEPS = [
  { key: 'pending', label: 'تم استلام الطلب', icon: Clock },
  { key: 'confirmed', label: 'تم تأكيد الطلب', icon: CheckCircle2 },
  { key: 'shipped', label: 'الطلب في الطريق', icon: Truck },
  { key: 'delivered', label: 'تم التوصيل', icon: CheckCircle2 },
]

export default function OrderTrackingPage() {
  const navigate = useNavigate()
  const { code: paramCode } = useParams<{ code?: string }>()
  const { user } = useAuth()
  const [code, setCode] = useState(paramCode || '')
  const [order, setOrder] = useState<Order | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault()
    if (!code.trim()) return
    setLoading(true)
    setNotFound(false)
    setOrder(null)

    const { data } = await supabase
      .from('orders')
      .select('*, videos!orders_video_id_fkey(*)')
      .ilike('order_code', code.trim())
      .maybeSingle()

    if (data) {
      setOrder(data as Order)
    } else {
      setNotFound(true)
    }
    setLoading(false)
  }

  const currentStepIndex = order ? STATUS_STEPS.findIndex(s => s.key === order.status) : -1
  const isCancelled = order?.status === 'cancelled'

  return (
    <div className="min-h-screen bg-black text-white p-4 pb-20">
      <div className="max-w-md mx-auto space-y-5">
        <div className="flex items-center gap-3 pt-2">
          <button onClick={() => navigate('/feed')} className="text-slate-400 text-sm font-bold">
            رجوع
          </button>
          <h1 className="text-xl font-black flex items-center gap-2">
            <Package className="w-6 h-6 text-cyan-400" />
            تتبع الطلب
          </h1>
        </div>

        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
            <input
              type="text"
              value={code}
              onChange={e => setCode(e.target.value)}
              placeholder="أدخل رقم المرجع (مثال: FED-...)"
              className="w-full pr-11 pl-4 py-3.5 bg-slate-900 border border-slate-800 focus:border-cyan-500 rounded-xl text-sm text-white focus:outline-none transition font-mono"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-3.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 rounded-xl text-sm font-bold transition"
          >
            بحث
          </button>
        </form>

        {notFound && (
          <div className="bg-brand-600/15 border border-brand-600/30 text-brand-400 text-sm font-bold py-4 px-4 rounded-xl text-center">
            لم يتم العثور على طلب بهذا الرقم. تأكد من الرقم المرجعي.
          </div>
        )}

        {order && (
          <div className="space-y-4 animate-fadeIn">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-[10px] text-slate-400 font-bold">رقم المرجع</p>
                  <p className="text-sm font-black font-mono text-cyan-400">{order.order_code}</p>
                </div>
                <div className="text-left">
                  <p className="text-[10px] text-slate-400 font-bold">المبلغ</p>
                  <p className="text-sm font-black text-amber-400">{order.total_price.toLocaleString('ar')} د.ع</p>
                </div>
              </div>
              {order.videos && (
                <div className="flex items-center gap-3 bg-black/30 rounded-xl p-2.5">
                  <video src={order.videos.video_url} className="w-14 h-16 object-cover rounded-lg bg-slate-800" muted preload="metadata" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{order.videos.title}</p>
                    <p className="text-[10px] text-slate-500">{order.videos.price.toLocaleString('ar')} د.ع</p>
                  </div>
                </div>
              )}
            </div>

            {isCancelled ? (
              <div className="bg-brand-600/10 border border-brand-600/30 rounded-2xl p-6 text-center">
                <XCircle className="w-12 h-12 text-brand-500 mx-auto mb-3" />
                <p className="text-sm font-black text-brand-400">تم إلغاء هذا الطلب</p>
              </div>
            ) : (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-1">
                {STATUS_STEPS.map((step, idx) => {
                  const Icon = step.icon
                  const isDone = idx <= currentStepIndex
                  const isCurrent = idx === currentStepIndex
                  const isLast = idx === STATUS_STEPS.length - 1
                  return (
                    <div key={step.key} className="flex gap-3 items-start">
                      <div className="flex flex-col items-center">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition ${
                          isDone ? 'bg-cyan-500 border-cyan-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-600'
                        } ${isCurrent ? 'ring-4 ring-cyan-500/20' : ''}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        {!isLast && (
                          <div className={`w-0.5 h-8 ${isDone && idx < currentStepIndex ? 'bg-cyan-500' : 'bg-slate-800'}`} />
                        )}
                      </div>
                      <div className="pt-1.5">
                        <p className={`text-sm font-bold ${isDone ? 'text-white' : 'text-slate-600'}`}>
                          {step.label}
                        </p>
                        {isCurrent && <p className="text-[10px] text-cyan-400 font-bold mt-0.5">المرحلة الحالية</p>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2 text-xs">
              <div className="flex items-center gap-2 text-slate-300">
                <User className="w-4 h-4 text-slate-500" />
                <span>{order.buyer_name}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <Phone className="w-4 h-4 text-slate-500" />
                <span>{order.phone}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <MapPin className="w-4 h-4 text-slate-500" />
                <span>{order.address}</span>
              </div>
            </div>

            {user && (
              <button
                onClick={() => navigate('/orders')}
                className="w-full py-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm font-bold text-slate-300 transition"
              >
                عرض كل طلباتي
              </button>
            )}
          </div>
        )}

        {!order && !notFound && !loading && (
          <div className="text-center py-12 text-slate-600 text-sm">
            <Package className="w-12 h-12 text-slate-800 mx-auto mb-3" />
            أدخل رقم المرجع لتتبع حالة طلبك
          </div>
        )}
      </div>
    </div>
  )
}
