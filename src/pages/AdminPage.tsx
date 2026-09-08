import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield, Users, Flag, Film, Ban, CheckCircle2, XCircle, TrendingUp, Trash2, ChevronLeft } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { Profile, Video } from '../lib/types'

type AdminTab = 'dashboard' | 'users' | 'content' | 'reports'

export default function AdminPage() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [tab, setTab] = useState<AdminTab>('dashboard')
  const [users, setUsers] = useState<Profile[]>([])
  const [videos, setVideos] = useState<Video[]>([])
  const [reports, setReports] = useState<any[]>([])
  const [stats, setStats] = useState({ totalUsers: 0, merchants: 0, banned: 0, totalVideos: 0, pendingVideos: 0, openReports: 0 })
  const [loading, setLoading] = useState(true)

  const loadDashboard = useCallback(async () => {
    const [usersRes, vidsRes, reportsRes, merchantsRes, bannedRes, pendingRes] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('videos').select('*', { count: 'exact', head: true }),
      supabase.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'merchant'),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_banned', true),
      supabase.from('videos').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    ])
    setStats({
      totalUsers: usersRes.count || 0,
      merchants: merchantsRes.count || 0,
      banned: bannedRes.count || 0,
      totalVideos: vidsRes.count || 0,
      pendingVideos: pendingRes.count || 0,
      openReports: reportsRes.count || 0,
    })
  }, [])

  const loadUsers = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(100)
    setUsers((data as Profile[]) || [])
  }, [])

  const loadVideos = useCallback(async () => {
    const { data } = await supabase.from('videos').select('*, profiles!videos_user_id_fkey(*)').order('created_at', { ascending: false }).limit(100)
    setVideos((data as Video[]) || [])
  }, [])

  const loadReports = useCallback(async () => {
    const { data } = await supabase
      .from('reports')
      .select('*, videos!reports_video_id_fkey(*), profiles!reports_reporter_id_fkey(*)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(50)
    setReports(data || [])
  }, [])

  useEffect(() => {
    if (!profile || (profile.role !== 'admin' && profile.role !== 'super_admin')) {
      navigate('/feed')
      return
    }
    setLoading(true)
    Promise.all([loadDashboard(), loadUsers(), loadVideos(), loadReports()]).then(() => setLoading(false))
  }, [profile, navigate, loadDashboard, loadUsers, loadVideos, loadReports])

  const banUser = async (id: string) => {
    await supabase.rpc('admin_ban_user', { target_id: id, p_reason: 'مخالفة' })
    loadUsers()
    loadDashboard()
  }
  const unbanUser = async (id: string) => {
    await supabase.rpc('admin_unban_user', { target_id: id })
    loadUsers()
    loadDashboard()
  }
  const verifyUser = async (id: string) => {
    await supabase.rpc('admin_verify_user', { target_id: id })
    loadUsers()
  }
  const unverifyUser = async (id: string) => {
    await supabase.rpc('admin_unverify_user', { target_id: id })
    loadUsers()
  }
  const deleteVideo = async (id: string) => {
    await supabase.rpc('admin_delete_video', { target_id: id })
    loadVideos()
    loadDashboard()
  }
  const approveVideo = async (id: string) => {
    await supabase.rpc('admin_update_video_status', { target_id: id, new_status: 'approved' })
    loadVideos()
    loadDashboard()
  }
  const rejectVideo = async (id: string) => {
    await supabase.rpc('admin_update_video_status', { target_id: id, new_status: 'rejected' })
    loadVideos()
    loadDashboard()
  }
  const dismissReport = async (id: string) => {
    await supabase.from('reports').update({ status: 'reviewed' }).eq('id', id)
    loadReports()
    loadDashboard()
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen bg-black text-white text-sm"><div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" /></div>
  }

  const tabs: { key: AdminTab; label: string; icon: any }[] = [
    { key: 'dashboard', label: 'اللوحة', icon: TrendingUp },
    { key: 'users', label: 'المستخدمون', icon: Users },
    { key: 'content', label: 'المحتوى', icon: Film },
    { key: 'reports', label: 'البلاغات', icon: Flag },
  ]

  return (
    <div className="min-h-screen bg-black text-white p-4 pb-24">
      <div className="max-w-md mx-auto space-y-5">
        <div className="flex items-center gap-3 pt-2">
          <button onClick={() => navigate('/profile')} className="text-slate-400 flex items-center gap-1 text-sm font-bold">
            <ChevronLeft className="w-4 h-4" /> رجوع
          </button>
          <h1 className="text-xl font-black flex items-center gap-2">
            <Shield className="w-6 h-6 text-cyan-400" />
            لوحة الإدارة
          </h1>
        </div>

        <div className="flex gap-1 bg-slate-900 rounded-xl p-1 overflow-x-auto no-scrollbar">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-bold whitespace-nowrap transition ${
                tab === key ? 'bg-cyan-600 text-white' : 'text-slate-400'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        {tab === 'dashboard' && (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <Users className="w-5 h-5 text-cyan-400 mb-2" />
              <b className="text-2xl block">{stats.totalUsers}</b>
              <span className="text-[10px] text-slate-400 font-bold">مستخدم</span>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <TrendingUp className="w-5 h-5 text-emerald-400 mb-2" />
              <b className="text-2xl block">{stats.merchants}</b>
              <span className="text-[10px] text-slate-400 font-bold">تاجر</span>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <Film className="w-5 h-5 text-amber-400 mb-2" />
              <b className="text-2xl block">{stats.totalVideos}</b>
              <span className="text-[10px] text-slate-400 font-bold">فيديو</span>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <Ban className="w-5 h-5 text-brand-500 mb-2" />
              <b className="text-2xl block">{stats.banned}</b>
              <span className="text-[10px] text-slate-400 font-bold">محظور</span>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <Film className="w-5 h-5 text-orange-400 mb-2" />
              <b className="text-2xl block">{stats.pendingVideos}</b>
              <span className="text-[10px] text-slate-400 font-bold">بانتظار المراجعة</span>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <Flag className="w-5 h-5 text-brand-500 mb-2" />
              <b className="text-2xl block">{stats.openReports}</b>
              <span className="text-[10px] text-slate-400 font-bold">بلاغ مفتوح</span>
            </div>
          </div>
        )}

        {tab === 'users' && (
          <div className="space-y-2">
            {users.map(u => (
              <div key={u.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-3 flex items-center gap-3">
                <img src={u.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${u.username}`} alt="" className="w-10 h-10 rounded-full bg-slate-800 object-cover" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <b className="text-sm truncate">@{u.username}</b>
                    {u.is_verified && <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 fill-cyan-400/30" />}
                    {u.is_banned && <span className="text-[9px] bg-brand-600/20 text-brand-400 px-1.5 py-0.5 rounded font-bold">محظور</span>}
                  </div>
                  <span className="text-[10px] text-slate-500">{u.role === 'merchant' ? 'تاجر' : u.role === 'admin' ? 'أدمن' : u.role === 'super_admin' ? 'مشرف عام' : 'مشاهد'}</span>
                </div>
                <div className="flex gap-1">
                  {!u.is_banned ? (
                    <button onClick={() => banUser(u.id)} className="p-2 bg-brand-600/20 text-brand-400 rounded-lg hover:bg-brand-600/30 transition" title="حظر">
                      <Ban className="w-4 h-4" />
                    </button>
                  ) : (
                    <button onClick={() => unbanUser(u.id)} className="p-2 bg-emerald-600/20 text-emerald-400 rounded-lg hover:bg-emerald-600/30 transition" title="رفع الحظر">
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                  )}
                  {!u.is_verified ? (
                    <button onClick={() => verifyUser(u.id)} className="p-2 bg-cyan-600/20 text-cyan-400 rounded-lg hover:bg-cyan-600/30 transition" title="توثيق">
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                  ) : (
                    <button onClick={() => unverifyUser(u.id)} className="p-2 bg-slate-700 text-slate-400 rounded-lg hover:bg-slate-600 transition" title="إلغاء التوثيق">
                      <XCircle className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'content' && (
          <div className="space-y-2">
            {videos.map(v => (
              <div key={v.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-3 flex items-center gap-3">
                <video src={v.video_url} className="w-12 h-16 object-cover rounded-lg bg-slate-800" muted preload="metadata" />
                <div className="flex-1 min-w-0">
                  <b className="text-sm truncate block">{v.title}</b>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    v.status === 'approved' ? 'bg-emerald-600/20 text-emerald-400' :
                    v.status === 'pending' ? 'bg-amber-600/20 text-amber-400' :
                    'bg-brand-600/20 text-brand-400'
                  }`}>
                    {v.status === 'approved' ? 'معتمد' : v.status === 'pending' ? 'قيد المراجعة' : 'مرفوض'}
                  </span>
                </div>
                <div className="flex gap-1">
                  {v.status !== 'approved' && (
                    <button onClick={() => approveVideo(v.id)} className="p-2 bg-emerald-600/20 text-emerald-400 rounded-lg hover:bg-emerald-600/30 transition" title="قبول">
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                  )}
                  {v.status !== 'rejected' && (
                    <button onClick={() => rejectVideo(v.id)} className="p-2 bg-amber-600/20 text-amber-400 rounded-lg hover:bg-amber-600/30 transition" title="رفض">
                      <XCircle className="w-4 h-4" />
                    </button>
                  )}
                  <button onClick={() => deleteVideo(v.id)} className="p-2 bg-brand-600/20 text-brand-400 rounded-lg hover:bg-brand-600/30 transition" title="حذف">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'reports' && (
          <div className="space-y-2">
            {reports.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-sm">لا توجد بلاغات معلّقة</div>
            ) : (
              reports.map(r => (
                <div key={r.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-3 space-y-2">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <b className="text-xs block truncate">{r.videos?.title || 'فيديو محذوف'}</b>
                      <span className="text-[10px] text-slate-500">بلّغ: @{r.profiles?.username}</span>
                    </div>
                    <span className="text-[10px] text-slate-600">{new Date(r.created_at).toLocaleDateString('ar')}</span>
                  </div>
                  <p className="text-xs text-slate-400 bg-black/30 rounded-lg p-2">{r.reason}</p>
                  <div className="flex gap-2">
                    <button onClick={() => deleteVideo(r.video_id)} className="flex-1 py-2 bg-brand-600/20 text-brand-400 text-xs font-bold rounded-lg hover:bg-brand-600/30 transition flex items-center justify-center gap-1">
                      <Trash2 className="w-3 h-3" /> حذف الفيديو
                    </button>
                    <button onClick={() => dismissReport(r.id)} className="flex-1 py-2 bg-slate-700 text-slate-300 text-xs font-bold rounded-lg hover:bg-slate-600 transition">
                      تجاهل البلاغ
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
