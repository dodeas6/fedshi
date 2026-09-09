import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ShieldCheck, Users, Film, Flag, ArrowRight, Ban, CheckCircle2,
  BadgeCheck, Trash2, Crown, ShoppingBag, TrendingUp, DollarSign,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { Profile, Video, Report } from '../lib/types'

type Tab = 'users' | 'content' | 'reports' | 'finance'

interface Stats {
  totalUsers: number
  merchants: number
  banned: number
  totalVideos: number
  pendingReview: number
  openReports: number
}

interface MerchantFinance {
  merchant: Profile
  orderCount: number
  totalRevenue: number
}

interface ReportWithDetails extends Report {
  video?: Video | null
  reporter?: Profile | null
}

interface VideoWithOwner extends Video {
  owner?: Profile | null
}

export default function AdminPage() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const isSuperAdmin = profile?.role === 'super_admin'

  const [tab, setTab] = useState<Tab>('users')
  const [stats, setStats] = useState<Stats | null>(null)
  const [users, setUsers] = useState<Profile[]>([])
  const [videos, setVideos] = useState<VideoWithOwner[]>([])
  const [videoFilter, setVideoFilter] = useState<'pending' | 'approved' | 'rejected'>('pending')
  const [reports, setReports] = useState<ReportWithDetails[]>([])
  const [finances, setFinances] = useState<MerchantFinance[]>([])
  const [totalRevenueAll, setTotalRevenueAll] = useState(0)
  const [loading, setLoading] = useState(true)
  const [actionError, setActionError] = useState('')

  const loadStats = useCallback(async () => {
    const [totalUsers, merchants, banned, totalVideos, pendingReview, openReports] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'merchant'),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('is_banned', true),
      supabase.from('videos').select('id', { count: 'exact', head: true }),
      supabase.from('videos').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    ])
    setStats({
      totalUsers: totalUsers.count ?? 0,
      merchants: merchants.count ?? 0,
      banned: banned.count ?? 0,
      totalVideos: totalVideos.count ?? 0,
      pendingReview: pendingReview.count ?? 0,
      openReports: openReports.count ?? 0,
    })
  }, [])

  const loadUsers = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(100)
    setUsers((data as Profile[]) || [])
  }, [])

  const loadContent = useCallback(async (status: 'pending' | 'approved' | 'rejected') => {
    const { data } = await supabase
      .from('videos')
      .select('*')
      .eq('status', status)
      .order('created_at', { ascending: false })
      .limit(100)

    const list = (data as Video[]) || []
    if (list.length === 0) { setVideos([]); return }

    const ownerIds = Array.from(new Set(list.map(v => v.user_id)))
    const { data: owners } = await supabase.from('profiles').select('*').in('id', ownerIds)
    const ownerMap = new Map((owners as Profile[] | null)?.map(o => [o.id, o]) || [])

    setVideos(list.map(v => ({ ...v, owner: ownerMap.get(v.user_id) || null })))
  }, [])

  const loadReports = useCallback(async () => {
    const { data } = await supabase
      .from('reports')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(100)

    const list = (data as Report[]) || []
    if (list.length === 0) { setReports([]); return }

    const videoIds = Array.from(new Set(list.map(r => r.video_id)))
    const reporterIds = Array.from(new Set(list.map(r => r.reporter_id)))
    const [{ data: vids }, { data: reporters }] = await Promise.all([
      supabase.from('videos').select('*').in('id', videoIds),
      supabase.from('profiles').select('*').in('id', reporterIds),
    ])
    const videoMap = new Map((vids as Video[] | null)?.map(v => [v.id, v]) || [])
    const reporterMap = new Map((reporters as Profile[] | null)?.map(p => [p.id, p]) || [])

    setReports(list.map(r => ({ ...r, video: videoMap.get(r.video_id) || null, reporter: reporterMap.get(r.reporter_id) || null })))
  }, [])

  const loadFinances = useCallback(async () => {
    // "طلب مؤكد" فما فوق يُحتسب في التقرير (وليس الطلبات الملغاة أو قيد المراجعة)
    const { data: orders } = await supabase
      .from('orders')
      .select('merchant_id, total_price, status')
      .in('status', ['confirmed', 'shipped', 'delivered'])

    if (!orders || orders.length === 0) { setFinances([]); setTotalRevenueAll(0); return }

    const byMerchant = new Map<string, { count: number; total: number }>()
    let grandTotal = 0
    for (const o of orders) {
      const cur = byMerchant.get(o.merchant_id) || { count: 0, total: 0 }
      cur.count += 1
      cur.total += o.total_price
      byMerchant.set(o.merchant_id, cur)
      grandTotal += o.total_price
    }

    const merchantIds = Array.from(byMerchant.keys())
    const { data: merchants } = await supabase.from('profiles').select('*').in('id', merchantIds)
    const merchantMap = new Map((merchants as Profile[] | null)?.map(m => [m.id, m]) || [])

    const list: MerchantFinance[] = merchantIds
      .map(id => ({
        merchant: merchantMap.get(id) as Profile,
        orderCount: byMerchant.get(id)!.count,
        totalRevenue: byMerchant.get(id)!.total,
      }))
      .filter(f => f.merchant)
      .sort((a, b) => b.totalRevenue - a.totalRevenue)

    setFinances(list)
    setTotalRevenueAll(grandTotal)
  }, [])

  useEffect(() => {
    (async () => {
      setLoading(true)
      await loadStats()
      await loadUsers()
      setLoading(false)
    })()
  }, [loadStats, loadUsers])

  useEffect(() => {
    if (tab === 'content') loadContent(videoFilter)
    if (tab === 'reports') loadReports()
    if (tab === 'finance') loadFinances()
  }, [tab, videoFilter, loadContent, loadReports, loadFinances])

  const runAction = async (fn: () => any, onSuccess: () => void) => {
    setActionError('')
    const { error } = await fn()
    if (error) { setActionError(error.message); return }
    onSuccess()
    loadStats()
  }

  const banUser = (id: string) =>
    runAction(
      () => supabase.from('profiles').update({ is_banned: true }).eq('id', id),
      () => setUsers(prev => prev.map(u => (u.id === id ? { ...u, is_banned: true } : u)))
    )

  const unbanUser = (id: string) =>
    runAction(
      () => supabase.from('profiles').update({ is_banned: false }).eq('id', id),
      () => setUsers(prev => prev.map(u => (u.id === id ? { ...u, is_banned: false } : u)))
    )

  const toggleVerify = (id: string, value: boolean) =>
    runAction(
      () => supabase.from('profiles').update({ is_verified: value }).eq('id', id),
      () => setUsers(prev => prev.map(u => (u.id === id ? { ...u, is_verified: value } : u)))
    )

  const promoteToAdmin = (id: string) =>
    runAction(
      () => supabase.from('profiles').update({ role: 'admin' }).eq('id', id),
      () => setUsers(prev => prev.map(u => (u.id === id ? { ...u, role: 'admin' } : u)))
    )

  const demoteToViewer = (id: string) =>
    runAction(
      () => supabase.from('profiles').update({ role: 'viewer' }).eq('id', id),
      () => setUsers(prev => prev.map(u => (u.id === id ? { ...u, role: 'viewer' } : u)))
    )

  const toggleTrending = (id: string, value: boolean) =>
    runAction(
      () => supabase.from('videos').update({ is_trending: value }).eq('id', id),
      () => setVideos(prev => prev.map(v => (v.id === id ? { ...v, is_trending: value } : v)))
    )

  const approveVideo = (id: string) =>
    runAction(
      () => supabase.from('videos').update({ status: 'approved', moderation_note: '' }).eq('id', id),
      () => setVideos(prev => prev.filter(v => v.id !== id))
    )

  const rejectVideo = (id: string) => {
    const note = window.prompt('سبب الرفض (سيظهر هذا للتاجر):', 'يخالف سياسة المحتوى')
    if (note === null) return
    runAction(
      () => supabase.from('videos').update({ status: 'rejected', moderation_note: note }).eq('id', id),
      () => setVideos(prev => prev.filter(v => v.id !== id))
    )
  }

  const deleteVideo = (id: string) => {
    if (!window.confirm('حذف هذا الفيديو نهائياً؟ لا يمكن التراجع.')) return
    runAction(
      () => supabase.from('videos').delete().eq('id', id),
      () => setVideos(prev => prev.filter(v => v.id !== id))
    )
  }

  const resolveReport = (id: string) =>
    runAction(
      () => supabase.from('reports').update({ status: 'reviewed' }).eq('id', id),
      () => setReports(prev => prev.filter(r => r.id !== id))
    )

  const actionReportAndRemoveVideo = (report: ReportWithDetails) => {
    if (!report.video) return
    if (!window.confirm('سيتم حذف الفيديو المُبلَّغ عنه وإغلاق البلاغ. متابعة؟')) return
    runAction(
      async () => {
        await supabase.from('videos').delete().eq('id', report.video!.id)
        return supabase.from('reports').update({ status: 'actioned' }).eq('id', report.id)
      },
      () => setReports(prev => prev.filter(r => r.id !== report.id))
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black text-white text-sm">
        جارٍ تحميل لوحة الإدارة...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white pb-10">
      <div className="max-w-md mx-auto p-4 space-y-5">
        <div className="flex items-center justify-between pt-2">
          <button onClick={() => navigate('/profile')} className="text-slate-400 flex items-center gap-1 text-xs font-bold">
            <ArrowRight className="w-4 h-4" /> رجوع
          </button>
          <h1 className="text-base font-black flex items-center gap-1.5">
            <ShieldCheck className="w-5 h-5 text-brand-500" /> لوحة الإدارة
          </h1>
          <div className="w-10" />
        </div>

        {stats && (
          <div className="grid grid-cols-3 gap-2">
            <StatCard label="مستخدمون" value={stats.totalUsers} />
            <StatCard label="تجار" value={stats.merchants} />
            <StatCard label="محظورون" value={stats.banned} tone="danger" />
            <StatCard label="فيديوهات" value={stats.totalVideos} />
            <StatCard label="بانتظار المراجعة" value={stats.pendingReview} tone="warn" />
            <StatCard label="بلاغات مفتوحة" value={stats.openReports} tone="warn" />
          </div>
        )}

        {actionError && (
          <div className="bg-brand-600/15 border border-brand-600/30 text-brand-400 text-xs font-bold py-2.5 px-4 rounded-xl">
            {actionError}
          </div>
        )}

        <div className="flex bg-slate-900 border border-slate-800 rounded-2xl p-1">
          <TabButton active={tab === 'users'} onClick={() => setTab('users')} icon={Users} label="المستخدمون" />
          <TabButton active={tab === 'content'} onClick={() => setTab('content')} icon={Film} label="المحتوى" />
          <TabButton active={tab === 'reports'} onClick={() => setTab('reports')} icon={Flag} label="البلاغات" />
          <TabButton active={tab === 'finance'} onClick={() => setTab('finance')} icon={DollarSign} label="المالية" />
        </div>

        {tab === 'users' && (
          <div className="space-y-2">
            {users.map(u => (
              <div key={u.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <img src={u.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${u.username}`} className="w-9 h-9 rounded-full object-cover shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate flex items-center gap-1">
                        @{u.username}
                        {u.is_verified && <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />}
                      </p>
                      <p className="text-[10px] text-slate-500">{u.role} · {u.coins} نقطة</p>
                    </div>
                  </div>
                  {u.is_banned && <span className="text-[10px] font-bold text-brand-500 shrink-0">محظور</span>}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {u.role !== 'super_admin' && (
                    u.is_banned ? (
                      <ActionBtn label="إلغاء الحظر" icon={CheckCircle2} onClick={() => unbanUser(u.id)} tone="ok" />
                    ) : (
                      <ActionBtn label="حظر" icon={Ban} onClick={() => banUser(u.id)} tone="danger" />
                    )
                  )}
                  <ActionBtn
                    label={u.is_verified ? 'إلغاء التوثيق' : 'توثيق'}
                    icon={BadgeCheck}
                    onClick={() => toggleVerify(u.id, !u.is_verified)}
                  />
                  {isSuperAdmin && u.role !== 'admin' && u.role !== 'super_admin' && (
                    <ActionBtn label="ترقية لأدمن" icon={Crown} onClick={() => promoteToAdmin(u.id)} />
                  )}
                  {isSuperAdmin && u.role === 'admin' && (
                    <ActionBtn label="إزالة صلاحية الأدمن" icon={Crown} onClick={() => demoteToViewer(u.id)} tone="danger" />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'content' && (
          <div className="space-y-3">
            <div className="flex gap-2">
              {(['pending', 'approved', 'rejected'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setVideoFilter(f)}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-bold ${videoFilter === f ? 'bg-brand-600 text-white' : 'bg-slate-900 text-slate-400 border border-slate-800'}`}
                >
                  {f === 'pending' ? 'بانتظار المراجعة' : f === 'approved' ? 'مقبولة' : 'مرفوضة'}
                </button>
              ))}
            </div>

            {videos.length === 0 && (
              <p className="text-xs text-slate-500 text-center py-8">لا يوجد محتوى في هذا القسم حالياً</p>
            )}

            {videos.map(v => (
              <div key={v.id} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex gap-3 p-3">
                <video src={v.video_url} className="w-20 h-28 object-cover rounded-xl bg-black shrink-0" muted />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <p className="text-xs font-bold truncate">{v.title || 'بدون عنوان'}</p>
                  <p className="text-[10px] text-slate-500 truncate">@{v.owner?.username || '—'} · {v.price.toLocaleString()} د.ع</p>
                  {v.moderation_note && <p className="text-[10px] text-amber-400">ملاحظة: {v.moderation_note}</p>}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {videoFilter !== 'approved' && <ActionBtn label="قبول" icon={CheckCircle2} onClick={() => approveVideo(v.id)} tone="ok" />}
                    {videoFilter !== 'rejected' && <ActionBtn label="رفض" icon={Ban} onClick={() => rejectVideo(v.id)} tone="danger" />}
                    {videoFilter === 'approved' && (
                      <ActionBtn
                        label={v.is_trending ? 'إزالة من الترند' : 'رفع للترند 🔥'}
                        icon={TrendingUp}
                        onClick={() => toggleTrending(v.id, !v.is_trending)}
                        tone={v.is_trending ? 'danger' : 'ok'}
                      />
                    )}
                    <ActionBtn label="حذف نهائي" icon={Trash2} onClick={() => deleteVideo(v.id)} tone="danger" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'reports' && (
          <div className="space-y-3">
            {reports.length === 0 && (
              <p className="text-xs text-slate-500 text-center py-8">لا توجد بلاغات مفتوحة حالياً 🎉</p>
            )}
            {reports.map(r => (
              <div key={r.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-3 space-y-2">
                <div className="flex items-center gap-2 text-xs">
                  <Flag className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="font-bold">{r.reason}</span>
                </div>
                <p className="text-[10px] text-slate-500">
                  بلّغ عنه @{r.reporter?.username || 'مستخدم محذوف'} · بخصوص فيديو: {r.video?.title || 'فيديو محذوف'}
                </p>
                {r.video && (
                  <div className="flex items-center gap-2">
                    <ShoppingBag className="w-3.5 h-3.5 text-slate-600" />
                    <span className="text-[10px] text-slate-400">@{r.video.user_id.slice(0, 8)} — {r.video.price.toLocaleString()} د.ع</span>
                  </div>
                )}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <ActionBtn label="تجاهل (سليم)" icon={CheckCircle2} onClick={() => resolveReport(r.id)} tone="ok" />
                  {r.video && <ActionBtn label="حذف الفيديو" icon={Trash2} onClick={() => actionReportAndRemoveVideo(r)} tone="danger" />}
                </div>
              </div>
            ))}
          </div>
        )}
        {tab === 'finance' && (
          <div className="space-y-3">
            <div className="bg-gradient-to-r from-brand-600 to-accent-500 rounded-2xl p-4">
              <p className="text-[10px] text-white/80">إجمالي مبيعات المنصة (الطلبات المؤكدة فما فوق)</p>
              <p className="text-2xl font-black text-white">{totalRevenueAll.toLocaleString('ar')} د.ع</p>
            </div>

            {finances.length === 0 && (
              <p className="text-xs text-slate-500 text-center py-8">لا توجد طلبات مؤكدة بعد</p>
            )}

            {finances.map(f => (
              <div key={f.merchant.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-3 flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <img src={f.merchant.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${f.merchant.username}`} className="w-9 h-9 rounded-full object-cover shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold truncate">@{f.merchant.username}</p>
                    <p className="text-[10px] text-slate-500">{f.orderCount} طلب</p>
                  </div>
                </div>
                <p className="text-sm font-black text-amber-400 shrink-0">{f.totalRevenue.toLocaleString('ar')} د.ع</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, tone }: { label: string; value: number; tone?: 'danger' | 'warn' }) {
  const color = tone === 'danger' ? 'text-brand-500' : tone === 'warn' ? 'text-amber-400' : 'text-white'
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-2.5">
      <p className="text-[9px] text-slate-500 mb-0.5">{label}</p>
      <p className={`text-lg font-black ${color}`}>{value}</p>
    </div>
  )
}

function TabButton({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: any; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-bold transition ${
        active ? 'bg-brand-600 text-white' : 'text-slate-500'
      }`}
    >
      <Icon className="w-3.5 h-3.5" /> {label}
    </button>
  )
}

function ActionBtn({ label, icon: Icon, onClick, tone }: { label: string; icon: any; onClick: () => void; tone?: 'ok' | 'danger' }) {
  const style =
    tone === 'ok' ? 'bg-emerald-700/80 hover:bg-emerald-600' :
    tone === 'danger' ? 'bg-brand-700/80 hover:bg-brand-600' :
    'bg-slate-800 hover:bg-slate-700'
  return (
    <button onClick={onClick} className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold text-white transition ${style}`}>
      <Icon className="w-3 h-3" /> {label}
    </button>
  )
}
