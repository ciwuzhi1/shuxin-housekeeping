import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import { notificationApi } from '../api';
import type { Notification } from '../types';
import {
  LayoutDashboard, Briefcase, CalendarCheck, Award, Wallet,
  Home, Search, ShoppingBag, User, Bell, LogOut, Menu, X,
  Users, ShieldCheck, FileText, BarChart3, Settings, CreditCard,
  Info, Tag
} from 'lucide-react';

function ClientSidebar({ pathname, navigate }: { pathname: string; navigate: any }) {
  const links = [
    { to: '/client', icon: Home, label: '首页' },
    { to: '/client/services', icon: Search, label: '服务分类' },
    { to: '/client/orders', icon: ShoppingBag, label: '我的订单' },
    { to: '/client/profile', icon: User, label: '个人中心' },
  ];
  return (
    <div className="space-y-1">
      {links.map(link => (
        <button
          key={link.to}
          onClick={() => navigate(link.to)}
          className={`sidebar-link w-full text-left ${pathname === link.to ? 'active' : ''}`}
        >
          <link.icon className="w-5 h-5" />
          <span>{link.label}</span>
        </button>
      ))}
    </div>
  );
}

function ProviderSidebar({ pathname, navigate }: { pathname: string; navigate: any }) {
  const links = [
    { to: '/provider', icon: LayoutDashboard, label: '工作台' },
    { to: '/provider/orders', icon: Briefcase, label: '订单管理' },
    { to: '/provider/schedule', icon: CalendarCheck, label: '我的排期' },
    { to: '/provider/certification', icon: Award, label: '资质认证' },
    { to: '/provider/earnings', icon: Wallet, label: '收入中心' },
  ];
  return (
    <div className="space-y-1">
      {links.map(link => (
        <button
          key={link.to}
          onClick={() => navigate(link.to)}
          className={`sidebar-link w-full text-left ${pathname === link.to ? 'active' : ''}`}
        >
          <link.icon className="w-5 h-5" />
          <span>{link.label}</span>
        </button>
      ))}
    </div>
  );
}

function AdminSidebar({ pathname, navigate }: { pathname: string; navigate: any }) {
  const links = [
    { to: '/admin', icon: BarChart3, label: '数据概览' },
    { to: '/admin/users', icon: Users, label: '用户管理' },
    { to: '/admin/providers', icon: ShieldCheck, label: '家政人员管理' },
    { to: '/admin/orders', icon: FileText, label: '订单管理' },
    { to: '/admin/finance', icon: CreditCard, label: '财务管理' },
    { to: '/admin/system', icon: Settings, label: '系统设置' },
  ];
  return (
    <div className="space-y-1">
      {links.map(link => (
        <button
          key={link.to}
          onClick={() => navigate(link.to)}
          className={`sidebar-link w-full text-left ${pathname === link.to ? 'active' : ''}`}
        >
          <link.icon className="w-5 h-5" />
          <span>{link.label}</span>
        </button>
      ))}
    </div>
  );
}

export default function Layout() {
  const { user, logout, role, backendAvailable } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  // ===== 通知中心：与订单/资金事件联动 =====
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const loadNotifs = useCallback(async () => {
    if (!user?.id) return;
    try {
      const data = await notificationApi.getAll({ userId: user.id });
      // 后端 read 为 0/1，转为布尔
      setNotifications((data as any[]).map((n: any) => ({ ...n, read: !!n.read })));
    } catch { /* 后端不可用时静默 */ }
  }, [user?.id]);

  // 挂载时加载 + 每 15 秒轮询（及时联动：接单/资金变动后自动出现）
  useEffect(() => {
    loadNotifs();
    const timer = setInterval(loadNotifs, 15000);
    return () => clearInterval(timer);
  }, [loadNotifs]);

  // 点击面板外部关闭
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleNotifToggle = () => {
    const next = !notifOpen;
    setNotifOpen(next);
    if (next) loadNotifs(); // 打开面板时立即刷新
  };

  const handleMarkRead = async (n: Notification) => {
    if (n.read) return;
    try {
      await notificationApi.markRead(n.id);
      setNotifications(prev => prev.map(x => (x.id === n.id ? { ...x, read: true } : x)));
    } catch { /* 忽略 */ }
  };

  const handleMarkAll = async () => {
    try {
      await notificationApi.markAllRead(user?.id);
      setNotifications(prev => prev.map(x => ({ ...x, read: true })));
    } catch { /* 忽略 */ }
  };

  const notifMeta = (type: string) => {
    switch (type) {
      case 'income': return { Icon: Wallet, bg: 'bg-green-100', color: 'text-green-600' };
      case 'order': return { Icon: ShoppingBag, bg: 'bg-blue-100', color: 'text-blue-600' };
      case 'promo': return { Icon: Tag, bg: 'bg-orange-100', color: 'text-orange-600' };
      case 'certification': return { Icon: Award, bg: 'bg-purple-100', color: 'text-purple-600' };
      default: return { Icon: Info, bg: 'bg-gray-100', color: 'text-gray-600' };
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const roleLabels: Record<string, string> = {
    client: '用户端',
    provider: '家政人员端',
    admin: '后台管理端',
  };

  const roleColors: Record<string, string> = {
    client: 'bg-blue-600',
    provider: 'bg-emerald-600',
    admin: 'bg-purple-600',
  };

  return (
    <div className="min-h-screen flex">
      {/* 侧边栏 - 桌面端 */}
      <aside className="hidden md:flex md:flex-col w-60 bg-white border-r border-gray-200">
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-sm font-bold text-white">舒</span>
            </div>
            <div>
              <h1 className="font-bold text-gray-900">舒心家政</h1>
              <p className="text-xs text-gray-500">{roleLabels[role!]}</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 overflow-y-auto">
          {role === 'client' && <ClientSidebar pathname={location.pathname} navigate={navigate} />}
          {role === 'provider' && <ProviderSidebar pathname={location.pathname} navigate={navigate} />}
          {role === 'admin' && <AdminSidebar pathname={location.pathname} navigate={navigate} />}
        </nav>
        <div className="p-3 border-t border-gray-100 space-y-2">
          <div className="flex items-center gap-2 px-4">
            <span className={`w-2 h-2 rounded-full ${backendAvailable ? 'bg-green-500' : 'bg-yellow-500'}`} />
            <span className="text-xs text-gray-400">{backendAvailable ? 'API 已连接' : '本地模式'}</span>
          </div>
          <div className="flex items-center gap-3 px-4 py-2">
            <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-gray-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
              <p className="text-xs text-gray-500 truncate">{user?.phone}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* 移动端侧边栏 */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-white shadow-xl">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <span className="text-sm font-bold text-white">舒</span>
                </div>
                <span className="font-bold text-gray-900">舒心家政</span>
              </div>
              <button onClick={() => setSidebarOpen(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="p-3">
              {role === 'client' && <ClientSidebar pathname={location.pathname} navigate={navigate} />}
              {role === 'provider' && <ProviderSidebar pathname={location.pathname} navigate={navigate} />}
              {role === 'admin' && <AdminSidebar pathname={location.pathname} navigate={navigate} />}
            </nav>
          </aside>
        </div>
      )}

      {/* 主内容区 */}
      <div className="flex-1 flex flex-col min-h-screen">
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-40">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden p-1 hover:bg-gray-100 rounded">
              <Menu className="w-5 h-5" />
            </button>
            <div className={`px-3 py-1 rounded-full text-xs font-medium text-white ${roleColors[role!]}`}>
              {roleLabels[role!]}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* 通知铃铛 + 下拉面板 */}
            <div className="relative" ref={notifRef}>
              <button onClick={handleNotifToggle} className="p-2 hover:bg-gray-100 rounded-full relative" title="通知中心">
                <Bell className="w-5 h-5 text-gray-600" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
                    <h3 className="font-semibold text-gray-900 text-sm">通知中心{unreadCount > 0 && <span className="ml-1.5 px-1.5 py-0.5 bg-red-500 text-white text-[10px] rounded-full">{unreadCount} 未读</span>}</h3>
                    <div className="flex items-center gap-2">
                      {unreadCount > 0 && (
                        <button onClick={handleMarkAll} className="text-xs text-blue-600 hover:text-blue-700 font-medium">全部已读</button>
                      )}
                      <button onClick={() => setNotifOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
                    </div>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="py-10 text-center text-gray-400 text-sm">暂无通知</div>
                    ) : (
                      notifications.slice(0, 30).map(n => {
                        const { Icon, bg, color } = notifMeta(n.type);
                        return (
                          <button key={n.id} onClick={() => handleMarkRead(n)}
                            className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors flex gap-3 ${n.read ? 'opacity-60' : ''}`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${bg}`}>
                              <Icon className={`w-4 h-4 ${color}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium text-gray-900 truncate">{n.title}</p>
                                {!n.read && <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />}
                              </div>
                              <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">{n.content}</p>
                              <p className="text-[11px] text-gray-400 mt-1">{n.createdAt}</p>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            <button onClick={handleLogout} className="flex items-center gap-2 text-sm text-gray-600 hover:text-red-600 transition-colors">
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">退出</span>
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">
          <div key={location.pathname} className="page-content">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
