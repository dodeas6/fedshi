import { useEffect, useState, useRef, FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { MessageCircle, ChevronLeft, Send, ArrowLeft } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { Conversation, Message, Profile } from '../lib/types'

export default function MessagesPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { conversationId } = useParams<{ conversationId?: string }>()

  if (conversationId) {
    return <ChatView conversationId={conversationId} />
  }
  return <ConversationList />
}

function ConversationList() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    loadConversations()
  }, [user])

  const loadConversations = async () => {
    if (!user) return
    const { data } = await supabase
      .from('conversations')
      .select('*')
      .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
      .order('last_message_at', { ascending: false })

    const convs = (data as Conversation[]) || []
    const enriched = await Promise.all(
      convs.map(async c => {
        const otherId = c.user_a === user.id ? c.user_b : c.user_a
        const [profRes, lastMsgRes, unreadRes] = await Promise.all([
          supabase.from('profiles').select('*').eq('id', otherId).maybeSingle(),
          supabase.from('messages').select('*').eq('conversation_id', c.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
          supabase.from('messages').select('*', { count: 'exact', head: true }).eq('conversation_id', c.id).eq('is_read', false).neq('sender_id', user.id),
        ])
        return {
          ...c,
          other_user: profRes.data as Profile | null,
          last_message: lastMsgRes.data as Message | null,
          unread_count: unreadRes.count || 0,
        }
      })
    )
    setConversations(enriched)
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-black text-white p-4 pb-24">
      <div className="max-w-md mx-auto space-y-4">
        <div className="flex items-center gap-3 pt-2">
          <button onClick={() => navigate('/feed')} className="text-slate-400">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-black flex items-center gap-2">
            <MessageCircle className="w-6 h-6 text-cyan-400" />
            الرسائل
          </h1>
        </div>

        {loading ? (
          <div className="text-center text-slate-500 text-xs py-12">جارٍ التحميل...</div>
        ) : conversations.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm">
            <MessageCircle className="w-12 h-12 text-slate-800 mx-auto mb-3" />
            لا توجد محادثات بعد
          </div>
        ) : (
          <div className="space-y-2">
            {conversations.map(c => {
              const avatar = c.other_user?.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${c.other_user?.username || 'U'}`
              return (
                <button
                  key={c.id}
                  onClick={() => navigate(`/messages/${c.id}`)}
                  className="w-full flex items-center gap-3 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-3 transition"
                >
                  <img src={avatar} alt="" className="w-12 h-12 rounded-full bg-slate-800 object-cover" />
                  <div className="flex-1 min-w-0 text-right">
                    <div className="flex items-center gap-1.5">
                      <b className="text-sm truncate">@{c.other_user?.username}</b>
                      {c.other_user?.is_verified && <span className="text-cyan-400 text-xs">✔</span>}
                    </div>
                    <p className="text-xs text-slate-500 truncate">{c.last_message?.text || 'ابدأ المحادثة'}</p>
                  </div>
                  {c.unread_count && c.unread_count > 0 ? (
                    <span className="bg-cyan-500 text-white text-[10px] font-black rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5">
                      {c.unread_count}
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function ChatView({ conversationId }: { conversationId: string }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [otherUser, setOtherUser] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!user || !conversationId) return
    loadChat()
    // Subscribe to realtime
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` }, payload => {
        setMessages(prev => [...prev, payload.new as Message])
        if ((payload.new as Message).sender_id !== user.id) {
          supabase.from('messages').update({ is_read: true }).eq('id', (payload.new as Message).id).then()
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user, conversationId])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages])

  const loadChat = async () => {
    if (!user) return
    const { data: conv } = await supabase.from('conversations').select('*').eq('id', conversationId).maybeSingle()
    if (conv) {
      const otherId = (conv as Conversation).user_a === user.id ? (conv as Conversation).user_b : (conv as Conversation).user_a
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', otherId).maybeSingle()
      setOtherUser(prof as Profile | null)
    }
    const { data: msgs } = await supabase.from('messages').select('*').eq('conversation_id', conversationId).order('created_at', { ascending: true })
    setMessages((msgs as Message[]) || [])
    // Mark unread as read
    await supabase.from('messages').update({ is_read: true }).eq('conversation_id', conversationId).neq('sender_id', user.id)
    setLoading(false)
  }

  const handleSend = async (e: FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return
    await supabase.rpc('send_message', { p_conversation_id: conversationId, p_text: text.trim() })
    setText('')
  }

  const formatTime = (date: string) => new Date(date).toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="fixed inset-0 bg-black z-[100] flex flex-col" style={{ maxWidth: '430px', margin: '0 auto' }}>
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-slate-800 bg-black safe-top">
        <button onClick={() => navigate('/messages')} className="text-slate-400">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <img src={otherUser?.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${otherUser?.username || 'U'}`} alt="" className="w-9 h-9 rounded-full bg-slate-800 object-cover" />
        <div>
          <b className="text-sm text-white">@{otherUser?.username}</b>
          {otherUser?.is_verified && <span className="text-cyan-400 text-xs mr-1">✔</span>}
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-2">
        {loading ? (
          <div className="text-center text-slate-500 text-xs py-8">جارٍ التحميل...</div>
        ) : messages.length === 0 ? (
          <div className="text-center text-slate-600 text-xs py-12">ابدأ المحادثة برسالة جديدة</div>
        ) : (
          messages.map(m => {
            const isMine = m.sender_id === user?.id
            return (
              <div key={m.id} className={`flex ${isMine ? 'justify-start' : 'justify-end'}`}>
                <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${
                  isMine ? 'bg-cyan-600 text-white rounded-bl-sm' : 'bg-slate-800 text-slate-100 rounded-br-sm'
                }`}>
                  <p className="break-words">{m.text}</p>
                  <span className={`text-[9px] block mt-1 ${isMine ? 'text-cyan-300' : 'text-slate-500'}`}>{formatTime(m.created_at)}</span>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-3 border-t border-slate-800 bg-black flex gap-2 safe-bottom">
        <input
          type="text"
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="اكتب رسالة..."
          className="flex-1 bg-slate-900 border border-slate-700 focus:border-cyan-500 rounded-xl px-4 py-3 text-sm text-white focus:outline-none transition"
        />
        <button type="submit" disabled={!text.trim()} className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-30 px-4 py-3 rounded-xl transition">
          <Send className="w-4 h-4 text-white" />
        </button>
      </form>
    </div>
  )
}
