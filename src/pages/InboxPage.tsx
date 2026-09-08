import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Heart, MessageCircle, UserPlus, Package, Bell } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { Notification } from '../lib/types'

export default function InboxPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'notifications' | 'messages'>('notifications')

  useEffect(() => {
    if (!user) return
    loadNotifications()
  }, [user])

  const loadNotifications = async () => {
    if (!user) return
    setLoading(true)
    const { data } = await supabase
      .from('notifications')
      .select('*, actor:profiles!notifications_actor_id_fkey(*)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)
    setNotifications((data as Notification[]) || [])

    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false)

    setLoading(false)
  }

  const formatTime = (date: string) => {
    const diff = Date.now() - new Date(date).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'الآن'
    if (mins < 60) return `قبل ${mins} د`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `قبل ${hours} س`
    const days = Math.floor(hours / 24)
    if (days < 7) return `قبل ${days} يوم`
    return new Date(date).toLocaleDateString('ar')
  }

  const iconForType = (type: string) => {
    switch (type) {
      case 'like': return <Heart className="w-5 h-5 text-accent-500 fill-accent-500" />
      case 'comment': return <MessageCircle className="w-5 h-5 text-cyan-400" />
      case 'follow': return <UserPlus className="w-5 h-5 text-emerald-400" />
      case 'order': return <Package className="w-5 h-5 text-amber-400" />
      default: return <Bell className="w-5 h-5 text-slate-400" />
    }
  }

  return (
    <div className="min-h-screen bg-black text-white p-4 pb-20">
      <div className="max-w-md mx-auto space-y-4">
        <div className="flex items-center justify-between pt-2">
          <h1 className="text-2xl font-black">الوارد</h1>
        </div>

        <div className="flex bg-slate-900 rounded-2xl p-1">
          <button
            onClick={() => setTab('notifications')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition ${
              tab === 'notifications' ? 'bg-brand-600 text-white' : 'text-slate-400'
            }`}
          >
            الإشعارات
          </button>
          <button
            onClick={() => setTab('messages')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition ${
              tab === 'messages' ? 'bg-brand-600 text-white' : 'text-slate-400'
            }`}
          >
            الرسائل
          </button>
        </div>

        {tab === 'notifications' ? (
          loading ? (
            <div className="text-center text-slate-500 text-xs py-12">جارٍ التحميل...</div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-20 text-slate-500 text-sm">لا توجد إشعارات حالياً</div>
          ) : (
            <div className="space-y-2">
              {notifications.map(n => {
                const avatar = n.actor?.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${n.actor?.username || 'U'}`
                return (
                  <div
                    key={n.id}
                    className={`flex items-center gap-3 p-3 rounded-2xl border transition ${
                      n.is_read ? 'bg-slate-900/40 border-slate-800/50' : 'bg-slate-900 border-slate-700'
                    }`}
                  >
                    <div className="relative">
                      <img src={avatar} alt="" className="w-11 h-11 rounded-full bg-slate-800 object-cover" />
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-slate-950 flex items-center justify-center border border-slate-800">
                        {iconForType(n.type)}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-200 break-words">{n.text}</p>
                      <span className="text-[10px] text-slate-600">{formatTime(n.created_at)}</span>
                    </div>
                    {n.type === 'order' && (
                      <button
                        onClick={() => navigate('/merchant/orders')}
                        className="text-[10px] font-bold text-amber-400 border border-amber-500/30 px-2 py-1 rounded-md hover:bg-amber-500/10 transition"
                      >
                        عرض
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )
        ) : (
          <div className="text-center py-20 text-slate-500 text-sm">
            <MessageCircle className="w-12 h-12 text-slate-700 mx-auto mb-3" />
            الرسائل المباشرة قريباً!
          </div>
        )}
      </div>
    </div>
  )
}
