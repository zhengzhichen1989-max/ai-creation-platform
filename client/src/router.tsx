import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import AppLayout from '@/components/Layout/AppLayout';
import LoginPage from '@/pages/LoginPage';
import RegisterPage from '@/pages/RegisterPage';
import WorkspacePage from '@/pages/WorkspacePage';
import HistoryPage from '@/pages/HistoryPage';
import CreditsPage from '@/pages/CreditsPage';
import ProfilePage from '@/pages/ProfilePage';
import AdminPage from '@/pages/AdminPage';
import ShouzuoVideoPage from '@/pages/ShouzuoVideoPage';
import ToyVideoPage from '@/pages/ToyVideoPage';
import ResetPasswordPage from '@/pages/ResetPasswordPage';
import ForgotPasswordPage from '@/pages/ForgotPasswordPage';
import type { ReactNode } from 'react';

/** Route guard that redirects unauthenticated users to login */
function ProtectedRoute({ children }: { children: ReactNode }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  if (!accessToken) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

/** Route guard that redirects authenticated users away from login/register */
function PublicRoute({ children }: { children: ReactNode }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  if (accessToken) {
    return <Navigate to="/workspace" replace />;
  }
  return <>{children}</>;
}

/** Route guard that only allows admin users */
function AdminRoute({ children }: { children: ReactNode }) {
  const isAdmin = useAuthStore((s) => s.isAdmin);
  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

export default function AppRouter() {
  return (
    <Routes>
      {/* Public routes */}
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicRoute>
            <RegisterPage />
          </PublicRoute>
        }
      />
      <Route
        path="/reset-password"
        element={<ResetPasswordPage />}
      />
      <Route
        path="/forgot-password"
        element={<ForgotPasswordPage />}
      />

      {/* Protected routes inside AppLayout */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/workspace" replace />} />
        <Route path="workspace" element={<WorkspacePage />} />
        <Route path="shouzuo-video" element={<ShouzuoVideoPage />} />
        <Route path="toy-video" element={<ToyVideoPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="credits" element={<CreditsPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route
          path="admin"
          element={
            <AdminRoute>
              <AdminPage />
            </AdminRoute>
          }
        />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/workspace" replace />} />
    </Routes>
  );
}
