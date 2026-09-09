import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Package, Clock, CheckCircle2, Truck, XCircle, Search, ChevronLeft, MessageCircle, Star } from 'lucide-react'
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
  const [reviewedOrderIds, setReviewedOrderIds] = useState<Set<string>>(new Set())
  const [reviewingOrder, setReviewingOrder] = useState<Order | null>(null)
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewComment, setReviewComment] = useState('')
  const [submittingReview, setSubmittingReview] = useState(false)
  const [actionError, setActionError] = useState('')

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
    const list = (data as Order[]) || []
    setOrders(list)

    const deliveredIds = list.filter(o => o.status === 'delivered').map(o => o.id)
    if (deliveredIds.length > 0) {
      const { data: existingReviews } = await supabase
        .from('product_reviews')
        .select('order_id')
        .in('order_id', deliveredIds)
      setReviewedOrderIds(new Set((existingReviews || []).map((r: any) => r.order_id)))
    }
    setLoading(false)
  }

  const submitReview = async () => {
    if (!reviewingOrder || !user) return
    setSubmittingReview(true)
    const { error } = await supabase.from('product_reviews').insert({
      order_id: reviewingOrder.id,
      video_id: reviewingOrder.video_id,
      buyer_id: user.id,
      rating: reviewRating,
      comment: reviewComment.trim(),
    })
    setSubmittingReview(false)
    if (!error) {
      setReviewedOrderIds(prev => new Set(prev).add(reviewingOrder.id))
      setReviewingOrder(null)
      setReviewRating(5)
      setReviewComment('')
    }
  }

  const messageMerchant = async (merchantId: string) => {
    setActionError('')
    const { data, error } = await supabase.rpc('get_or_create_conversation', { other_user: merchantId })
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

        {actionError && (
          <div className="bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold py-2.5 px-4 rounded-xl text-center">
            {actionError}
          </div>
        )}

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
                <div
                  key={order.id}
                  onClick={() => navigate(`/track/${order.order_code}`)}
                  className="w-full text-right bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 space-y-3 transition cursor-pointer"
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
                    <div className="flex items-center gap-2">
                      {order.merchant_id && (
                        <button
                          onClick={(e) => { e.stopPropagation(); messageMerchant(order.merchant_id) }}
                          className="text-[10px] font-bold text-brand-400 border border-brand-500/30 px-2 py-1 rounded-md hover:bg-brand-500/10 transition flex items-center gap-1"
                        >
                          <MessageCircle className="w-3 h-3" /> راسل التاجر
                        </button>
                      )}
                      <span className="text-[10px] text-slate-500">{new Date(order.created_at).toLocaleDateString('ar')}</span>
                    </div>
                  </div>

                  {order.status === 'delivered' && (
                    reviewedOrderIds.has(order.id) ? (
                      <p className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> تم تقييم هذا المنتج، شكراً لك 🙏
                      </p>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); setReviewingOrder(order) }}
                        className="w-full py-2 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold rounded-lg hover:bg-amber-500/20 transition flex items-center justify-center gap-1.5"
                      >
                        <Star className="w-3.5 h-3.5" /> قيّم هذا المنتج
                      </button>
                    )
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {reviewingOrder && (
        <>
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[90]" onClick={() => setReviewingOrder(null)} />
          <div className="fixed bottom-0 left-0 right-0 z-[91] bg-slate-900 rounded-t-3xl p-5 max-w-md mx-auto space-y-4">
            <h3 className="text-sm font-black text-center">قيّم تجربتك مع هذا المنتج</h3>

            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} onClick={() => setReviewRating(n)}>
                  <Star className={`w-8 h-8 transition ${n <= reviewRating ? 'fill-amber-400 text-amber-400' : 'text-slate-700'}`} />
                </button>
              ))}
            </div>

            <textarea
              value={reviewComment}
              onChange={e => setReviewComment(e.target.value)}
              rows={3}
              placeholder="اكتب رأيك بالمنتج (اختياري)..."
              className="w-full px-4 py-3 bg-black border border-slate-800 rounded-xl text-sm text-white resize-none focus:outline-none focus:border-amber-500"
            />

            <div className="flex gap-2">
              <button
                onClick={() => setReviewingOrder(null)}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm font-bold transition"
              >
                إلغاء
              </button>
              <button
                onClick={submitReview}
                disabled={submittingReview}
                className="flex-1 py-3 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 rounded-xl text-sm font-black text-white transition"
              >
                {submittingReview ? 'جارٍ الإرسال...' : 'إرسال التقييم'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
