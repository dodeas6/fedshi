import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, TrendingUp, Play, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { VideoWithProfile } from '../lib/types'

const PAGE_SIZE = 21
const CATEGORIES = ['الكل', 'ملابس نسائية', 'ملابس رجالية', 'أحذية', 'إكسسوارات', 'تجميل', 'إلكترونيات', 'منزل ومطبخ', 'أخرى']

export default function ExplorePage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [videos, setVideos] = useState<VideoWithProfile[]>([])
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('الكل')
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [searching, setSearching] = useState(false)
  const pageRef = useRef(0)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadVideos = useCallback(async (page: number, searchTerm: string, cat: string) => {
    let q = supabase
      .from('videos')
      .select('*, profiles!videos_user_id_fkey(*)')
      .eq('status', 'approved')
      .eq('is_private', false)

    if (cat !== 'الكل') {
      q = q.eq('category', cat)
    }

    // البحث الحقيقي يتم على الخادم لكل قاعدة البيانات، وليس فقط ضمن
    // أول 60 فيديو محمّلة كما كان سابقاً
    if (searchTerm.trim()) {
      q = q.or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`)
    }

    const { data } = await q
      .order('engagement_score', { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)

    const list = (data as VideoWithProfile[]) || []
    if (list.length < PAGE_SIZE) setHasMore(false)
    return list
  }, [])

  // تحميل موحّد: يعمل عند فتح الصفحة، وعند كتابة بحث (بتأخير 400ms)،
  // وعند تغيير الفئة (فوري). دمجهما بتأثير واحد يمنع طلب مضاعف عند فتح الصفحة
  const isFirstRun = useRef(true)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const delay = isFirstRun.current ? 0 : query.trim() ? 400 : 0
    isFirstRun.current = false

    if (delay === 0) setLoading(true)
    else setSearching(true)

    debounceRef.current = setTimeout(async () => {
      pageRef.current = 0
      setHasMore(true)
      const results = await loadVideos(0, query, category)
      setVideos(results)
      setLoading(false)
      setSearching(false)
    }, delay)

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, category])

  const loadMore = async () => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    pageRef.current += 1
    const more = await loadVideos(pageRef.current, query, category)
    setVideos(prev => [...prev, ...more])
    setLoadingMore(false)
  }

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
          {searching && (
            <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 animate-spin" />
          )}
        </div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-3.5 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition ${
                category === cat ? 'bg-brand-600 text-white' : 'bg-slate-900 border border-slate-800 text-slate-400'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center text-slate-500 text-xs py-12">جارٍ التحميل...</div>
        ) : videos.length === 0 ? (
          <div className="text-center text-slate-500 text-xs py-12">لا توجد نتائج لبحثك</div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-1">
              {videos.map(v => (
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

            {hasMore && (
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="w-full py-3 bg-slate-900 border border-slate-800 rounded-xl text-xs font-bold text-slate-300 hover:bg-slate-800 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> جارٍ التحميل...
                  </>
                ) : (
                  'تحميل المزيد'
                )}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
