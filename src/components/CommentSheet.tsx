import { useEffect, useState, useRef, FormEvent } from 'react'
import { X, Send, CornerDownLeft } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { Comment } from '../lib/types'

interface Props {
  videoId: string
  onClose: () => void
}

export default function CommentSheet({ videoId, onClose }: Props) {
  const { user, profile } = useAuth()
  const isModerator = profile?.role === 'admin' || profile?.role === 'super_admin'
  const [comments, setComments] = useState<Comment[]>([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [replyingTo, setReplyingTo] = useState<Comment | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadComments()
  }, [videoId])

  const loadComments = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('comments')
      .select('*, profiles!comments_user_id_fkey(*)')
      .eq('video_id', videoId)
      .order('created_at', { ascending: true })
      .limit(200)
    setComments((data as Comment[]) || [])
    setLoading(false)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!text.trim() || !user) return
    const { data } = await supabase
      .from('comments')
      .insert({ user_id: user.id, video_id: videoId, text: text.trim(), parent_id: replyingTo?.id || null })
      .select('*, profiles!comments_user_id_fkey(*)')
      .single()
    if (data) {
      setComments(prev => [...prev, data as Comment])
      setText('')
      setReplyingTo(null)
    }
  }

  const handleDelete = async (id: string) => {
    await supabase.from('comments').delete().eq('id', id)
    setComments(prev => prev.filter(c => c.id !== id && c.parent_id !== id))
  }

  const formatTime = (date: string) => {
    const diff = Date.now() - new Date(date).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'الآن'
    if (mins < 60) return `قبل ${mins} دقيقة`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `قبل ${hours} ساعة`
    const days = Math.floor(hours / 24)
    return `قبل ${days} يوم`
  }

  const topLevel = comments.filter(c => !c.parent_id)
  const repliesOf = (parentId: string) => comments.filter(c => c.parent_id === parentId)

  const CommentRow = ({ c, isReply }: { c: Comment; isReply?: boolean }) => {
    const avatar = c.profiles?.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${c.profiles?.username || 'U'}`
    return (
      <div className={`flex gap-3 items-start group ${isReply ? 'pr-10 mt-3' : ''}`}>
        <img src={avatar} alt="" className={`rounded-full bg-slate-800 object-cover flex-shrink-0 ${isReply ? 'w-6 h-6' : 'w-8 h-8'}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <b className="text-slate-300 text-xs">@{c.profiles?.username}</b>
            <span className="text-[10px] text-slate-600">{formatTime(c.created_at)}</span>
          </div>
          <p className="text-slate-100 text-sm mt-0.5 break-words">{c.text}</p>
          <div className="flex items-center gap-3 mt-1">
            {!isReply && (
              <button
                onClick={() => setReplyingTo(c)}
                className="text-slate-500 hover:text-brand-400 text-[11px] font-bold flex items-center gap-1"
              >
                <CornerDownLeft className="w-3 h-3" /> رد
              </button>
            )}
            {(user?.id === c.user_id || isModerator) && (
              <button
                onClick={() => handleDelete(c.id)}
                className="text-slate-600 hover:text-brand-500 text-[10px] opacity-0 group-hover:opacity-100 transition"
              >
                حذف
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm z-[60]" onClick={onClose} />
      <div className="absolute bottom-0 left-0 right-0 z-[61] bg-slate-900 rounded-t-3xl flex flex-col max-h-[65vh] animate-slideUp" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center p-4 border-b border-slate-800">
          <h3 className="font-black text-sm text-slate-200">
            {comments.length} تعليق
          </h3>
          <button onClick={onClose} className="text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div ref={listRef} className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-4">
          {loading ? (
            <div className="text-center text-slate-500 text-xs py-8">جارٍ التحميل...</div>
          ) : topLevel.length === 0 ? (
            <div className="text-center text-slate-500 text-xs py-8">لا توجد تعليقات بعد. كن أول من يعلّق!</div>
          ) : (
            topLevel.map(c => (
              <div key={c.id}>
                <CommentRow c={c} />
                {repliesOf(c.id).map(r => <CommentRow key={r.id} c={r} isReply />)}
              </div>
            ))
          )}
        </div>

        {user ? (
          <form onSubmit={handleSubmit} className="border-t border-slate-800">
            {replyingTo && (
              <div className="flex items-center justify-between px-4 pt-2.5">
                <span className="text-[11px] text-slate-500">
                  الرد على <b className="text-slate-300">@{replyingTo.profiles?.username}</b>
                </span>
                <button type="button" onClick={() => setReplyingTo(null)} className="text-slate-500 text-xs">✕</button>
              </div>
            )}
            <div className="p-3 flex gap-2">
              <input
                type="text"
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder={replyingTo ? 'اكتب ردّك...' : 'أضف تعليقاً لطيفاً...'}
                className="flex-1 bg-slate-800 border border-slate-700 focus:border-brand-500 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none transition"
              />
              <button
                type="submit"
                disabled={!text.trim()}
                className="bg-brand-600 hover:bg-brand-500 disabled:opacity-30 px-4 py-2.5 rounded-xl transition"
              >
                <Send className="w-4 h-4 text-white" />
              </button>
            </div>
          </form>
        ) : (
          <div className="p-3 border-t border-slate-800 text-center">
            <p className="text-xs text-slate-500">سجّل دخولك للتعليق</p>
          </div>
        )}
      </div>
    </>
  )
}
