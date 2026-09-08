import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Package, Clock, CheckCircle2, Truck, XCircle, Search, ChevronLeft } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { Order } from '../lib/types'

const STATUS_INFO: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: 'قيد المراجعة', color: 'text-amber-400 bg-amber-400/10', icon: Clock },
  confirmed: { label: 'مؤكد', color: 'text-cyan-400 bg-cyan-400/10', icon: CheckCircle2 },
  shipped: { label: 'تم الشحن', color: 'text-blue-400 bg-blue-400/10', icon: Truck },
  delivered: { label: 'تم التوصيل', color: 'text-emerald-400 bg-emerald-400/10', icon: CheckCircle2 },
  cancelled: { label: 'ملغي', color: 'text-brand-500 bg-brand-500/10', icon: XCircle },
}

export default function BuyerOrdersPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    loadOrders()
  }, [user])

  const loadOrders = async () => {
    if (!user) return
    setLoading(true)
    const { data } = await supabase
      .from('orders')
      .select('*, videos!orders_video_id_fkey(*)')
      .eq('buyer_id', user.id)
      .order('created_at', { ascending: false })
    setOrders((data as Order[]) || [])
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-black text-white p-4 pb-20">
      <div className="max-w-md mx-auto space-y-4">
        <div className="flex items-center gap-3 pt-2">
          <button onClick={() => navigate('/profile')} className="text-slate-400 text-sm font-bold flex items-center gap-1">
            <ChevronLeft className="w-4 h-4" />
            رجوع
          </button>
          <h1 className="text-xl font-black flex items-center gap-2">
            <Package className="w-6 h-6 text-cyan-400" />
            طلباتي
          </h1>
        </div>

        <button
          onClick={() => navigate('/track')}
          className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-sm font-bold text-cyan-400 transition flex items-center justify-center gap-2"
        >
          <Search className="w-4 h-4" />
          تتبع طلب برقم المرجع
        </button>

        {loading ? (
          <div className="text-center text-slate-500 text-xs py-12">جارٍ التحميل...</div>
        ) : orders.length === 0 ? (
          <div className="text-center py-12 text-slate-600 text-sm">
            <Package className="w-12 h-12 text-slate-800 mx-auto mb-3" />
            لم تقم بأي طلب بعد
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map(order => {
              const info = STATUS_INFO[order.status] || STATUS_INFO.pending
              const StatusIcon = info.icon
              return (
                <button
                  key={order.id}
                  onClick={() => navigate(`/track/${order.order_code}`)}
                  className="w-full text-right bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 space-y-3 transition"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono font-black text-cyan-400">{order.order_code}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${info.color}`}>
                          {info.label}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 truncate">{order.videos?.title || 'منتج'}</p>
                    </div>
                    {order.videos && (
                      <video src={order.videos.video_url} className="w-10 h-12 object-cover rounded-lg bg-slate-800 flex-shrink-0" muted preload="metadata" />
                    )}
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-black text-amber-400">{order.total_price.toLocaleString('ar')} د.ع</span>
                    <span className="text-[10px] text-slate-500">{new Date(order.created_at).toLocaleDateString('ar')}</span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
