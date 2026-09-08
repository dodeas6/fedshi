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

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center min-h-screen bg-black text-white text-sm">جارٍ التحميل...</div>
  if (!user) return <Navigate to="/auth" replace />
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
        <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/feed" replace />} />
      </Routes>
      <BottomNav />
    </div>
  )
}
