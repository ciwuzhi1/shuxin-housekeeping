import React, { useState } from 'react';
import { useAuth } from '../../store/AuthContext';
import { orderApi, providerDataApi } from '../../api';
import { mockOrders, getStatusText, getStatusBadge } from '../../mock/data';
import type { ServiceProvider, Order } from '../../types';
import { Briefcase, Clock, MapPin, X, CheckCircle, XCircle } from 'lucide-react';

export default function ProviderOrders() {
  const { user } = useAuth();
  const provider = user as ServiceProvider;
  const [activeTab, setActiveTab] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orders, setOrders] = useState(mockOrders);
  const [loading, setLoading] = useState(false);

  // 页面加载时获取数据
  React.useEffect(() => {
    if (!provider?.id) return;
    setLoading(true);
    Promise.all([
      orderApi.getAll().catch(() => mockOrders),
      providerDataApi.getOrders(provider.id).catch(() => mockOrders.filter(o => o.providerId === provider.id)),
    ]).then(([all, mine]) => {
      setOrders([...all, ...mine.filter(m => !all.find(a => a.id === m.id))]);
    }).finally(() => setLoading(false));
  }, [provider?.id]);

  const myOrders = orders.filter(o => o.providerId === provider?.id);
  const availableOrders = orders.filter(o => o.status === 'pending' && !o.providerId);

  const tabs = [
    { key: 'all', label: '全部' },
    { key: 'available', label: '可接单', count: availableOrders.length },
    { key: 'processing', label: '进行中' },
    { key: 'completed', label: '已完成' },
  ];

  const getDisplayOrders = () => {
    switch (activeTab) {
      case 'available': return availableOrders;
      case 'processing': return myOrders.filter(o => o.status === 'in_progress' || o.status === 'accepted');
      case 'completed': return myOrders.filter(o => o.status === 'completed' || o.status === 'cancelled');
      default: return [...availableOrders, ...myOrders.filter(o => o.status !== 'pending' || o.providerId)];
    }
  };

  const handleAccept = async (order: any) => {
    if (!confirm(`确认接单：${order.serviceName}？（¥${order.totalAmount}）`)) return;
    try {
      await orderApi.updateStatus(order.id, { status: 'accepted', providerId: provider?.id, providerName: provider?.name });
      alert('接单成功！请按时前往服务。');
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: 'accepted', providerId: provider?.id, providerName: provider?.name } : o));
    } catch (e: any) {
      alert(`接单失败：${e?.message || '请重试'}`);
    }
  };

  const handleComplete = async (order: any) => {
    const action = order.status === 'accepted' ? '开始服务' : '完成服务';
    if (!confirm(`确认${action}？`)) return;
    try {
      const newStatus = order.status === 'accepted' ? 'in_progress' : 'completed';
      await orderApi.updateStatus(order.id, { status: newStatus });
      alert(`${action}成功！`);
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: newStatus } : o));
    } catch (e: any) {
      alert(`${action}失败：${e?.message || '请重试'}`);
    }
  };

  const handleReject = async (order: any) => {
    if (!confirm('确认拒单？该订单将从您的可接单列表移除（其他家政员仍可接单）。')) return;
    try {
      // 说明：拒单为演示占位（无后端状态），仅从当前列表移除，刷新后订单仍会出现
      alert('已拒单：订单已从您的列表移除，其他家政员仍可接单');
      setOrders(prev => prev.filter(o => o.id !== order.id));
    } catch { alert('操作失败'); }
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Briefcase className="w-6 h-6" /> 订单管理
          {loading && <svg className="animate-spin h-5 w-5 text-blue-600" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>}
        </h1>
        <span className="text-sm text-gray-500">可接单：{availableOrders.length}</span>
      </div>

      {/* 标签页 */}
      <div className="flex gap-2 mb-6 overflow-x-auto">
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all relative ${
              activeTab === tab.key ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200 hover:border-blue-300'
            }`}>
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-red-500 text-white">{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* 待接订单 */}
      {activeTab === 'available' && availableOrders.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wider">新订单</h2>
          {availableOrders.map(order => (
            <div key={order.id} className="card mb-3 border-l-4 border-l-blue-500 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900">{order.serviceName}</h3>
                    <span className="text-xs text-gray-400">{order.serviceCategory}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-500 mb-2">
                    <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {order.scheduledDate} {order.scheduledTime}</span>
                    <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {order.clientAddress}</span>
                  </div>
                  <p className="text-sm text-gray-500">客户：{order.clientName} · {order.clientPhone}</p>
                  {order.specialRequirements && (
                    <p className="text-sm text-gray-400 mt-1">备注：{order.specialRequirements}</p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xl font-bold text-blue-600">¥{order.totalAmount}</p>
                  <p className="text-xs text-gray-400">约{order.totalHours}小时</p>
                </div>
              </div>
              <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                <button onClick={() => handleAccept(order)} className="btn-primary text-sm flex items-center gap-1">
                  <CheckCircle className="w-4 h-4" /> 接单
                </button>
                <button onClick={() => handleReject(order)} className="btn-secondary text-sm flex items-center gap-1 text-red-600">
                  <XCircle className="w-4 h-4" /> 拒单
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 我的订单列表 */}
      {myOrders.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wider">我的服务订单</h2>
          <div className="space-y-3">
            {myOrders.map(order => (
              <div key={order.id} className="card hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">{order.serviceName}</h3>
                    <p className="text-sm text-gray-500">{order.serviceCategory}</p>
                  </div>
                  <span className={getStatusBadge(order.status)}>{getStatusText(order.status)}</span>
                </div>
                <div className="grid sm:grid-cols-2 gap-2 text-sm text-gray-600 mb-3">
                  <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-gray-400" />{order.scheduledDate} {order.scheduledTime}-{order.deadlineTime}</div>
                  <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-gray-400" />{order.clientAddress}</div>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <div className="text-sm">
                    <span className="text-gray-500">客户：</span>
                    <span className="font-medium">{order.clientName}</span>
                    <span className="text-gray-400 ml-2">{order.clientPhone}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-blue-600">¥{order.totalAmount}</span>
                    {order.status === 'accepted' && (
                      <button onClick={() => handleComplete(order)} className="btn-success text-sm">开始服务</button>
                    )}
                    {order.status === 'in_progress' && (
                      <button onClick={() => handleComplete(order)} className="btn-success text-sm">完成服务</button>
                    )}
                    <button onClick={() => setSelectedOrder(order)} className="btn-secondary text-sm">详情</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 无数据 */}
      {getDisplayOrders().length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <Briefcase className="w-12 h-12 mx-auto mb-4" />
          <p>暂无订单</p>
        </div>
      )}

      {/* 订单详情弹窗 */}
      {selectedOrder && (
        <div className="modal-overlay" onClick={() => setSelectedOrder(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">订单详情</h2>
              <button onClick={() => setSelectedOrder(null)}><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">编号</span><span>{selectedOrder.orderNo}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">服务</span><span>{selectedOrder.serviceName}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">状态</span><span className={getStatusBadge(selectedOrder.status)}>{getStatusText(selectedOrder.status)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">金额</span><span className="font-bold">¥{selectedOrder.totalAmount}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">服务时间</span><span>{selectedOrder.scheduledDate} {selectedOrder.scheduledTime}-{selectedOrder.deadlineTime}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">地址</span><span>{selectedOrder.clientAddress}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">客户</span><span>{selectedOrder.clientName} {selectedOrder.clientPhone}</span></div>
              {selectedOrder.specialRequirements && <div><span className="text-gray-500">备注</span><p className="mt-1 p-2 bg-gray-50 rounded">{selectedOrder.specialRequirements}</p></div>}
              {selectedOrder.rating && (
                <div className="flex justify-between">
                  <span className="text-gray-500">客户评价</span>
                  <span className="text-yellow-500">{'★'.repeat(selectedOrder.rating)}{'☆'.repeat(5 - selectedOrder.rating)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
