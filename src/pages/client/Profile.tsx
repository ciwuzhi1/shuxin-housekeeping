import React from 'react';
import { Phone, MapPin, ShoppingBag, DollarSign, Shield, Bell, LogOut } from 'lucide-react';
import { useAuth } from '../../store/AuthContext';
import { clientDataApi, orderApi } from '../../api';
import { mockOrders } from '../../mock/data';
import { useApiData } from '../../hooks/useApiData';
import { useNavigate } from 'react-router-dom';

const colorBgMap: Record<string, string> = {
  blue: 'text-blue-600',
  green: 'text-green-600',
  orange: 'text-orange-600',
};

export default function ClientProfile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // 修复：统计与最近订单改为真实 API（clientDataApi.getStats 此前定义了但从未使用）
  const mockMine = mockOrders.filter(o => o.clientId === user?.id);
  const { data: stats } = useApiData(
    () => clientDataApi.getStats(user?.id || ''),
    {
      totalOrders: mockMine.length,
      completedOrders: mockMine.filter(o => o.status === 'completed').length,
      totalSpent: mockMine.filter(o => o.status === 'completed').reduce((s, o) => s + o.totalAmount, 0),
    } as any,
    [user?.id]
  );
  const { data: recentOrders } = useApiData(
    () => orderApi.getAll({ clientId: user?.id || '' }),
    mockMine as any,
    [user?.id]
  );

  const clientOrders = recentOrders as any[];
  const completedOrders = clientOrders.filter(o => o.status === 'completed');
  const totalSpent = stats?.totalSpent ?? completedOrders.reduce((sum, o) => sum + o.totalAmount, 0);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      {/* 用户信息卡片 */}
      <div className="card mb-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
            {user?.name?.charAt(0) || 'U'}
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900">{user?.name}</h1>
            <p className="text-sm text-gray-500 flex items-center gap-1">
              <Phone className="w-3.5 h-3.5" /> {user?.phone}
            </p>
            <p className="text-sm text-gray-500 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" /> 北京市海淀区
            </p>
          </div>
          <button onClick={handleLogout} className="btn-secondary text-sm flex items-center gap-1">
            <LogOut className="w-4 h-4" /> 退出
          </button>
        </div>
      </div>

      {/* 数据统计 */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { icon: ShoppingBag, label: '全部订单', value: clientOrders.length, color: 'blue' },
          { icon: Shield, label: '已完成', value: completedOrders.length, color: 'green' },
          { icon: DollarSign, label: '累计消费', value: `¥${totalSpent}`, color: 'orange' },
        ].map((stat, i) => (
          <div key={i} className="card text-center">
            <stat.icon className={`w-6 h-6 mx-auto mb-2 ${colorBgMap[stat.color] || 'text-blue-600'}`} />
            <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            <p className="text-xs text-gray-500">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* 快捷入口 */}
      <div className="card mb-6">
        <h2 className="font-semibold text-gray-900 mb-4">快捷操作</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: ShoppingBag, label: '我的订单', onClick: () => navigate('/client/orders') },
            { icon: MapPin, label: '常用地址', onClick: () => alert('地址管理功能开发中，敬请期待') },
            { icon: Bell, label: '消息通知', onClick: () => alert('暂无新通知') },
            { icon: Shield, label: '安全设置', onClick: () => alert('安全设置功能开发中，敬请期待') },
          ].map((item, i) => (
            <button key={i} onClick={item.onClick} className="p-4 border border-gray-100 rounded-xl hover:border-blue-200 hover:bg-blue-50 transition-all text-center">
              <item.icon className="w-5 h-5 mx-auto mb-2 text-blue-600" />
              <span className="text-sm text-gray-700">{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 最近订单 */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">最近订单</h2>
          <button onClick={() => navigate('/client/orders')} className="text-sm text-blue-600">查看全部</button>
        </div>
        <div className="space-y-3">
          {clientOrders.slice(0, 3).map(order => (
            <div key={order.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">{order.serviceName}</p>
                <p className="text-xs text-gray-500">{order.scheduledDate}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-blue-600">¥{order.totalAmount}</p>
                <p className="text-xs text-gray-400">{order.status === 'completed' ? '已完成' : order.status === 'pending' ? '待处理' : '进行中'}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
