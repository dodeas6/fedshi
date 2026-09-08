import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Home, Search, Plus, Inbox, User } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function BottomNav() {
  const { profile } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const hiddenRoutes = ['/auth', '/checkout', '/upload', '/track']
  if (hiddenRoutes.some(r => location.pathname.startsWith(r))) return null

  const navItems = [
    { to: '/feed', icon: Home, label: 'الرئيسية' },
    { to: '/explore', icon: Search, label: 'استكشاف' },
    { to: '/upload', icon: Plus, label: 'نشر', isCenter: true },
    { to: '/inbox', icon: Inbox, label: 'الوارد' },
    { to: '/profile', icon: User, label: 'حسابي' },
  ]

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] h-16 bg-black border-t border-white/10 z-50 flex justify-around items-center px-2">
      {navItems.map(({ to, icon: Icon, label, isCenter }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 text-[10px] font-bold transition-colors ${
              isActive ? 'text-white' : 'text-slate-500'
            }`
          }
        >
          {isCenter ? (
            <div
              className="w-11 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #25f4ee, #fe2c55)' }}
              onClick={(e) => {
                e.preventDefault()
                if (!profile) { navigate('/auth'); return }
                if (profile.role === 'viewer') { navigate('/profile'); return }
                navigate(to)
              }}
            >
              <Icon className="w-5 h-5 text-white" strokeWidth={2.5} />
            </div>
          ) : (
            <Icon className="w-6 h-6" strokeWidth={2} />
          )}
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
