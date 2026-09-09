import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, CheckCircle2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const { updatePassword } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل')
      return
    }
    if (password !== confirm) {
      setError('كلمتا المرور غير متطابقتين')
      return
    }

    setLoading(true)
    const { error: err } = await updatePassword(password)
    setLoading(false)

    if (err) {
      setError('انتهت صلاحية رابط الاستعادة أو حدث خطأ. اطلب رابطاً جديداً وحاول مرة أخرى')
      return
    }
    setDone(true)
    setTimeout(() => navigate('/feed'), 2000)
  }

  if (done) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 text-center gap-3">
        <CheckCircle2 className="w-14 h-14 text-emerald-400" />
        <h1 className="text-lg font-black">تم تغيير كلمة المرور بنجاح</h1>
        <p className="text-xs text-slate-400">جارٍ تحويلك...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <div className="text-center mb-6">
          <Lock className="w-10 h-10 text-brand-500 mx-auto mb-3" />
          <h1 className="text-lg font-black">تعيين كلمة مرور جديدة</h1>
        </div>

        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="كلمة المرور الجديدة"
          required
          className="w-full px-4 py-3.5 bg-slate-900 border border-slate-800 focus:border-brand-500 rounded-xl text-sm text-white focus:outline-none transition"
        />
        <input
          type="password"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          placeholder="تأكيد كلمة المرور"
          required
          className="w-full px-4 py-3.5 bg-slate-900 border border-slate-800 focus:border-brand-500 rounded-xl text-sm text-white focus:outline-none transition"
        />

        {error && (
          <div className="bg-brand-600/15 border border-brand-600/30 text-brand-400 text-xs font-bold py-2.5 px-4 rounded-xl">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 bg-gradient-to-r from-brand-600 to-accent-500 hover:opacity-90 disabled:opacity-50 rounded-xl text-sm font-black text-white transition"
        >
          {loading ? 'جارٍ الحفظ...' : 'حفظ كلمة المرور'}
        </button>
      </form>
    </div>
  )
}
