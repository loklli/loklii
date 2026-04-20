import { Suspense, lazy, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import toast from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import BottomNav from './components/common/BottomNav';
import { requestPushPermission, onForegroundMessage } from './services/firebase';

// Pages
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/auth/LoginPage';
import HostSignup from './pages/auth/HostSignup';
import CustomerSignup from './pages/auth/CustomerSignup';
import BrowsePage from './pages/BrowsePage';
import ListingDetailPage from './pages/ListingDetailPage';
import HostDashboard from './pages/host/HostDashboard';
import HostPublicProfile from './pages/HostPublicProfile';
import OrderTrackingPage from './pages/OrderTrackingPage';
import ChatPage from './pages/ChatPage';
import CustomerProfilePage from './pages/CustomerProfilePage';
import AdminDashboard from './pages/admin/AdminDashboard';

// Lazy-loaded pages
const HostListingsManager = lazy(() => import('./pages/host/HostListingsManager'));
const SignupChoice = lazy(() => import('./pages/auth/SignupChoice'));
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword'));
const LegalPage = lazy(() => import('./pages/LegalPage'));

function ProtectedRoute({ children, role }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex justify-center items-center h-screen"><div className="animate-spin w-8 h-8 border-4 border-amber border-t-transparent rounded-full" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to="/" replace />;
  return children;
}

function AppRoutes() {
  const { user } = useAuth();
  const location = useLocation();
  const hideNav = ['/login', '/signup', '/host/signup', '/customer/signup', '/forgot-password'].includes(location.pathname) || location.pathname.startsWith('/chat/');

  useEffect(() => {
    if (user) {
      try { requestPushPermission(); } catch (e) {}
      try {
        onForegroundMessage((payload) => {
          toast(payload.notification?.body || 'New notification', { icon: '🔔', duration: 5000 });
        });
      } catch (e) {}
    }
  }, [user]);

  // RTL for Arabic
  useEffect(() => {
    if (user?.preferredLanguage === 'ar') {
      document.documentElement.dir = 'rtl';
    } else {
      document.documentElement.dir = 'ltr';
    }
  }, [user?.preferredLanguage]);

  return (
    <>
      <Toaster position="top-center" toastOptions={{ duration: 3000, style: { borderRadius: '12px', fontSize: '14px' } }} />
      <Suspense fallback={<div className="flex justify-center items-center h-screen"><div className="animate-spin w-8 h-8 border-4 border-amber border-t-transparent rounded-full" /></div>}>
        <Routes>
          {/* Public */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupChoice />} />
          <Route path="/host/signup" element={<HostSignup />} />
          <Route path="/customer/signup" element={<CustomerSignup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/legal" element={<LegalPage />} />
          <Route path="/browse" element={<BrowsePage />} />
          <Route path="/listing/:id" element={<ListingDetailPage />} />
          <Route path="/host/:hostId" element={<HostPublicProfile />} />

          {/* Customer */}
          <Route path="/orders" element={<ProtectedRoute><OrdersListPage /></ProtectedRoute>} />
          <Route path="/orders/:id" element={<ProtectedRoute><OrderTrackingPage /></ProtectedRoute>} />
          <Route path="/chat" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
          <Route path="/chat/:conversationId" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute role="customer"><CustomerProfilePage /></ProtectedRoute>} />

          {/* Host */}
          <Route path="/host/dashboard" element={<ProtectedRoute role="host"><HostDashboard /></ProtectedRoute>} />
          <Route path="/host/listings" element={<ProtectedRoute role="host"><HostListingsManager /></ProtectedRoute>} />
          <Route path="/host/listings/new" element={<ProtectedRoute role="host"><HostListingsManager /></ProtectedRoute>} />
          <Route path="/host/profile" element={<ProtectedRoute role="host"><HostProfileEdit /></ProtectedRoute>} />

          {/* Admin */}
          <Route path="/admin" element={<ProtectedRoute role="superadmin"><AdminDashboard /></ProtectedRoute>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      {user && !hideNav && <BottomNav />}
    </>
  );
}

function OrdersListPage() {
  const { user } = useAuth();
  return <Navigate to={user?.role === 'host' ? '/host/dashboard' : '/profile'} replace />;
}

function HostProfileEdit() {
  return <Navigate to="/host/dashboard" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
