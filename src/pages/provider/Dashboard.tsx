import React, { useState } from 'react';
import { useAuth } from '../../store/AuthContext';
import { orderApi, notificationApi, providerDataApi } from '../../api';
import { mockOrders, mockNotifications } from '../../mock/data';
import type { ServiceProvider } from '../../types';
import { Star, Briefcase, CalendarCheck, TrendingUp, ChevronRight, Bell, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApiData } from '../../hooks/useApiData';

export default function ProviderDashboard() {
  const { user } = useAuth();
  const provider = user as ServiceProvider;
  const navigate = useNavigate();

  const combined = useApiData(
    async () => {
      if (!provider?.id) throw new Error('no provider');
      const [pending, myOrders] = await Promise.all([
        orderApi.getAll({ status: 'pending' }),
        providerDataApi.getOrders(provider.id),
      ]);
      return { pending: (pending as any), myOrders: (myOrders as any) };
    },
    {
      pending: mockOrders.filter(o => o.status === 'pending') as any,
      myOrders: mockOrders.filter(o => o.providerId === provider?.id) as any,
    },
    [provider?.id]
  );

  const notifs = useApiData(
    () => notificationApi.getAll({ userId: provider?.id || '' }),
    mockNotifications as any,
    [provider?.id]
  );

  const orders: any = [...combined.data.pending, ...combined.data.myOrders];
  const notifications: any = notifs.data;

  const myOrders = orders.filter((o: any) => o.providerId === provider?.id);
  // 修复：UTC 日期在凌晨会错位，改用本地日期
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const todayOrders = myOrders.filter((o: any) => o.scheduledDate === todayStr);
  const pendingOrders = orders.filter((o: any) => o.status === 'pending' && !o.providerId);
  const unreadNotifs = notifications.filter((n: any) => n.userId === provider?.id && !n.read);

  const handleAcceptOrder = async (order: any) => {
    if (!confirm('确认接单：' + order.serviceName + '？（¥' + order.totalAmount + '）')) return;
    try {
      await orderApi.updateStatus(order.id, { status: 'accepted', providerId: provider?.id, providerName: provider?.name });
      alert('接单成功！请按时前往服务。');
    } catch (e: any) {
      alert('接单失败：' + (e?.message || '请重试'));
    }
  };

  const handleViewDetail = (order: any) => {
    alert('订单详情\n服务：' + order.serviceName + '\n客户：' + order.clientName + '\n地址：' + order.clientAddress + '\n时间：' + order.scheduledDate + ' ' + order.scheduledTime + '\n金额：¥' + order.totalAmount);
  };

  const stats = [
    { icon: Briefcase, label: '今日订单', value: todayOrders.length, color: 'blue' },
    { icon: TrendingUp, label: '本月收入', value: '¥' + (provider?.balance || 0), color: 'green' },
    { icon: Star, label: '服务评分', value: provider?.rating || 0, color: 'yellow' },
    { icon: CalendarCheck, label: '已完成', value: provider?.completedOrders || 0, color: 'purple' },
  ];

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* 欢迎信息 */}
      <div className="card bg-gradient-to-r from-emerald-600 to-emerald-700 text-white">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold">欢迎回来，{provider?.name}</h1>
              {combined.apiMode && <span className="px-2 py-0.5 bg-green-500/30 text-green-200 rounded text-xs font-medium">API</span>}
            </div>
            <p className="text-emerald-100">今天是美好的一天，准备接单吧！</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm text-emerald-100">当前状态</p>
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-500 rounded-full text-sm font-medium">
                <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                在线接单中
              </span>
            </div>
            <div className="w-14 h-14 bg-emerald-500 rounded-full flex items-center justify-center text-2xl font-bold">
              {(provider?.name || '?').charAt(0)}
            </div>
          </div>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <div key={i} className="card flex items-center gap-4">
            <div className={'w-12 h-12 rounded-xl flex items-center justify-center ' + (
              s.color === 'blue' ? 'bg-blue-100 text-blue-600' :
              s.color === 'green' ? 'bg-green-100 text-green-600' :
              s.color === 'yellow' ? 'bg-yellow-100 text-yellow-600' :
              'bg-purple-100 text-purple-600'
            )}>
              <s.icon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{s.value}</p>
              <p className="text-sm text-gray-500">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* 待接订单 */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-blue-600" /> 待接订单
            </h2>
            <button onClick={() => navigate('/provider/orders')} className="text-sm text-blue-600 flex items-center gap-1">
              查看全部 <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-3">
            {pendingOrders.length === 0 ? (
              <p className="text-center py-6 text-gray-400">暂无待接订单</p>
            ) : pendingOrders.slice(0, 3).map((order: any) => (
              <div key={order.id} className="p-3 border border-gray-100 rounded-xl hover:border-blue-200 transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-medium text-gray-900">{order.serviceName}</h3>
                    <p className="text-sm text-gray-500">{order.clientName} · {order.clientAddress}</p>
                  </div>
                  <span className="text-lg font-bold text-blue-600">¥{order.totalAmount}</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-400 mb-2">
                  <span>{order.scheduledDate} {order.scheduledTime}</span>
                  <span>{order.serviceCategory}</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleAcceptOrder(order)} className="btn-primary text-xs py-1.5 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> 立即接单
                  </button>
                  <button onClick={() => handleViewDetail(order)} className="btn-secondary text-xs py-1.5">查看详情</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 通知消息 */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Bell className="w-5 h-5 text-blue-600" /> 消息通知
              {unreadNotifs.length > 0 && <span className="px-1.5 py-0.5 bg-red-500 text-white text-xs rounded-full">{unreadNotifs.length}</span>}
            </h2>
          </div>
          <div className="space-y-3 max-h-[320px] overflow-y-auto">
            {notifications.filter((n: any) => n.userId === provider?.id).slice(0, 5).length === 0 ? (
              <p className="text-center py-6 text-gray-400">暂无通知</p>
            ) : notifications.filter((n: any) => n.userId === provider?.id).slice(0, 5).map((n: any) => (
              <div key={n.id} className={'p-3 rounded-xl border ' + (n.read ? 'border-gray-100' : 'border-blue-200 bg-blue-50')}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-sm text-gray-900">{n.title}</p>
                    <p className="text-xs text-gray-500 mt-1">{n.content}</p>
                  </div>
                  {!n.read && <span className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0 mt-1" />}
                </div>
                <p className="text-xs text-gray-400 mt-2">{n.createdAt}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 今日日程 */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <CalendarCheck className="w-5 h-5 text-blue-600" /> 今日日程
          </h2>
        </div>
        <div className="space-y-3">
          {todayOrders.length === 0 ? (
            <p className="text-center py-6 text-gray-400">今日暂无服务安排</p>
          ) : todayOrders.map((order: any) => (
            <div key={order.id} className="flex items-center gap-4 p-3 bg-gray-50 rounded-xl">
              <div className="text-center min-w-[60px]">
                <p className="text-lg font-bold text-gray-900">{order.scheduledTime}</p>
                <p className="text-xs text-gray-400">- {order.deadlineTime}</p>
              </div>
              <div className="w-1 h-12 bg-blue-500 rounded-full" />
              <div className="flex-1">
                <h3 className="font-medium text-gray-900">{order.serviceName}</h3>
                <p className="text-sm text-gray-500">{order.clientName} · {order.clientAddress}</p>
              </div>
              <span className={'px-3 py-1 rounded-full text-xs font-medium ' + (
                order.status === 'accepted' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
              )}>{order.status === 'accepted' ? '待服务' : '服务中'}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
