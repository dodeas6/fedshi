import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, TrendingUp, Play } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { VideoWithProfile } from '../lib/types'

export default function ExplorePage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [videos, setVideos] = useState<VideoWithProfile[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadVideos()
  }, [])

  const loadVideos = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('videos')
      .select('*, profiles!videos_user_id_fkey(*)')
      .eq('status', 'approved')
      .eq('is_private', false)
      .order('engagement_score', { ascending: false })
      .limit(60)
    setVideos((data as VideoWithProfile[]) || [])
    setLoading(false)
  }

  const filtered = query.trim()
    ? videos.filter(v =>
        v.title.includes(query) ||
        v.description.includes(query) ||
        v.profiles?.username?.includes(query)
      )
    : videos

  return (
    <div className="min-h-screen bg-black text-white p-4 pb-20">
      <div className="max-w-md mx-auto space-y-5">
        <div className="flex items-center justify-between pt-2">
          <h1 className="text-2xl font-black flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-brand-500" />
            الاستكشاف
          </h1>
        </div>

        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="ابحث عن منتجات، تجار..."
            className="w-full pr-11 pl-4 py-3.5 bg-slate-900 border border-slate-800 focus:border-brand-500 rounded-2xl text-sm text-white focus:outline-none transition"
          />
        </div>

        {loading ? (
          <div className="text-center text-slate-500 text-xs py-12">جارٍ التحميل...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-slate-500 text-xs py-12">لا توجد نتائج لبحثك</div>
        ) : (
          <div className="grid grid-cols-3 gap-1">
            {filtered.map(v => (
              <button
                key={v.id}
                onClick={() => navigate(`/feed`)}
                className="relative aspect-[9/16] bg-slate-900 rounded-lg overflow-hidden group"
              >
                <video
                  src={v.video_url}
                  className="w-full h-full object-cover"
                  muted
                  preload="metadata"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                <div className="absolute bottom-1 right-1 left-1 flex items-center gap-1">
                  <Play className="w-3 h-3 text-white fill-white" />
                  <span className="text-[10px] text-white font-bold">{v.views_count}</span>
                </div>
                <div className="absolute top-1 left-1">
                  <span className="text-[9px] font-black text-amber-400 bg-black/60 px-1.5 py-0.5 rounded">
                    {v.price > 0 ? `${v.price.toLocaleString('ar')} د.ع` : ''}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
