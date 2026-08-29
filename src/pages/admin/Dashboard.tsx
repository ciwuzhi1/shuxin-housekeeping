import React from 'react';
import { BarChart3, Users, ShieldCheck, FileText, CreditCard, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { adminApi, orderApi } from '../../api';
import { mockAdminStats, mockOrders } from '../../mock/data';
import { getStatusText } from '../../mock/data';
import { useApiData } from '../../hooks/useApiData';

export default function AdminDashboard() {
  const { data: stats, loading, apiMode } = useApiData(
    () => adminApi.getStats(),
    mockAdminStats as any,
    []
  );

  // 修复：最新订单此前永远显示 Mock 数据，改为真实订单（管理员可见全部）
  const { data: recentOrders } = useApiData(
    () => orderApi.getAll(),
    mockOrders as any,
    []
  );

  const statCards = [
    { icon: Users, label: '总用户数', value: (stats.totalUsers || 0).toLocaleString(), change: '+12.5%', up: true, bgColor: 'bg-blue-100', iconColor: 'text-blue-600' },
    { icon: ShieldCheck, label: '家政人员', value: (stats.totalProviders || 0).toLocaleString(), change: '+8.2%', up: true, bgColor: 'bg-green-100', iconColor: 'text-green-600' },
    { icon: FileText, label: '总订单数', value: (stats.totalOrders || 0).toLocaleString(), change: '+15.3%', up: true, bgColor: 'bg-purple-100', iconColor: 'text-purple-600' },
    { icon: CreditCard, label: '总收入', value: ('¥' + ((stats.totalRevenue || 0) / 10000).toFixed(1) + '万'), change: '+20.1%', up: true, bgColor: 'bg-orange-100', iconColor: 'text-orange-600' },
  ];

  const recentOrderList = (recentOrders as any[]).slice(0, 5);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <BarChart3 className="w-6 h-6" /> 数据概览
        </h1>
        <div className="flex items-center gap-4 text-sm text-gray-500">
          {loading ? (
            <span className="flex items-center gap-2"><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>加载中...</span>
          ) : (
            <span className={'flex items-center gap-1 ' + (apiMode ? 'text-green-600' : 'text-yellow-600')}>
              <span className={'w-2 h-2 rounded-full ' + (apiMode ? 'bg-green-500' : 'bg-yellow-500')} />
              {apiMode ? 'API 数据' : '本地 Mock'}
            </span>
          )}
          <span>更新于：{(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:00`; })()}</span>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s, i) => (
          <div key={i} className="card hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <div className={'w-10 h-10 ' + s.bgColor + ' rounded-lg flex items-center justify-center'}>
                <s.icon className={'w-5 h-5 ' + s.iconColor} />
              </div>
              <span className={'flex items-center gap-1 text-xs font-medium ' + (s.up ? 'text-green-600' : 'text-red-600')}>
                {s.up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {s.change}
              </span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            <p className="text-sm text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* 快速提醒 + 趋势 */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="card lg:col-span-1">
          <h2 className="font-semibold text-gray-900 mb-4">待处理事项</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-xl border border-yellow-200">
              <div>
                <p className="font-medium text-gray-900 text-sm">待审核认证</p>
                <p className="text-xs text-yellow-600">{stats.pendingCertifications || 0} 名家政人员等待审核</p>
              </div>
              <span className="text-lg font-bold text-yellow-600">{stats.pendingCertifications || 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-red-50 rounded-xl border border-red-200">
              <div>
                <p className="font-medium text-gray-900 text-sm">退款申请</p>
                <p className="text-xs text-red-600">{stats.pendingRefunds || 0} 个退款请求待处理</p>
              </div>
              <span className="text-lg font-bold text-red-600">{stats.pendingRefunds || 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-xl border border-blue-200">
              <div>
                <p className="font-medium text-gray-900 text-sm">今日新增</p>
                <p className="text-xs text-blue-600">{stats.newUsersToday || 0} 名新用户注册</p>
              </div>
              <span className="text-lg font-bold text-blue-600">{stats.newUsersToday || 0}</span>
            </div>
          </div>
        </div>

        {/* 订单趋势图表 */}
        <div className="card lg:col-span-2">
          <h2 className="font-semibold text-gray-900 mb-4">订单趋势（{apiMode ? '实时' : '模拟'}数据）</h2>
          <div className="h-48 flex items-end gap-2">
            {(stats.orderTrend || []).map((d: any, i: number) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs text-gray-500">{d.count}</span>
                <div className="w-full bg-blue-100 rounded-t-lg relative" style={{ height: String(((d.count) / 1680) * 150) + 'px' }}>
                  <div className="absolute bottom-0 left-0 right-0 bg-blue-500 rounded-t-lg transition-all hover:bg-blue-600" style={{ height: '100%' }} />
                </div>
                <span className="text-xs text-gray-400">{d.date.slice(5)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 服务分布 */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-4">服务分类统计</h2>
          <div className="space-y-4">
            {(stats.serviceDistribution || []).map((s: any, i: number) => (
              <div key={i} className="flex items-center gap-3">
                <span className="w-20 text-sm text-gray-600">{s.name}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-3">
                  <div className="bg-blue-500 h-3 rounded-full transition-all" style={{ width: String(s.percentage) + '%' }} />
                </div>
                <span className="text-sm font-medium text-gray-700 w-12 text-right">{s.percentage}%</span>
                <span className="text-xs text-gray-400 w-16 text-right">{s.count}单</span>
              </div>
            ))}
          </div>
        </div>

        {/* 用户增长 */}
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-4">用户增长趋势</h2>
          <div className="h-48 flex items-end gap-2">
            {(stats.userGrowth || []).map((d: any, i: number) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                <div className="flex gap-1 w-full items-end justify-center" style={{ height: '120px' }}>
                  <div className="w-3 bg-blue-500 rounded-t" style={{ height: String(((d.users) / 12580) * 120) + 'px' }} />
                  <div className="w-3 bg-green-500 rounded-t" style={{ height: String(((d.providers) / 368) * 120) + 'px' }} />
                </div>
                <span className="text-xs text-gray-400">{d.month.slice(5)}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-center gap-4 mt-3 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-blue-500 rounded-sm" /> 用户</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-500 rounded-sm" /> 家政人员</span>
          </div>
        </div>
      </div>

      {/* 最近订单 */}
      <div className="card">
        <h2 className="font-semibold text-gray-900 mb-4">最新订单</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-3 px-2 text-gray-500 font-medium">订单号</th>
                <th className="text-left py-3 px-2 text-gray-500 font-medium">服务</th>
                <th className="text-left py-3 px-2 text-gray-500 font-medium">客户</th>
                <th className="text-left py-3 px-2 text-gray-500 font-medium">金额</th>
                <th className="text-left py-3 px-2 text-gray-500 font-medium">状态</th>
                <th className="text-left py-3 px-2 text-gray-500 font-medium">时间</th>
              </tr>
            </thead>
            <tbody>
              {recentOrderList.map(o => (
                <tr key={o.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-3 px-2 text-gray-900 font-mono text-xs">{o.orderNo}</td>
                  <td className="py-3 px-2 text-gray-900">{o.serviceName}</td>
                  <td className="py-3 px-2 text-gray-600">{o.clientName}</td>
                  <td className="py-3 px-2 font-medium">¥{o.totalAmount}</td>
                  <td className="py-3 px-2">{getStatusText(o.status)}</td>
                  <td className="py-3 px-2 text-gray-400 text-xs">{o.createdAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
