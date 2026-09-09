import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import AuthPage from './pages/AuthPage'
import FeedPage from './pages/FeedPage'
import ExplorePage from './pages/ExplorePage'
import ProfilePage from './pages/ProfilePage'
import UploadPage from './pages/UploadPage'
import CheckoutPage from './pages/CheckoutPage'
import InboxPage from './pages/InboxPage'
import BottomNav from './components/BottomNav'
import MerchantOrdersPage from './pages/MerchantOrdersPage'
import OrderTrackingPage from './pages/OrderTrackingPage'
import BuyerOrdersPage from './pages/BuyerOrdersPage'
import AdminPage from './pages/AdminPage'
import ChatThreadPage from './pages/ChatThreadPage'
import PublicProfilePage from './pages/PublicProfilePage'
import ResetPasswordPage from './pages/ResetPasswordPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center min-h-screen bg-black text-white text-sm">جارٍ التحميل...</div>
  if (!user) return <Navigate to="/auth" replace />
  return <>{children}</>
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center min-h-screen bg-black text-white text-sm">جارٍ التحميل...</div>
  if (!user) return <Navigate to="/auth" replace />
  // الحماية الحقيقية هنا هي سياسات RLS في قاعدة البيانات؛ هذا فقط يمنع
  // ظهور واجهة اللوحة لغير الأدمن ويعيد توجيهه، وهو تحقق على مستوى
  // الواجهة فقط وليس بديلاً عن حماية الخادم
  if (!profile || (profile.role !== 'admin' && profile.role !== 'super_admin')) {
    return <Navigate to="/feed" replace />
  }
  return <>{children}</>
}

export default function App() {
  const { loading } = useAuth()
  if (loading) {
    return <div className="flex items-center justify-center min-h-screen bg-black text-white text-sm">جارٍ التحميل...</div>
  }

  return (
    <div className="phone-frame">
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/" element={<Navigate to="/feed" replace />} />
        <Route path="/feed" element={<FeedPage />} />
        <Route path="/explore" element={<ExplorePage />} />
        <Route path="/upload" element={<ProtectedRoute><UploadPage /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        <Route path="/checkout/:videoId" element={<ProtectedRoute><CheckoutPage /></ProtectedRoute>} />
        <Route path="/inbox" element={<ProtectedRoute><InboxPage /></ProtectedRoute>} />
        <Route path="/merchant/orders" element={<ProtectedRoute><MerchantOrdersPage /></ProtectedRoute>} />
        <Route path="/track" element={<ProtectedRoute><OrderTrackingPage /></ProtectedRoute>} />
        <Route path="/track/:code" element={<ProtectedRoute><OrderTrackingPage /></ProtectedRoute>} />
        <Route path="/orders" element={<ProtectedRoute><BuyerOrdersPage /></ProtectedRoute>} />
        <Route path="/admin" element={<AdminRoute><AdminPage /></AdminRoute>} />
        <Route path="/inbox/:conversationId" element={<ProtectedRoute><ChatThreadPage /></ProtectedRoute>} />
        <Route path="/u/:userId" element={<PublicProfilePage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="*" element={<Navigate to="/feed" replace />} />
      </Routes>
      <BottomNav />
    </div>
  )
}
