import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './context/ToastContext';
import ProtectedRoute from './components/ProtectedRoute';
import AdminLayout from './layouts/AdminLayout';
import LoginPage from './pages/LoginPage';
import KioskRegisterPage from './pages/KioskRegisterPage';
import DashboardPage from './pages/DashboardPage';
import GateControlPage from './pages/GateControlPage';
import VisitorsPage from './pages/VisitorsPage';
import VisitsPage from './pages/VisitsPage';
import AuditLogsPage from './pages/AuditLogsPage';
import SettingsPage from './pages/SettingsPage';

export default function App() {
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem('vms_user');
      const savedToken = localStorage.getItem('vms_token');
      return savedUser && savedToken ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });

  const handleLogin = (userData) => {
    setUser(userData);
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('vms_token');
    localStorage.removeItem('vms_user');
    localStorage.removeItem('vms_user_session');
  };

  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Kiosk Standalone View (No Login Required) */}
          <Route
            path="/kiosk"
            element={
              <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 overflow-y-auto">
                <KioskRegisterPage />
              </div>
            }
          />

          {/* Staff Admin Login Portal */}
          <Route
            path="/login"
            element={
              user ? (
                <Navigate to="/admin/dashboard" replace />
              ) : (
                <LoginPage onLogin={handleLogin} />
              )
            }
          />

          {/* Protected Admin Routes Guard */}
          <Route element={<ProtectedRoute user={user} />}>
            <Route path="/admin" element={<AdminLayout user={user} onLogout={handleLogout} />}>
              <Route index element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="gate" element={<GateControlPage />} />
              <Route path="visitors" element={<VisitorsPage />} />
              <Route path="visits" element={<VisitsPage />} />
              <Route path="audit" element={<AuditLogsPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
          </Route>

          {/* Default Landing Fallback */}
          <Route
            path="/"
            element={
              user ? <Navigate to="/admin/dashboard" replace /> : <Navigate to="/kiosk" replace />
            }
          />
          <Route path="*" element={<Navigate to="/kiosk" replace />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}

