import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { VideoWithProfile } from '../lib/types'
import ReelItem from '../components/ReelItem'
import { SoundProvider } from '../lib/SoundContext'

const PAGE_SIZE = 10

export default function FeedPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [videos, setVideos] = useState<VideoWithProfile[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(true)
  const containerRef = useRef<HTMLDivElement>(null)
  const pageRef = useRef(0)
  const seenIdsRef = useRef<Set<string>>(new Set())

  const fetchVideos = useCallback(async (page: number) => {
    const offset = page * PAGE_SIZE

    const { data, error } = await supabase
      .from('videos')
      .select('*, profiles!videos_user_id_fkey(*)')
      .eq('status', 'approved')
      .eq('is_private', false)
      .order('engagement_score', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1)

    if (error || !data || data.length === 0) {
      setHasMore(false)
      return []
    }

    const videoIds = data.map(v => v.id)
    let likedIds = new Set<string>()
    let savedIds = new Set<string>()
    let followingIds = new Set<string>()

    if (user) {
      const [likesData, savesData, followsData] = await Promise.all([
        supabase.from('likes').select('video_id').in('video_id', videoIds).eq('user_id', user.id),
        supabase.from('saved_videos').select('video_id').in('video_id', videoIds).eq('user_id', user.id),
        supabase.from('follows').select('following_id').in('following_id', data.map(v => v.user_id)).eq('follower_id', user.id),
      ])
      if (likesData.data) likedIds = new Set(likesData.data.map(l => l.video_id))
      if (savesData.data) savedIds = new Set(savesData.data.map(s => s.video_id))
      if (followsData.data) followingIds = new Set(followsData.data.map(f => f.following_id))
    }

    return data.map(v => ({
      ...v,
      profiles: v.profiles as any,
      is_liked: likedIds.has(v.id),
      is_saved: savedIds.has(v.id),
      is_following: followingIds.has(v.user_id),
    })) as VideoWithProfile[]
  }, [user])

  const hasMoreRef = useRef(hasMore)
  const loadingRef = useRef(loading)
  const videosLenRef = useRef(0)
  const activeIndexRef = useRef(0)

  useEffect(() => { hasMoreRef.current = hasMore }, [hasMore])
  useEffect(() => { loadingRef.current = loading }, [loading])
  useEffect(() => { videosLenRef.current = videos.length }, [videos.length])

  useEffect(() => {
    (async () => {
      setLoading(true)
      const initial = await fetchVideos(0)
      setVideos(initial)
      initial.forEach(v => seenIdsRef.current.add(v.id))
      setLoading(false)
    })()
  }, [fetchVideos])

  // الإصلاح الجذري: بدل الاعتماد على IntersectionObserver (الذي أثبت عدم
  // موثوقيته مع بعض أنماط التمرير)، نحسب الفيديو الظاهر حالياً مباشرة
  // ومباشرةً من موضع التمرير (scrollTop) نفسه — طريقة أبسط، لا تعتمد على
  // عتبات (thresholds) قد لا تتحقق أبداً، وتعمل بشكل حتمي 100%
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let ticking = false

    const updateActiveFromScroll = () => {
      ticking = false
      const idx = Math.round(container.scrollTop / container.clientHeight)
      const clamped = Math.max(0, Math.min(idx, videosLenRef.current - 1))

      if (clamped !== activeIndexRef.current) {
        activeIndexRef.current = clamped
        setActiveIndex(clamped)
      }

      if (clamped >= videosLenRef.current - 3 && hasMoreRef.current && !loadingRef.current) {
        pageRef.current += 1
        fetchVideos(pageRef.current).then(newVideos => {
          if (newVideos.length > 0) {
            setVideos(prev => [...prev, ...newVideos])
            newVideos.forEach(v => seenIdsRef.current.add(v.id))
          }
        })
      }
    }

    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(updateActiveFromScroll)
    }

    // تحقّق فوري عند التحميل الأول أيضاً (بدون انتظار أول حدث تمرير)
    updateActiveFromScroll()

    container.addEventListener('scroll', onScroll, { passive: true })
    return () => container.removeEventListener('scroll', onScroll)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videos.length > 0])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black text-white text-sm flex-col gap-3">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-slate-400 text-xs">جارٍ تحميل الفيديوهات...</span>
      </div>
    )
  }

  if (videos.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black text-white text-center p-6 flex-col gap-4">
        <div className="text-5xl">🎬</div>
        <h2 className="text-lg font-black">لا توجد فيديوهات بعد</h2>
        <p className="text-xs text-slate-400">كن أول من ينشر منتجاً على فدشي!</p>
        {user ? (
          <button
            onClick={() => navigate('/upload')}
            className="px-6 py-3 bg-brand-600 hover:bg-brand-500 rounded-xl text-sm font-bold transition"
          >
            انشر الآن
          </button>
        ) : (
          <button
            onClick={() => navigate('/auth')}
            className="px-6 py-3 bg-brand-600 hover:bg-brand-500 rounded-xl text-sm font-bold transition"
          >
            سجّل وانشر
          </button>
        )}
      </div>
    )
  }

  return (
    <SoundProvider>
      <div
        ref={containerRef}
        className="snap-container w-full h-screen overflow-y-scroll no-scrollbar"
      >
        {videos.map((v, i) => (
          <div key={v.id} className="w-full h-screen relative snap-item">
            <ReelItem video={v} isActive={i === activeIndex} />
          </div>
        ))}
      </div>
    </SoundProvider>
  )
}
