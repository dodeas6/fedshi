import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { VideoWithProfile } from '../lib/types'
import ReelItem from '../components/ReelItem'

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

    // Order by engagement_score (TikTok-style recommendation), with some randomness for variety
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

  useEffect(() => {
    (async () => {
      setLoading(true)
      const initial = await fetchVideos(0)
      setVideos(initial)
      initial.forEach(v => seenIdsRef.current.add(v.id))
      setLoading(false)
    })()
  }, [fetchVideos])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let currentActive = activeIndex

    const observer = new IntersectionObserver(
      entries => {
        // Find the entry with the highest intersection ratio
        let bestIdx = -1
        let bestRatio = 0
        entries.forEach(entry => {
          if (entry.isIntersecting && entry.intersectionRatio > bestRatio) {
            const idx = Number((entry.target as HTMLElement).getAttribute('data-index'))
            bestRatio = entry.intersectionRatio
            bestIdx = idx
          }
        })

        if (bestIdx >= 0 && bestIdx !== currentActive) {
          currentActive = bestIdx
          setActiveIndex(bestIdx)
          if (bestIdx >= videos.length - 3 && hasMore && !loading) {
            pageRef.current += 1
            fetchVideos(pageRef.current).then(newVideos => {
              if (newVideos.length > 0) {
                setVideos(prev => [...prev, ...newVideos])
                newVideos.forEach(v => seenIdsRef.current.add(v.id))
              }
            })
          }
        }
      },
      { root: container, threshold: [0.5, 0.6, 0.75, 0.9] }
    )

    const cards = container.querySelectorAll('[data-index]')
    cards.forEach(card => observer.observe(card))

    return () => observer.disconnect()
  }, [videos, hasMore, loading, fetchVideos])

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
    <div
      ref={containerRef}
      className="snap-container w-full h-screen overflow-y-scroll no-scrollbar"
    >
      {videos.map((v, i) => (
        <div key={v.id} data-index={i} className="snap-item w-full h-screen relative">
          <ReelItem video={v} isActive={i === activeIndex} />
        </div>
      ))}
    </div>
  )
}
