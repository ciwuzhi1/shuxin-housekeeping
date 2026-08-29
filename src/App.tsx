/**
 * 应用根组件与路由表
 * 三类角色对应三棵独立路由树，均由 ProtectedRoute 守卫（校验登录 + 角色）：
 *   /client   普通用户端
 *   /provider 家政人员端
 *   /admin    后台管理端
 * 未登录访问受保护路由会被重定向到 /login；根路径按当前角色分流。
 */
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './store/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Layout from './components/Layout';
import ClientHome from './pages/client/Home';
import ClientServices from './pages/client/Services';
import ClientBooking from './pages/client/Booking';
import ClientOrders from './pages/client/Orders';
import ClientProfile from './pages/client/Profile';
import ProviderDashboard from './pages/provider/Dashboard';
import ProviderOrders from './pages/provider/Orders';
import ProviderSchedule from './pages/provider/Schedule';
import ProviderCertification from './pages/provider/Certification';
import ProviderEarnings from './pages/provider/Earnings';
import AdminDashboard from './pages/admin/Dashboard';
import AdminUsers from './pages/admin/Users';
import AdminProviders from './pages/admin/Providers';
import AdminOrders from './pages/admin/OrdersManage';
import AdminFinance from './pages/admin/Finance';
import AdminSystem from './pages/admin/System';

function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles: string[] }) {
  const { isLoggedIn, role, loading } = useAuth();
  // 等待登录状态刷新（避免 setUser 批处理未完成时误拦截）
  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" /></div>;
  if (!isLoggedIn) return <Navigate to="/login" replace />;
  if (!allowedRoles.includes(role!)) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { role } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* 用户端路由 */}
      <Route path="/client" element={<ProtectedRoute allowedRoles={['client']}><Layout /></ProtectedRoute>}>
        <Route index element={<ClientHome />} />
        <Route path="services" element={<ClientServices />} />
        <Route path="services/:categoryId" element={<ClientServices />} />
        <Route path="booking/:subCategoryId" element={<ClientBooking />} />
        <Route path="orders" element={<ClientOrders />} />
        <Route path="profile" element={<ClientProfile />} />
      </Route>

      {/* 家政人员端路由 */}
      <Route path="/provider" element={<ProtectedRoute allowedRoles={['provider']}><Layout /></ProtectedRoute>}>
        <Route index element={<ProviderDashboard />} />
        <Route path="orders" element={<ProviderOrders />} />
        <Route path="schedule" element={<ProviderSchedule />} />
        <Route path="certification" element={<ProviderCertification />} />
        <Route path="earnings" element={<ProviderEarnings />} />
      </Route>

      {/* 后台管理端路由 */}
      <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin']}><Layout /></ProtectedRoute>}>
        <Route index element={<AdminDashboard />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="providers" element={<AdminProviders />} />
        <Route path="orders" element={<AdminOrders />} />
        <Route path="finance" element={<AdminFinance />} />
        <Route path="system" element={<AdminSystem />} />
      </Route>

      <Route path="/" element={
        !role ? <Navigate to="/login" replace /> :
        role === 'client' ? <Navigate to="/client" replace /> :
        role === 'provider' ? <Navigate to="/provider" replace /> :
        <Navigate to="/admin" replace />
      } />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
