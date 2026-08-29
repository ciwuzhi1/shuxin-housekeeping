import React, { useState } from 'react';
import { useAuth } from '../../store/AuthContext';
import { orderApi } from '../../api';
import { mockOrders, getStatusText, getStatusBadge } from '../../mock/data';
import { ShoppingBag, Star, MessageSquare, Clock, MapPin, X } from 'lucide-react';
import type { Order } from '../../types';
import { useApiData } from '../../hooks/useApiData';

export default function ClientOrders() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showReview, setShowReview] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewContent, setReviewContent] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const { data: orders } = useApiData(
    () => orderApi.getAll({ clientId: user?.id || '' }),
    mockOrders as any,
    [user?.id, refreshKey]
  );

  const tabs = [
    { key: 'all', label: '全部' },
    { key: 'pending', label: '待处理' },
    { key: 'processing', label: '进行中' },
    { key: 'completed', label: '已完成' },
  ];

  // processing 对应 accepted + in_progress 两种状态
  const filtered = activeTab === 'all'
    ? orders
    : activeTab === 'processing'
      ? orders.filter((o: any) => o.status === 'accepted' || o.status === 'in_progress')
      : orders.filter((o: any) => o.status === activeTab);

  const handleCancel = async (order: Order) => {
    if (!confirm('确定取消该订单？')) return;
    try {
      // 调用后端：pending/accepted 状态可取消
      await orderApi.updateStatus(order.id, { status: 'cancelled' });
      alert('订单已取消');
      setRefreshKey(k => k + 1);
    } catch (e: any) {
      alert('取消失败：' + (e?.message || '请重试'));
    }
  };

  const handleReview = (order: Order) => {
    setSelectedOrder(order);
    setShowReview(true);
  };

  const submitReview = async () => {
    if (!selectedOrder) return;
    if (!reviewContent.trim()) { alert('请填写评价内容'); return; }
    try {
      // 调用后端：评价双写 orders + reviews 表，并重算家政员评分
      await orderApi.review(selectedOrder.id, reviewRating, reviewContent);
      alert('评价提交成功！\n评分：' + reviewRating + '星\n内容：' + reviewContent);
      setShowReview(false);
      setSelectedOrder(null);
      setRefreshKey(k => k + 1);
    } catch (e: any) {
      alert('评价提交失败：' + (e?.message || '请重试'));
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <ShoppingBag className="w-6 h-6" /> 我的订单
        </h1>
        <span className="text-sm text-gray-500">共{orders.length}个订单</span>
      </div>

      {/* 标签页 */}
      <div className="flex gap-2 mb-6 overflow-x-auto">
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={'px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ' + (
              activeTab === tab.key ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200 hover:border-blue-300'
            )}>{tab.label}</button>
        ))}
      </div>

      {/* 订单列表 */}
      <div className="space-y-4">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <ShoppingBag className="w-12 h-12 mx-auto mb-4" />
            <p>暂无订单</p>
          </div>
        ) : filtered.map((order: any) => (
          <div key={order.id} className="card hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-gray-900">{order.serviceName}</h3>
                <p className="text-sm text-gray-500">{order.serviceCategory}</p>
              </div>
              <span className={getStatusBadge(order.status)}>{getStatusText(order.status)}</span>
            </div>

            <div className="grid sm:grid-cols-3 gap-3 text-sm text-gray-600 mb-4">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-400" />
                <span>{order.scheduledDate} {order.scheduledTime}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-gray-400" />
                <span className="truncate">{order.clientAddress}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-blue-600">¥{order.totalAmount}</span>
              </div>
            </div>

            {order.providerName && (
              <div className="flex items-center gap-2 mb-3 text-sm text-gray-500">
                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-xs font-bold text-blue-600">
                  {(order.providerName || '?').charAt(0)}
                </div>
                <span>服务人员：{order.providerName}</span>
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-100">
              {/* 修复：后端状态机允许 pending/accepted → cancelled，此前 accepted 订单无取消入口 */}
              {(order.status === 'pending' || order.status === 'accepted') && (
                <button onClick={() => handleCancel(order)} className="btn-secondary text-sm">取消订单</button>
              )}
              {order.status === 'completed' && !order.rating && (
                <button onClick={() => handleReview(order)} className="btn-primary text-sm flex items-center gap-1">
                  <Star className="w-4 h-4" /> 评价
                </button>
              )}
              {order.status === 'completed' && order.rating && (
                <div className="flex items-center gap-1 text-sm text-yellow-500">
                  <Star className="w-4 h-4 fill-current" /> 已评价{order.rating}星
                </div>
              )}
              <button onClick={() => setSelectedOrder(order)} className="btn-secondary text-sm flex items-center gap-1">
                <MessageSquare className="w-4 h-4" /> 联系客服
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* 订单详情弹窗 */}
      {selectedOrder && !showReview && (
        <div className="modal-overlay" onClick={() => setSelectedOrder(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">订单详情</h2>
              <button onClick={() => setSelectedOrder(null)}><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">订单编号</span><span>{selectedOrder.orderNo}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">状态</span><span className={getStatusBadge(selectedOrder.status)}>{getStatusText(selectedOrder.status)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">服务</span><span>{selectedOrder.serviceName}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">金额</span><span className="font-bold">¥{selectedOrder.totalAmount}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">预约时间</span><span>{selectedOrder.scheduledDate} {selectedOrder.scheduledTime}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">服务地址</span><span>{selectedOrder.clientAddress}</span></div>
              {selectedOrder.providerName && (
                <div className="flex justify-between"><span className="text-gray-500">服务人员</span><span>{selectedOrder.providerName}</span></div>
              )}
              {selectedOrder.specialRequirements && (
                <div><span className="text-gray-500">特殊要求</span><p className="mt-1 p-2 bg-gray-50 rounded">{selectedOrder.specialRequirements}</p></div>
              )}
              {selectedOrder.rating && (
                <div className="flex justify-between">
                  <span className="text-gray-500">评价</span>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={'w-4 h-4 ' + (i < (selectedOrder.rating || 0) ? 'text-yellow-500 fill-current' : 'text-gray-300')} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 评价弹窗 */}
      {showReview && (
        <div className="modal-overlay" onClick={() => setShowReview(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">服务评价</h2>
              <button onClick={() => setShowReview(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="text-center mb-6">
              <p className="text-gray-500 mb-3">为{selectedOrder?.serviceName}服务评分</p>
              <div className="flex items-center justify-center gap-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <button key={i} onClick={() => setReviewRating(i + 1)}>
                    <Star className={'w-10 h-10 ' + (i < reviewRating ? 'text-yellow-500 fill-current' : 'text-gray-300') + ' hover:scale-110 transition-transform'} />
                  </button>
                ))}
              </div>
            </div>
            <textarea value={reviewContent} onChange={e => setReviewContent(e.target.value)}
              rows={4} className="input-field resize-none mb-4" placeholder="分享您的服务体验..." />
            <button onClick={submitReview} className="btn-primary w-full py-3">提交评价</button>
          </div>
        </div>
      )}
    </div>
  );
}

