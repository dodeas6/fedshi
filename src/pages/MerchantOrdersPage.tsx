import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Package, Clock, Truck, CheckCircle2, XCircle, TrendingUp, MessageCircle } from 'lucide-react'
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

export default function MerchantOrdersPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')

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
      .eq('merchant_id', user.id)
      .order('created_at', { ascending: false })
    setOrders((data as Order[]) || [])
    setLoading(false)
  }

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('orders').update({ status }).eq('id', id)
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: status as Order['status'] } : o))
  }

  const [actionError, setActionError] = useState('')

  const messageBuyer = async (buyerId: string) => {
    setActionError('')
    const { data, error } = await supabase.rpc('get_or_create_conversation', { other_user: buyerId })
    if (error) {
      setActionError(
        error.message?.includes('نفسك')
          ? 'هذا حسابك أنت — لا يمكنك مراسلة نفسك (هذا طلب اختبار من نفس حسابك)'
          : 'تعذّر فتح المحادثة، حاول مرة أخرى'
      )
      return
    }
    if (data) navigate(`/inbox/${data}`)
  }

  const filtered = filter === 'all' ? orders : orders.filter(o => o.status === filter)
  const totalRevenue = orders.filter(o => o.status === 'delivered').reduce((sum, o) => sum + o.total_price, 0)
  const pendingCount = orders.filter(o => o.status === 'pending').length

  const statusFilters = ['all', 'pending', 'confirmed', 'shipped', 'delivered', 'cancelled']

  return (
    <div className="min-h-screen bg-black text-white p-4 pb-20">
      <div className="max-w-md mx-auto space-y-5">
        <div className="flex items-center gap-3 pt-2">
          <button onClick={() => navigate('/profile')} className="text-slate-400 text-sm font-bold">
            رجوع
          </button>
          <h1 className="text-xl font-black flex items-center gap-2">
            <Package className="w-6 h-6 text-emerald-400" />
            الطلبات والمبيعات
          </h1>
        </div>

        {actionError && (
          <div className="bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold py-2.5 px-4 rounded-xl text-center">
            {actionError}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <p className="text-[10px] text-slate-400 font-bold mb-1">إجمالي المبيعات</p>
            <p className="text-lg font-black text-emerald-400">{totalRevenue.toLocaleString('ar')} د.ع</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <p className="text-[10px] text-slate-400 font-bold mb-1">طلبات معلّقة</p>
            <p className="text-lg font-black text-amber-400">{pendingCount}</p>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {statusFilters.map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition ${
                filter === s ? 'bg-brand-600 text-white' : 'bg-slate-900 text-slate-400 border border-slate-800'
              }`}
            >
              {s === 'all' ? 'الكل' : STATUS_INFO[s]?.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center text-slate-500 text-xs py-12">جارٍ التحميل...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm">لا توجد طلبات</div>
        ) : (
          <div className="space-y-3">
            {filtered.map(order => {
              const info = STATUS_INFO[order.status] || STATUS_INFO.pending
              const StatusIcon = info.icon
              return (
                <div key={order.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-black text-white">{order.order_code}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${info.color}`}>
                          {info.label}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 truncate">{order.videos?.title || 'منتج'}</p>
                    </div>
                    <span className="text-sm font-black text-amber-400 flex-shrink-0">{order.total_price.toLocaleString('ar')} د.ع</span>
                  </div>

                  <div className="text-xs text-slate-300 space-y-1 bg-black/30 rounded-xl p-3">
                    <p><b className="text-slate-400">الزبون:</b> {order.buyer_name}</p>
                    <p><b className="text-slate-400">الهاتف:</b> {order.phone}</p>
                    <p><b className="text-slate-400">العنوان:</b> {order.address}</p>
                    {order.shared_location && (
                      <a
                        href={`https://www.google.com/maps?q=${order.shared_location}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-400 underline block"
                      >
                        📍 عرض الموقع الدقيق الذي شاركه الزبون
                      </a>
                    )}
                  </div>

                  {order.buyer_id && (
                    <button
                      onClick={() => messageBuyer(order.buyer_id!)}
                      className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5"
                    >
                      <MessageCircle className="w-3.5 h-3.5" /> راسل الزبون
                    </button>
                  )}

                  <div className="flex gap-2">
                    {order.status === 'pending' && (
                      <button
                        onClick={() => updateStatus(order.id, 'confirmed')}
                        className="flex-1 py-2 bg-cyan-600/20 text-cyan-400 text-xs font-bold rounded-lg hover:bg-cyan-600/30 transition"
                      >
                        تأكيد الطلب
                      </button>
                    )}
                    {order.status === 'confirmed' && (
                      <button
                        onClick={() => updateStatus(order.id, 'shipped')}
                        className="flex-1 py-2 bg-blue-600/20 text-blue-400 text-xs font-bold rounded-lg hover:bg-blue-600/30 transition"
                      >
                        بدء الشحن
                      </button>
                    )}
                    {order.status === 'shipped' && (
                      <button
                        onClick={() => updateStatus(order.id, 'delivered')}
                        className="flex-1 py-2 bg-emerald-600/20 text-emerald-400 text-xs font-bold rounded-lg hover:bg-emerald-600/30 transition"
                      >
                        تم التوصيل
                      </button>
                    )}
                    {order.status !== 'delivered' && order.status !== 'cancelled' && (
                      <button
                        onClick={() => updateStatus(order.id, 'cancelled')}
                        className="py-2 px-3 bg-brand-600/20 text-brand-400 text-xs font-bold rounded-lg hover:bg-brand-600/30 transition"
                      >
                        إلغاء
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
