import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowRight, Send, CheckCircle2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { Message, Profile } from '../lib/types'

export default function ChatThreadPage() {
  const { conversationId } = useParams<{ conversationId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [messages, setMessages] = useState<Message[]>([])
  const [otherUser, setOtherUser] = useState<Profile | null>(null)
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!conversationId || !user) return

    const load = async () => {
      setLoading(true)

      const { data: conv } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .maybeSingle()

      if (conv) {
        const otherId = conv.user_a === user.id ? conv.user_b : conv.user_a
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', otherId).maybeSingle()
        setOtherUser((profile as Profile) || null)
      }

      const { data: msgs } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(500)

      setMessages((msgs as Message[]) || [])
      setLoading(false)

      // وضع علامة "مقروءة" على كل الرسائل الموجّهة لي في هذه المحادثة
      await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('conversation_id', conversationId)
        .neq('sender_id', user.id)
        .eq('is_read', false)
    }

    load()

    const channel = supabase
      .channel(`chat:${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          setMessages(prev => [...prev, payload.new as Message])
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [conversationId, user])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async () => {
    const content = text.trim()
    if (!content || !conversationId || !user || sending) return
    setSending(true)
    setText('')

    const { error } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content,
    })

    if (error) setText(content) // أعد النص للحقل إن فشل الإرسال حتى لا يضيع
    setSending(false)
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <div className="flex items-center gap-3 p-4 border-b border-slate-900 shrink-0">
        <button onClick={() => navigate('/inbox')} className="text-slate-400">
          <ArrowRight className="w-5 h-5" />
        </button>
        {otherUser && (
          <>
            <img
              src={otherUser.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${otherUser.username}`}
              className="w-9 h-9 rounded-full object-cover"
            />
            <div className="flex items-center gap-1">
              <span className="font-black text-sm">@{otherUser.username}</span>
              {otherUser.is_verified && <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />}
            </div>
          </>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {loading ? (
          <p className="text-center text-slate-500 text-xs py-10">جارٍ التحميل...</p>
        ) : messages.length === 0 ? (
          <p className="text-center text-slate-500 text-xs py-10">ابدأ المحادثة بإرسال أول رسالة 👋</p>
        ) : (
          messages.map(m => {
            const mine = m.sender_id === user?.id
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-start' : 'justify-end'}`}>
                <div
                  className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm break-words ${
                    mine ? 'bg-brand-600 text-white rounded-bl-sm' : 'bg-slate-800 text-slate-100 rounded-br-sm'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="p-3 border-t border-slate-900 flex items-center gap-2 shrink-0">
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') sendMessage() }}
          placeholder="اكتب رسالة..."
          maxLength={2000}
          className="flex-1 bg-slate-900 border border-slate-800 rounded-full px-4 py-2.5 text-sm text-white outline-none focus:border-brand-600"
        />
        <button
          onClick={sendMessage}
          disabled={!text.trim() || sending}
          className="w-10 h-10 rounded-full bg-brand-600 flex items-center justify-center shrink-0 disabled:opacity-40"
        >
          <Send className="w-4 h-4 text-white" />
        </button>
      </div>
    </div>
  )
}
