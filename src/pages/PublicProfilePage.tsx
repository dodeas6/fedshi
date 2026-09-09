import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowRight, CheckCircle2, UserPlus, UserMinus, MessageCircle, Play } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { Profile, Video } from '../lib/types'

export default function PublicProfilePage() {
  const { userId } = useParams<{ userId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [videos, setVideos] = useState<Video[]>([])
  const [followers, setFollowers] = useState(0)
  const [isFollowing, setIsFollowing] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    if (user && userId === user.id) {
      navigate('/profile', { replace: true })
      return
    }
    loadProfile()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, user])

  const loadProfile = async () => {
    if (!userId) return
    setLoading(true)

    const [{ data: p }, { data: vids }, { count: followersCount }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
      supabase.from('videos').select('*').eq('user_id', userId).eq('status', 'approved').eq('is_private', false).order('created_at', { ascending: false }),
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', userId),
    ])

    setProfile(p as Profile | null)
    setVideos((vids as Video[]) || [])
    setFollowers(followersCount || 0)

    if (user) {
      const { data: f } = await supabase
        .from('follows')
        .select('*')
        .eq('follower_id', user.id)
        .eq('following_id', userId)
        .maybeSingle()
      setIsFollowing(!!f)
    }
    setLoading(false)
  }

  const toggleFollow = async () => {
    if (!user || !userId) { navigate('/auth'); return }
    if (isFollowing) {
      await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', userId)
      setIsFollowing(false)
      setFollowers(f => Math.max(0, f - 1))
    } else {
      await supabase.from('follows').insert({ follower_id: user.id, following_id: userId })
      setIsFollowing(true)
      setFollowers(f => f + 1)
    }
  }

  const messageUser = async () => {
    if (!user || !userId) { navigate('/auth'); return }
    const { data, error } = await supabase.rpc('get_or_create_conversation', { other_user: userId })
    if (!error && data) navigate(`/inbox/${data}`)
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen bg-black text-white text-sm">جارٍ التحميل...</div>
  }

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white gap-3">
        <p className="text-sm text-slate-400">هذا الحساب غير موجود</p>
        <button onClick={() => navigate('/feed')} className="text-brand-500 text-xs font-bold">العودة للرئيسية</button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white pb-10">
      <div className="max-w-md mx-auto p-4 space-y-5">
        <button onClick={() => navigate(-1)} className="text-slate-400 flex items-center gap-1 text-xs font-bold">
          <ArrowRight className="w-4 h-4" /> رجوع
        </button>

        <div className="flex flex-col items-center text-center space-y-2">
          <img
            src={profile.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${profile.username}`}
            className="w-20 h-20 rounded-full object-cover border-2 border-slate-800"
          />
          <div className="flex items-center gap-1.5">
            <h1 className="text-base font-black">@{profile.username}</h1>
            {profile.is_verified && <CheckCircle2 className="w-4 h-4 text-cyan-400" />}
          </div>
          {profile.full_name && <p className="text-xs text-slate-400">{profile.full_name}</p>}
          {profile.bio && <p className="text-xs text-slate-300 max-w-xs">{profile.bio}</p>}
        </div>

        <div className="flex justify-center gap-8 text-center">
          <div>
            <p className="text-base font-black">{followers}</p>
            <p className="text-[10px] text-slate-500">متابِع</p>
          </div>
          <div>
            <p className="text-base font-black">{videos.length}</p>
            <p className="text-[10px] text-slate-500">منشور</p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={toggleFollow}
            className={`flex-1 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 transition ${
              isFollowing ? 'bg-slate-800 text-slate-300' : 'bg-brand-600 hover:bg-brand-500 text-white'
            }`}
          >
            {isFollowing ? <><UserMinus className="w-4 h-4" /> متابَع</> : <><UserPlus className="w-4 h-4" /> متابعة</>}
          </button>
          <button
            onClick={messageUser}
            className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 transition"
          >
            <MessageCircle className="w-4 h-4" /> مراسلة
          </button>
        </div>

        <div className="grid grid-cols-3 gap-1 pt-2">
          {videos.map(v => (
            <button
              key={v.id}
              onClick={() => navigate(`/checkout/${v.id}`)}
              className="relative aspect-[9/16] bg-slate-900 rounded-lg overflow-hidden"
            >
              <video src={v.video_url} className="w-full h-full object-cover" muted preload="metadata" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
              <div className="absolute bottom-1 right-1 left-1 flex items-center gap-1">
                <Play className="w-3 h-3 text-white fill-white" />
                <span className="text-[10px] text-white font-bold">{v.views_count}</span>
              </div>
            </button>
          ))}
          {videos.length === 0 && (
            <p className="col-span-3 text-center text-slate-500 text-xs py-10">لا يوجد منشورات بعد</p>
          )}
        </div>
      </div>
    </div>
  )
}
