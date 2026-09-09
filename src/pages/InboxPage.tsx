import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Heart, MessageCircle, UserPlus, Package, Bell } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { Notification, Conversation } from '../lib/types'

export default function InboxPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingConvos, setLoadingConvos] = useState(true)
  const [tab, setTab] = useState<'notifications' | 'messages'>('notifications')

  useEffect(() => {
    if (!user) return
    loadNotifications()
    loadConversations()

    const channel = supabase
      .channel('inbox-conversations')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversations' },
        () => loadConversations()
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user])

  const loadConversations = async () => {
    if (!user) return
    setLoadingConvos(true)
    const { data } = await supabase
      .from('conversations')
      .select('*')
      .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
      .order('last_message_at', { ascending: false })
      .limit(50)

    const list = (data as Conversation[]) || []
    if (list.length === 0) { setConversations([]); setLoadingConvos(false); return }

    const otherIds = Array.from(new Set(list.map(c => (c.user_a === user.id ? c.user_b : c.user_a))))
    const { data: profiles } = await supabase.from('profiles').select('*').in('id', otherIds)
    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]))

    const { data: unread } = await supabase
      .from('messages')
      .select('conversation_id')
      .eq('is_read', false)
      .neq('sender_id', user.id)
      .in('conversation_id', list.map(c => c.id))

    const unreadCountMap = new Map<string, number>()
    for (const row of unread || []) {
      unreadCountMap.set(row.conversation_id, (unreadCountMap.get(row.conversation_id) || 0) + 1)
    }

    setConversations(list.map(c => ({
      ...c,
      otherUser: profileMap.get(c.user_a === user.id ? c.user_b : c.user_a) || null,
      unreadCount: unreadCountMap.get(c.id) || 0,
    })))
    setLoadingConvos(false)
  }

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
      case 'message': return <MessageCircle className="w-5 h-5 text-brand-400" />
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
        ) : loadingConvos ? (
          <div className="text-center text-slate-500 text-xs py-12">جارٍ التحميل...</div>
        ) : conversations.length === 0 ? (
          <div className="text-center py-20 text-slate-500 text-sm px-6">
            <MessageCircle className="w-12 h-12 text-slate-700 mx-auto mb-3" />
            لا توجد محادثات بعد. راسل تاجراً من صفحة أحد منتجاته لتبدأ محادثة.
          </div>
        ) : (
          <div className="space-y-2">
            {conversations.map(c => {
              const other = c.otherUser
              const avatar = other?.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${other?.username || 'U'}`
              return (
                <button
                  key={c.id}
                  onClick={() => navigate(`/inbox/${c.id}`)}
                  className="w-full flex items-center gap-3 p-3 rounded-2xl border border-slate-800 bg-slate-900 hover:bg-slate-800/70 transition text-right"
                >
                  <img src={avatar} alt="" className="w-11 h-11 rounded-full bg-slate-800 object-cover shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm truncate ${c.unreadCount ? 'font-black text-white' : 'font-bold text-slate-200'}`}>
                      @{other?.username || 'مستخدم'}
                    </p>
                    <p className={`text-xs truncate ${c.unreadCount ? 'text-slate-300 font-bold' : 'text-slate-500'}`}>
                      {c.last_message || 'ابدأ المحادثة'}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-[10px] text-slate-600">{formatTime(c.last_message_at)}</span>
                    {!!c.unreadCount && (
                      <span className="min-w-[18px] h-[18px] px-1 bg-brand-600 rounded-full text-[10px] font-black text-white flex items-center justify-center">
                        {c.unreadCount > 9 ? '9+' : c.unreadCount}
                      </span>
                    )}
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
