import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { TrendingUp, Mail, Lock, User as UserIcon, AtSign, Eye, EyeOff } from 'lucide-react'

export default function AuthPage() {
  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [fullName, setFullName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false)

  const translateAuthError = (error: string) => {
    if (error === 'User already registered') return 'هذا البريد مسجل بالفعل'
    if (error === 'Invalid login credentials') return 'البريد أو كلمة المرور غير صحيحة'
    if (error === 'Email not confirmed') return 'لم تؤكّد بريدك الإلكتروني بعد. تحقق من صندوق الوارد (وصندوق الرسائل غير المرغوبة) واضغط رابط التأكيد أولاً'
    return error
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (mode === 'signup') {
      if (username.trim().length < 3) {
        setError('اسم المستخدم يجب أن يكون 3 أحرف على الأقل')
        setLoading(false)
        return
      }
      const { error, needsEmailConfirmation } = await signUp(email, password, username.trim(), fullName.trim())
      if (error) {
        setError(translateAuthError(error))
        setLoading(false)
        return
      }
      if (needsEmailConfirmation) {
        // مهم: لا يوجد جلسة نشطة بعد، فلا ننتقل لصفحة الفيديوهات وكأن
        // الدخول تم، بل نعرض رسالة واضحة تخبر المستخدم بالضبط ماذا ينتظر
        setAwaitingConfirmation(true)
        setLoading(false)
        return
      }
      navigate('/feed')
    } else {
      const { error } = await signIn(email, password)
      if (error) {
        setError(translateAuthError(error))
        setLoading(false)
        return
      }
      navigate('/feed')
    }
    setLoading(false)
  }

  if (awaitingConfirmation) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 bg-emerald-500/15 rounded-2xl flex items-center justify-center mb-5">
          <Mail className="w-8 h-8 text-emerald-400" />
        </div>
        <h1 className="text-lg font-black mb-2">تحقق من بريدك الإلكتروني 📩</h1>
        <p className="text-sm text-slate-400 max-w-xs leading-relaxed mb-6">
          أرسلنا رابط تأكيد إلى <b className="text-white">{email}</b>. افتح بريدك واضغط الرابط لتفعيل حسابك، ثم عد وسجّل دخولك من هنا.
        </p>
        <button
          onClick={() => { setAwaitingConfirmation(false); setMode('signin') }}
          className="px-6 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm font-bold transition"
        >
          العودة لتسجيل الدخول
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-[-10%] right-[-10%] w-80 h-80 bg-brand-600/15 rounded-full blur-[100px]" />
      <div className="absolute bottom-[-10%] left-[-10%] w-80 h-80 bg-cyan-500/10 rounded-full blur-[100px]" />

      <div className="relative z-10 w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2">
            <TrendingUp className="w-8 h-8 text-brand-500" />
            <h1 className="text-3xl font-black tracking-tight">فدشي</h1>
          </div>
          <p className="text-xs text-slate-400 font-bold">
            {mode === 'signin' ? 'سجّل دخولك للمتابعة' : 'أنشئ حسابك وابدأ التسوّق'}
          </p>
        </div>

        <div className="flex bg-slate-900 rounded-2xl p-1">
          <button
            onClick={() => { setMode('signin'); setError('') }}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
              mode === 'signin' ? 'bg-brand-600 text-white' : 'text-slate-400'
            }`}
          >
            دخول
          </button>
          <button
            onClick={() => { setMode('signup'); setError('') }}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
              mode === 'signup' ? 'bg-brand-600 text-white' : 'text-slate-400'
            }`}
          >
            حساب جديد
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === 'signup' && (
            <>
              <div className="relative">
                <AtSign className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  type="text"
                  placeholder="اسم المستخدم"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  required
                  className="w-full pr-11 pl-4 py-3.5 bg-slate-900 border border-slate-800 focus:border-brand-500 rounded-xl text-sm text-white focus:outline-none transition"
                />
              </div>
              <div className="relative">
                <UserIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  type="text"
                  placeholder="الاسم الكامل"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  className="w-full pr-11 pl-4 py-3.5 bg-slate-900 border border-slate-800 focus:border-brand-500 rounded-xl text-sm text-white focus:outline-none transition"
                />
              </div>
            </>
          )}

          <div className="relative">
            <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
            <input
              type="email"
              placeholder="البريد الإلكتروني"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full pr-11 pl-4 py-3.5 bg-slate-900 border border-slate-800 focus:border-brand-500 rounded-xl text-sm text-white focus:outline-none transition"
            />
          </div>

          <div className="relative">
            <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="كلمة المرور"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full pr-11 pl-11 py-3.5 bg-slate-900 border border-slate-800 focus:border-brand-500 rounded-xl text-sm text-white focus:outline-none transition"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>

          {error && (
            <div className="bg-brand-600/15 border border-brand-600/30 text-brand-400 text-xs font-bold py-2.5 px-4 rounded-xl">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-gradient-to-r from-brand-600 to-accent-500 hover:opacity-90 disabled:opacity-50 rounded-xl text-sm font-black text-white shadow-lg shadow-brand-500/30 transition active:scale-95"
          >
            {loading ? 'جارٍ المعالجة...' : mode === 'signin' ? 'تسجيل الدخول' : 'إنشاء الحساب'}
          </button>
        </form>

        <p className="text-center text-[10px] text-slate-600 leading-relaxed">
          بالاستمرار فإنك توافق على شروط الاستخدام وسياسة الخصوصية الخاصة بفدشي.
        </p>
      </div>
    </div>
  )
}
