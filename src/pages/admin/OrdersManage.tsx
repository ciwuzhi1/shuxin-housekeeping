import React, { useState } from 'react';
import { FileText, Search, X } from 'lucide-react';
import { orderApi } from '../../api';
import { mockOrders, getStatusText, getStatusBadge } from '../../mock/data';
import { useApiData } from '../../hooks/useApiData';
import type { Order } from '../../types';

export default function AdminOrders() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // 加载真实订单（管理员可见全部）；后端不可用时降级 Mock
  const { data: orders } = useApiData(
    () => orderApi.getAll(),
    mockOrders as any,
    []
  );

  const filtered = (orders as Order[]).filter(o => {
    const matchSearch = !searchTerm || o.orderNo.includes(searchTerm) || o.clientName.includes(searchTerm) || o.serviceName.includes(searchTerm);
    const matchStatus = statusFilter === 'all' || o.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const statusCounts = (orders as Order[]).reduce((acc: Record<string, number>, o) => {
    acc[o.status] = (acc[o.status] || 0) + 1;
    return acc;
  }, {});

  const statuses = [
    { key: 'all', label: '全部', count: (orders as Order[]).length },
    { key: 'pending', label: '待处理', count: statusCounts.pending || 0 },
    { key: 'accepted', label: '已确认', count: statusCounts.accepted || 0 },
    { key: 'in_progress', label: '服务中', count: statusCounts.in_progress || 0 },
    { key: 'completed', label: '已完成', count: statusCounts.completed || 0 },
    { key: 'cancelled', label: '已取消', count: statusCounts.cancelled || 0 },
  ];

  const handleRefund = (order: Order) => {
    if (confirm(`确认对订单 ${order.orderNo} 进行退款？`)) {
      alert('退款处理中...');
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <FileText className="w-6 h-6" /> 订单管理
        </h1>
        <span className="text-sm text-gray-500">共 {(orders as Order[]).length} 单</span>
      </div>

      {/* 搜索 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
          placeholder="搜索订单号、客户名、服务..."
          className="input-field pl-10 py-3" />
      </div>

      {/* 状态筛选 */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {statuses.map(s => (
          <button key={s.key} onClick={() => setStatusFilter(s.key)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
              statusFilter === s.key ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200 hover:border-blue-300'
            }`}>
            {s.label} ({s.count})
          </button>
        ))}
      </div>

      {/* 订单列表 */}
      <div className="space-y-3">
        {filtered.map(order => (
          <div key={order.id} className="card hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-gray-400 font-mono">{order.orderNo}</span>
                  <span className={getStatusBadge(order.status)}>{getStatusText(order.status)}</span>
                </div>
                <h3 className="font-semibold text-gray-900">{order.serviceName}</h3>
                <p className="text-sm text-gray-500">{order.serviceCategory}</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-blue-600">¥{order.totalAmount}</p>
                <p className={`text-xs font-medium ${order.paymentStatus === 'paid' ? 'text-green-600' : 'text-yellow-600'}`}>
                  {getStatusText(order.paymentStatus)}
                </p>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2 text-sm text-gray-600 mb-3">
              <div><span className="text-gray-400">客户：</span>{order.clientName} {order.clientPhone}</div>
              <div><span className="text-gray-400">时间：</span>{order.scheduledDate} {order.scheduledTime}</div>
              <div><span className="text-gray-400">地址：</span>{order.clientAddress}</div>
              <div><span className="text-gray-400">人员：</span>{order.providerName || '未分配'}</div>
            </div>
            <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-100">
              <button onClick={() => setSelectedOrder(order)} className="btn-primary text-sm">详情</button>
              {order.status === 'cancelled' && order.paymentStatus !== 'refunded' && (
                <button onClick={() => handleRefund(order)} className="btn-danger text-sm">处理退款</button>
              )}
              <button onClick={() => alert(`联系客户 ${order.clientName}(${order.clientPhone}) 与 ${order.providerName || '未分配'} 的客服沟通`)} className="btn-secondary text-sm">联系双方</button>
            </div>
          </div>
        ))}
      </div>

      {/* 订单详情弹窗 */}
      {selectedOrder && (
        <div className="modal-overlay" onClick={() => setSelectedOrder(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">订单详情</h2>
              <button onClick={() => setSelectedOrder(null)}><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">订单号</span><span className="font-mono">{selectedOrder.orderNo}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">服务</span><span>{selectedOrder.serviceName}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">分类</span><span>{selectedOrder.serviceCategory}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">金额</span><span className="font-bold text-lg text-blue-600">¥{selectedOrder.totalAmount}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">时长</span><span>{selectedOrder.totalHours}小时</span></div>
              <div className="flex justify-between"><span className="text-gray-500">订单状态</span><span className={getStatusBadge(selectedOrder.status)}>{getStatusText(selectedOrder.status)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">支付状态</span><span>{getStatusText(selectedOrder.paymentStatus)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">客户</span><span>{selectedOrder.clientName} {selectedOrder.clientPhone}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">地址</span><span>{selectedOrder.clientAddress}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">时间</span><span>{selectedOrder.scheduledDate} {selectedOrder.scheduledTime}-{selectedOrder.deadlineTime}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">服务人员</span><span>{selectedOrder.providerName || '未分配'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">创建时间</span><span>{selectedOrder.createdAt}</span></div>
              {selectedOrder.specialRequirements && (
                <div><span className="text-gray-500">备注</span><p className="mt-1 p-2 bg-gray-50 rounded">{selectedOrder.specialRequirements}</p></div>
              )}
              {selectedOrder.review && (
                <div><span className="text-gray-500">评价</span><p className="mt-1 p-2 bg-yellow-50 rounded">{'★'.repeat(selectedOrder.rating || 0)} {selectedOrder.review}</p></div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
