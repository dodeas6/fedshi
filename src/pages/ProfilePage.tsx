import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Settings, Share2, CheckCircle2, Package, LogOut, Heart, Bookmark, Film, ShoppingBag, TrendingUp, Store, Wallet } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { Video } from '../lib/types'
import AvatarUpload from '../components/AvatarUpload'

type Tab = 'videos' | 'liked' | 'saved'

export default function ProfilePage() {
  const navigate = useNavigate()
  const { user, profile, signOut, refreshProfile } = useAuth()
  const [tab, setTab] = useState<Tab>('videos')
  const [videos, setVideos] = useState<Video[]>([])
  const [likedVideos, setLikedVideos] = useState<Video[]>([])
  const [savedVideos, setSavedVideos] = useState<Video[]>([])
  const [followers, setFollowers] = useState(0)
  const [following, setFollowing] = useState(0)
  const [totalLikes, setTotalLikes] = useState(0)
  const [totalViews, setTotalViews] = useState(0)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editBio, setEditBio] = useState(profile?.bio || '')
  const [editName, setEditName] = useState(profile?.full_name || '')

  useEffect(() => {
    if (!user) return
    loadData()
  }, [user])

  const loadData = async () => {
    if (!user) return
    setLoading(true)

    const [vidsRes, followersRes, followingRes, likesRes] = await Promise.all([
      supabase.from('videos').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', user.id),
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', user.id),
      supabase.from('likes').select('video_id').eq('user_id', user.id),
    ])

    const userVids = (vidsRes.data as Video[]) || []
    setVideos(userVids)
    setFollowers(followersRes.count || 0)
    setFollowing(followingRes.count || 0)
    setTotalLikes(likesRes.data?.length || 0)
    setTotalViews(userVids.reduce((sum, v) => sum + v.views_count, 0))

    if (likesRes.data && likesRes.data.length > 0) {
      const likedIds = likesRes.data.map(l => l.video_id)
      const { data: likedVids } = await supabase
        .from('videos')
        .select('*')
        .in('id', likedIds)
        .eq('status', 'approved')
        .eq('is_private', false)
      setLikedVideos((likedVids as Video[]) || [])
    }

    const { data: savedData } = await supabase
      .from('saved_videos')
      .select('video_id')
      .eq('user_id', user.id)
    if (savedData && savedData.length > 0) {
      const savedIds = savedData.map(s => s.video_id)
      const { data: savedVids } = await supabase
        .from('videos')
        .select('*')
        .in('id', savedIds)
        .eq('status', 'approved')
      setSavedVideos((savedVids as Video[]) || [])
    }

    setLoading(false)
  }

  const handleSaveProfile = async () => {
    if (!user) return
    await supabase
      .from('profiles')
      .update({ bio: editBio, full_name: editName })
      .eq('id', user.id)
    await refreshProfile()
    setEditing(false)
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/auth')
  }

  if (!profile) return null

  const isMerchant = profile.role !== 'viewer'
  const isAdmin = profile.role === 'admin' || profile.role === 'super_admin'
  const tabVideos = tab === 'videos' ? videos : tab === 'liked' ? likedVideos : savedVideos

  const tabs = [
    { key: 'videos' as Tab, icon: Film, label: 'فيديوهاتي' },
    { key: 'liked' as Tab, icon: Heart, label: 'أعجبني' },
    { key: 'saved' as Tab, icon: Bookmark, label: 'محفوظات' },
  ]

  return (
    <div className="min-h-screen bg-black text-white pb-20">
      <div className="max-w-md mx-auto p-4 space-y-5">
        <div className="flex justify-between items-center pt-2">
          <span className="text-base font-black">@{profile.username}</span>
          <div className="flex gap-3">
            {isAdmin && (
              <button onClick={() => navigate('/admin')} className="text-slate-400 text-sm font-bold hover:text-white">
                <Settings className="w-5 h-5" />
              </button>
            )}
            <button onClick={handleSignOut} className="text-brand-500 text-sm font-bold hover:text-brand-400">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Avatar with upload */}
        <div className="text-center space-y-3">
          <div className="w-24 h-24 mx-auto">
            <AvatarUpload
              currentAvatar={profile.avatar_url}
              username={profile.username}
              onUploaded={() => refreshProfile()}
            />
          </div>
          <div>
            <h1 className="text-xl font-black flex items-center justify-center gap-1.5">
              {profile.full_name || profile.username}
              {profile.is_verified && <CheckCircle2 className="w-5 h-5 text-cyan-400 fill-cyan-400/30" />}
            </h1>
            <p className="text-xs text-slate-400 mt-1 px-4">{profile.bio || 'لا توجد نبذة'}</p>
            {isMerchant && (
              <span className="inline-flex items-center gap-1 mt-2 text-[10px] font-bold text-emerald-400 bg-emerald-400/10 px-2.5 py-1 rounded-full">
                <Store className="w-3 h-3" />
                حساب تاجر
              </span>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="flex justify-around bg-slate-900/60 p-4 rounded-2xl text-sm text-center border border-slate-800">
          <div>
            <b className="text-white text-lg block">{following}</b>
            <span className="text-slate-400 text-[11px] font-bold">مُتابَع</span>
          </div>
          <div>
            <b className="text-white text-lg block">{followers}</b>
            <span className="text-slate-400 text-[11px] font-bold">متابِع</span>
          </div>
          <div>
            <b className="text-white text-lg block">{totalLikes}</b>
            <span className="text-slate-400 text-[11px] font-bold">إعجاب</span>
          </div>
          <div>
            <b className="text-amber-400 text-lg block">{profile.coins}</b>
            <span className="text-amber-400/70 text-[11px] font-bold">عملات</span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => { setEditBio(profile.bio); setEditName(profile.full_name); setEditing(true) }}
            className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2"
          >
            تعديل الملف
          </button>
          <button className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2">
            <Share2 className="w-4 h-4" />
            مشاركة
          </button>
        </div>

        {/* Quick action cards */}
        <div className="grid grid-cols-2 gap-3">
          {/* Buyer orders */}
          <button
            onClick={() => navigate('/orders')}
            className="bg-slate-900 border border-slate-800 hover:border-cyan-600/50 rounded-2xl p-4 text-right transition group"
          >
            <ShoppingBag className="w-6 h-6 text-cyan-400 mb-2" />
            <p className="text-sm font-black text-white">طلباتي</p>
            <p className="text-[10px] text-slate-500">مشترياتي وتتبعها</p>
          </button>

          {/* Track order */}
          <button
            onClick={() => navigate('/track')}
            className="bg-slate-900 border border-slate-800 hover:border-blue-600/50 rounded-2xl p-4 text-right transition"
          >
            <Package className="w-6 h-6 text-blue-400 mb-2" />
            <p className="text-sm font-black text-white">تتبع طلب</p>
            <p className="text-[10px] text-slate-500">برقم المرجع</p>
          </button>
        </div>

        {/* Seller dashboard or activation */}
        {isMerchant ? (
          <div className="space-y-3">
            <button
              onClick={() => navigate('/merchant/orders')}
              className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-90 text-white text-center font-black rounded-xl text-sm shadow-lg transition flex items-center justify-center gap-2"
            >
              <Package className="w-4 h-4" />
              لوحة الطلبات والمبيعات
            </button>

            {videos.length > 0 && (
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-xs font-black text-slate-300">إحصائيات سريعة</h3>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <b className="text-white text-base block">{videos.length}</b>
                    <span className="text-[9px] text-slate-500 font-bold">منتج</span>
                  </div>
                  <div>
                    <b className="text-white text-base block">{totalViews}</b>
                    <span className="text-[9px] text-slate-500 font-bold">مشاهدة</span>
                  </div>
                  <div>
                    <b className="text-white text-base block">{videos.reduce((s, v) => s + v.likes_count, 0)}</b>
                    <span className="text-[9px] text-slate-500 font-bold">إعجاب</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={async () => {
              if (!user) return
              await supabase.from('profiles').update({ role: 'merchant' }).eq('id', user.id)
              await refreshProfile()
            }}
            className="w-full py-3.5 bg-slate-800 hover:bg-slate-700 text-amber-400 font-black text-center text-sm rounded-xl transition flex items-center justify-center gap-2 border border-amber-500/20"
          >
            <Store className="w-4 h-4" />
            تفعيل حساب التاجر — ابدأ البيع
          </button>
        )}

        {/* Tabs */}
        <div className="border-t border-slate-800 pt-4">
          <div className="flex justify-around text-sm font-bold border-b border-slate-800 pb-3">
            {tabs.map(({ key, icon: Icon, label }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex items-center gap-1.5 pb-3 transition ${
                  tab === key ? 'text-white border-b-2 border-brand-500' : 'text-slate-500'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="text-center text-slate-500 text-xs py-10">جارٍ التحميل...</div>
          ) : tabVideos.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-xs">
              {tab === 'videos' ? 'لم تنشر أي فيديو بعد' : tab === 'liked' ? 'لم تعجب بأي فيديو بعد' : 'لم تحفظ أي فيديو بعد'}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1 mt-4">
              {tabVideos.map(v => (
                <div key={v.id} className="relative aspect-[9/16] bg-slate-900 rounded-lg overflow-hidden">
                  <video src={v.video_url} className="w-full h-full object-cover" muted preload="metadata" />
                  <div className="absolute bottom-1 right-1 flex items-center gap-1">
                    <Heart className="w-2.5 h-2.5 text-white fill-white" />
                    <span className="text-[8px] text-white font-bold">{v.likes_count}</span>
                  </div>
                  <div className="absolute top-1 left-1">
                    <span className="text-[9px] font-black text-amber-400 bg-black/60 px-1.5 py-0.5 rounded">
                      {v.price > 0 ? `${v.price.toLocaleString('ar')}` : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {editing && (
        <>
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[70]" onClick={() => setEditing(false)} />
          <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-slate-900 rounded-t-3xl p-5 z-[71] animate-slideUp" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center pb-4 border-b border-slate-800 mb-4">
              <h3 className="font-black text-sm text-slate-200">تعديل الملف الشخصي</h3>
              <button onClick={() => setEditing(false)} className="text-slate-400 font-bold">✕</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5">الاسم الكامل</label>
                <input
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 focus:border-brand-500 rounded-xl text-sm text-white focus:outline-none transition"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5">النبذة</label>
                <textarea
                  value={editBio}
                  onChange={e => setEditBio(e.target.value)}
                  rows={3}
                  placeholder="اكتب نبذة عنك وعن منتجاتك..."
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 focus:border-brand-500 rounded-xl text-sm text-white focus:outline-none transition resize-none"
                />
              </div>
              <button
                onClick={handleSaveProfile}
                className="w-full py-3.5 bg-gradient-to-r from-brand-600 to-accent-500 hover:opacity-90 rounded-xl text-sm font-black text-white transition active:scale-95"
              >
                حفظ التغييرات
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
