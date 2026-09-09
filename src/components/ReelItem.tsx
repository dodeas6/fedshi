import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Heart, MessageCircle, Share2, Bookmark, Plus, Music, CheckCircle2, ShoppingCart, Flag, Send, Volume2, VolumeX } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { getInitialMuted, saveMutedPreference } from '../lib/soundPreference'
import { useAuth } from '../context/AuthContext'
import type { VideoWithProfile } from '../lib/types'
import CommentSheet from './CommentSheet'

interface ReelItemProps {
  video: VideoWithProfile
  isActive: boolean
}

export default function ReelItem({ video, isActive }: ReelItemProps) {
  const navigate = useNavigate()
  const { user, profile, refreshProfile } = useAuth()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(getInitialMuted)
  const [liked, setLiked] = useState(video.is_liked ?? false)
  const [likeCount, setLikeCount] = useState(video.likes_count)
  const [saved, setSaved] = useState(video.is_saved ?? false)
  const [following, setFollowing] = useState(video.is_following ?? false)
  const [showHeart, setShowHeart] = useState(false)
  const [showComments, setShowComments] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [reportSent, setReportSent] = useState(false)
  const [reportError, setReportError] = useState('')
  const [conversationError, setConversationError] = useState('')

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    let cancelled = false
    let watchdog: ReturnType<typeof setTimeout> | undefined

    if (isActive) {
      document.querySelectorAll('video').forEach(el => {
        if (el !== v) { el.pause(); el.currentTime = 0 }
      })

      v.muted = isMuted
      v.play()
        .then(() => { if (!cancelled) setIsPlaying(true); else v.pause() })
        .catch((err) => {
          console.log('[تلقائي] فشل التشغيل الأول:', err?.name, err?.message)
          if (!v.muted && !cancelled) {
            v.muted = true
            setIsMuted(true)
            v.play().then(() => { if (!cancelled) setIsPlaying(true) }).catch((err2) => {
              console.log('[تلقائي] فشل حتى صامتاً:', err2?.name, err2?.message)
            })
          }
        })

      supabase.rpc('increment_view', { v_uuid: video.id }).then()

      // تحقق واحد فقط (وليس تكراراً مستمراً) بعد نصف ثانية من التفعيل:
      // إذا لأي سبب كان هذا الفيديو لا يزال متوقفاً وواحد آخر يعمل رغم
      // محاولة التشغيل، صحّح الوضع تلقائياً مرة واحدة
      watchdog = setTimeout(() => {
        if (cancelled) return
        document.querySelectorAll('video').forEach(el => {
          if (el !== v && !el.paused) { el.pause(); el.currentTime = 0 }
        })
        if (v.paused) {
          v.play().then(() => { if (!cancelled) setIsPlaying(true) }).catch(() => {})
        }
      }, 500)
    } else {
      v.pause()
      v.currentTime = 0
      setIsPlaying(false)
    }

    return () => {
      cancelled = true
      clearTimeout(watchdog)
    }
  }, [isActive, video.id])

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation()
    const v = videoRef.current
    if (!v) return
    const next = !isMuted
    v.muted = next
    setIsMuted(next)
    saveMutedPreference(next)
  }

  useEffect(() => {
    if (!conversationError) return
    const t = setTimeout(() => setConversationError(''), 3500)
    return () => clearTimeout(t)
  }, [conversationError])

  const togglePlay = () => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) {
      // نفس الضمان المطبَّق تلقائياً: حتى الضغط اليدوي على الفيديو
      // (الذي قد يحدث بالخطأ على الفيديو القديم أثناء لمسة تمرير سريعة)
      // يجب أن يوقف أي فيديو آخر أولاً قبل التشغيل
      document.querySelectorAll('video').forEach(el => {
        if (el !== v) { el.pause(); el.currentTime = 0 }
      })
      v.play()
      setIsPlaying(true)
    } else {
      v.pause()
      setIsPlaying(false)
    }
  }

  const handleDoubleTap = () => {
    if (!liked) handleLike()
    setShowHeart(true)
    setTimeout(() => setShowHeart(false), 800)
  }

  const handleLike = async () => {
    if (!user) { navigate('/auth'); return }
    if (liked) {
      setLiked(false)
      setLikeCount(c => c - 1)
      await supabase.from('likes').delete().eq('user_id', user.id).eq('video_id', video.id)
    } else {
      setLiked(true)
      setLikeCount(c => c + 1)
      await supabase.from('likes').insert({ user_id: user.id, video_id: video.id })
    }
  }

  const handleSave = async () => {
    if (!user) { navigate('/auth'); return }
    if (saved) {
      setSaved(false)
      await supabase.from('saved_videos').delete().eq('user_id', user.id).eq('video_id', video.id)
    } else {
      setSaved(true)
      await supabase.from('saved_videos').insert({ user_id: user.id, video_id: video.id })
    }
  }

  const handleFollow = async () => {
    if (!user) { navigate('/auth'); return }
    if (following) {
      setFollowing(false)
      await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', video.user_id)
    } else {
      setFollowing(true)
      await supabase.from('follows').insert({ follower_id: user.id, following_id: video.user_id })
    }
  }

  const handleShare = () => {
    setShowShare(true)
  }

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => { setCopied(false); setShowShare(false) }, 1500)
  }

  const REPORT_REASONS = ['منتج احتيالي أو وهمي', 'محتوى غير لائق', 'مخالف لحقوق الملكية', 'سبب آخر']

  const startConversation = async () => {
    if (!user) { navigate('/auth'); return }
    const { data, error } = await supabase.rpc('get_or_create_conversation', { other_user: video.user_id })
    if (error) {
      setConversationError(error.message?.includes('نفسك') ? 'لا يمكنك مراسلة نفسك' : 'تعذّر فتح المحادثة، حاول مرة أخرى')
      return
    }
    if (data) navigate(`/inbox/${data}`)
  }

  const submitReport = async (reason: string) => {
    if (!user) { navigate('/auth'); return }
    setReportError('')
    const { error } = await supabase.from('reports').insert({
      reporter_id: user.id,
      video_id: video.id,
      reason,
    })
    if (error) {
      if (error.code === '23505') {
        setReportError('لقد أبلغت عن هذا الفيديو مسبقاً')
      } else {
        setReportError('تعذّر إرسال البلاغ، حاول مرة أخرى')
      }
      return
    }
    setReportSent(true)
    setTimeout(() => { setReportSent(false); setShowReport(false) }, 1500)
  }

  const merchant = video.profiles
  const avatar = merchant?.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${merchant?.username || 'U'}`
  const isOwnVideo = user?.id === video.user_id

  return (
    <div className="relative w-full h-full flex flex-col justify-end bg-black" data-vid={video.id}>
      <video
        ref={videoRef}
        src={video.video_url}
        loop
        playsInline
        muted={isMuted}
        preload={isActive ? 'auto' : 'metadata'}
        onClick={togglePlay}
        onDoubleClick={handleDoubleTap}
        className="absolute inset-0 w-full h-full object-cover z-[1]"
      />

      {showHeart && (
        <div className="absolute inset-0 flex items-center justify-center z-[5] pointer-events-none">
          <Heart className="w-24 h-24 text-white fill-accent-500 animate-popHeart drop-shadow-2xl" />
        </div>
      )}

      {!isPlaying && isActive && (
        <div className="absolute inset-0 flex items-center justify-center z-[4] pointer-events-none">
          <div className="w-16 h-16 rounded-full bg-black/40 flex items-center justify-center">
            <div className="w-0 h-0 border-l-[20px] border-l-white border-y-[12px] border-y-transparent ml-1" />
          </div>
        </div>
      )}

      <button
        onClick={toggleMute}
        className="absolute top-4 left-4 z-[6] w-9 h-9 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center"
        aria-label={isMuted ? 'تفعيل الصوت' : 'كتم الصوت'}
      >
        {isMuted ? <VolumeX className="w-4 h-4 text-white" /> : <Volume2 className="w-4 h-4 text-white" />}
      </button>

      {conversationError && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[6] bg-brand-600 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xl max-w-[85%] text-center">
          {conversationError}
        </div>
      )}

      <div className="absolute top-16 left-0 right-0 z-[3] flex justify-center gap-8 text-slate-400 text-sm font-bold pointer-events-none">
        <span>المتابَعون</span>
        <span className="text-white border-b-2 border-brand-500 pb-1">لك</span>
      </div>

      <div className="absolute right-3 bottom-24 z-[4] flex flex-col items-center gap-4 text-white">
        <div className="relative mb-1">
          <button onClick={() => navigate(`/u/${video.user_id}`)}>
            <img
              src={avatar}
              alt={merchant?.username}
              className="w-12 h-12 rounded-full border-2 border-white object-cover bg-slate-800"
            />
          </button>
          {!following && !isOwnVideo && (
            <button
              onClick={handleFollow}
              className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-5 h-5 bg-accent-500 rounded-full flex items-center justify-center border-2 border-black"
            >
              <Plus className="w-3 h-3 text-white" strokeWidth={3} />
            </button>
          )}
        </div>

        <button onClick={handleLike} className="flex flex-col items-center gap-1">
          <div className="action-btn">
            <Heart className={`w-7 h-7 transition ${liked ? 'text-accent-500 fill-accent-500' : 'text-white'}`} />
          </div>
          <span className="text-[11px] font-black drop-shadow-md">{likeCount.toLocaleString('ar')}</span>
        </button>

        <button onClick={() => setShowComments(true)} className="flex flex-col items-center gap-1">
          <div className="action-btn">
            <MessageCircle className="w-7 h-7 text-white" />
          </div>
          <span className="text-[11px] font-black drop-shadow-md">{video.comments_count}</span>
        </button>

        <button onClick={handleSave} className="flex flex-col items-center gap-1">
          <div className="action-btn">
            <Bookmark className={`w-7 h-7 transition ${saved ? 'text-amber-400 fill-amber-400' : 'text-white'}`} />
          </div>
          <span className="text-[11px] font-black drop-shadow-md">حفظ</span>
        </button>

        {!isOwnVideo && (
          <button onClick={startConversation} className="flex flex-col items-center gap-1">
            <div className="action-btn">
              <Send className="w-6 h-6 text-white" />
            </div>
            <span className="text-[11px] font-black drop-shadow-md">مراسلة</span>
          </button>
        )}

        <button onClick={handleShare} className="flex flex-col items-center gap-1">
          <div className="action-btn">
            <Share2 className="w-7 h-7 text-white" />
          </div>
          <span className="text-[11px] font-black drop-shadow-md">مشاركة</span>
        </button>

        {!isOwnVideo && (
          <button onClick={() => setShowReport(true)} className="flex flex-col items-center gap-1">
            <div className="action-btn">
              <Flag className="w-6 h-6 text-white/80" />
            </div>
            <span className="text-[11px] font-black drop-shadow-md">إبلاغ</span>
          </button>
        )}
      </div>

      <div className="relative z-[3] px-4 pb-24 pr-20 fade-gradient">
        <div className="flex items-center gap-2 mb-2">
          <button onClick={() => navigate(`/u/${video.user_id}`)} className="text-sm font-black text-white drop-shadow-md">
            @{merchant?.username}
          </button>
          {merchant?.is_verified && <CheckCircle2 className="w-4 h-4 text-cyan-400 fill-cyan-400/30" />}
          {!following && !isOwnVideo && (
            <button
              onClick={handleFollow}
              className="text-[11px] font-bold text-brand-400 border border-brand-500/50 px-2 py-0.5 rounded-md hover:bg-brand-500/20 transition"
            >
              متابعة
            </button>
          )}
        </div>

        <h2 className="text-sm font-black mb-1 text-white leading-tight drop-shadow-md">{video.title}</h2>
        <p className="text-[11px] text-slate-200 mb-3 leading-relaxed drop-shadow-sm">
          {video.description} <b className="text-white">#اكسبلور #فدشي #تسوّق</b>
        </p>

        {video.video_type === 'product' ? (
          <>
            <div className="flex items-center justify-between mb-3">
              <span className="text-lg font-black text-amber-400 drop-shadow-lg">{video.price.toLocaleString('ar')} د.ع</span>
              <div className="flex items-center gap-1.5 text-[10px] text-white/80">
                <div className="w-6 h-6 rounded-full border border-white/30 flex items-center justify-center animate-spinSlow">
                  <Music className="w-3 h-3" />
                </div>
                <span>{video.sound_name}</span>
              </div>
            </div>

            <button
              onClick={() => navigate(`/checkout/${video.id}`)}
              className="w-full py-3.5 bg-gradient-to-r from-brand-600 to-accent-500 hover:opacity-90 text-white text-center font-black rounded-xl shadow-lg text-xs transition active:scale-95 flex items-center justify-center gap-2"
            >
              <ShoppingCart className="w-4 h-4" />
              اطلب الآن — الدفع عند الاستلام
            </button>
          </>
        ) : (
          <div className="flex items-center gap-1.5 text-[11px] text-white/80 mb-1">
            <div className="w-6 h-6 rounded-full border border-white/30 flex items-center justify-center animate-spinSlow">
              <Music className="w-3 h-3" />
            </div>
            <span>{video.sound_name}</span>
          </div>
        )}
      </div>

      {showComments && (
        <CommentSheet videoId={video.id} onClose={() => setShowComments(false)} />
      )}

      {showShare && (
        <>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm z-[60]" onClick={() => setShowShare(false)} />
          <div className="absolute bottom-0 left-0 right-0 z-[61] bg-slate-900 rounded-t-3xl p-5 animate-slideUp" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center pb-3 border-b border-slate-800 mb-4">
              <h3 className="font-black text-sm text-slate-200">إرسال إلى</h3>
              <button onClick={() => setShowShare(false)} className="text-slate-400 font-bold text-base">✕</button>
            </div>
            <div className="grid grid-cols-4 gap-3 text-center text-xs">
              <button onClick={copyLink} className="space-y-1.5">
                <div className="bg-slate-800 p-3.5 rounded-full mx-auto w-12 h-12 flex items-center justify-center">
                  <Share2 className="w-5 h-5 text-white" />
                </div>
                <span className="text-[10px] text-slate-300">{copied ? 'تم النسخ!' : 'نسخ الرابط'}</span>
              </button>
            </div>
          </div>
        </>
      )}

      {showReport && (
        <>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm z-[60]" onClick={() => setShowReport(false)} />
          <div className="absolute bottom-0 left-0 right-0 z-[61] bg-slate-900 rounded-t-3xl p-5 animate-slideUp" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center pb-3 border-b border-slate-800 mb-4">
              <h3 className="font-black text-sm text-slate-200">الإبلاغ عن هذا الفيديو</h3>
              <button onClick={() => setShowReport(false)} className="text-slate-400 font-bold text-base">✕</button>
            </div>
            {reportSent ? (
              <p className="text-center text-emerald-400 text-xs font-bold py-4">
                تم إرسال بلاغك، سيراجعه فريق الإدارة قريباً. شكراً لمساعدتنا 🙏
              </p>
            ) : (
              <div className="space-y-2">
                {reportError && <p className="text-brand-400 text-[11px] font-bold">{reportError}</p>}
                {REPORT_REASONS.map(reason => (
                  <button
                    key={reason}
                    onClick={() => submitReport(reason)}
                    className="w-full text-right px-4 py-3 bg-slate-800 hover:bg-slate-700 transition rounded-xl text-xs font-bold text-slate-200"
                  >
                    {reason}
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
