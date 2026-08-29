import React, { useState } from 'react';
import { Settings, Save, Bell, Shield, DollarSign, RefreshCw } from 'lucide-react';

export default function AdminSystem() {
  const [activeTab, setActiveTab] = useState('basic');

  const tabs = [
    { key: 'basic', label: '基本设置', icon: Settings },
    { key: 'commission', label: '佣金设置', icon: DollarSign },
    { key: 'notification', label: '通知管理', icon: Bell },
    { key: 'security', label: '安全设置', icon: Shield },
  ];

  const [form, setForm] = useState({
    platformName: '舒心家政',
    platformPhone: '400-888-8888',
    workStartTime: '08:00',
    workEndTime: '20:00',
    commissionRate: '15',
    minWithdraw: '100',
    maxWithdraw: '50000',
    serviceRadius: '10',
    cancelTimeLimit: '24',
    orderTimeout: '30',
    newUserCoupon: '50',
    referralReward: '30',
    enableSMS: true,
    enableAutoDispatch: true,
    enableRating: true,
    maintenanceMode: false,
  });

  const handleSave = () => {
    alert('设置已保存！');
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Settings className="w-6 h-6" /> 系统设置
        </h1>
        <button onClick={handleSave} className="btn-primary flex items-center gap-2">
          <Save className="w-4 h-4" /> 保存设置
        </button>
      </div>

      {/* 标签页 */}
      <div className="flex gap-2 overflow-x-auto pb-2 border-b border-gray-200">
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-all ${
              activeTab === tab.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'basic' && (
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-6">基本设置</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">平台名称</label>
              <input type="text" value={form.platformName} onChange={e => setForm({...form, platformName: e.target.value})} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">客服热线</label>
              <input type="text" value={form.platformPhone} onChange={e => setForm({...form, platformPhone: e.target.value})} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">营业开始时间</label>
              <input type="time" value={form.workStartTime} onChange={e => setForm({...form, workStartTime: e.target.value})} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">营业结束时间</label>
              <input type="time" value={form.workEndTime} onChange={e => setForm({...form, workEndTime: e.target.value})} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">服务半径（公里）</label>
              <input type="number" value={form.serviceRadius} onChange={e => setForm({...form, serviceRadius: e.target.value})} className="input-field" />
            </div>
            <div className="flex items-center">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={form.enableAutoDispatch} onChange={e => setForm({...form, enableAutoDispatch: e.target.checked})} className="w-5 h-5 text-blue-600 rounded" />
                <div>
                  <span className="font-medium text-gray-900">启用智能派单</span>
                  <p className="text-sm text-gray-500">系统自动为订单匹配最佳服务人员</p>
                </div>
              </label>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'commission' && (
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-6">佣金设置</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">平台佣金比例（%）</label>
              <input type="number" value={form.commissionRate} onChange={e => setForm({...form, commissionRate: e.target.value})} className="input-field" />
              <p className="text-xs text-gray-400 mt-1">建议范围 10%-30%</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">最低提现金额（元）</label>
              <input type="number" value={form.minWithdraw} onChange={e => setForm({...form, minWithdraw: e.target.value})} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">最高提现金额（元）</label>
              <input type="number" value={form.maxWithdraw} onChange={e => setForm({...form, maxWithdraw: e.target.value})} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">新用户优惠券（元）</label>
              <input type="number" value={form.newUserCoupon} onChange={e => setForm({...form, newUserCoupon: e.target.value})} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">推荐奖励（元）</label>
              <input type="number" value={form.referralReward} onChange={e => setForm({...form, referralReward: e.target.value})} className="input-field" />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'notification' && (
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-6">通知管理</h2>
          <div className="space-y-4">
            <label className="flex items-center justify-between p-4 bg-gray-50 rounded-xl cursor-pointer">
              <div>
                <span className="font-medium text-gray-900">短信通知</span>
                <p className="text-sm text-gray-500">订单确认、状态变更时发送短信通知</p>
              </div>
              <input type="checkbox" checked={form.enableSMS} onChange={e => setForm({...form, enableSMS: e.target.checked})} className="w-5 h-5 text-blue-600 rounded" />
            </label>
            <label className="flex items-center justify-between p-4 bg-gray-50 rounded-xl cursor-pointer">
              <div>
                <span className="font-medium text-gray-900">服务评价提醒</span>
                <p className="text-sm text-gray-500">服务完成后提醒客户进行评价</p>
              </div>
              <input type="checkbox" checked={form.enableRating} onChange={e => setForm({...form, enableRating: e.target.checked})} className="w-5 h-5 text-blue-600 rounded" />
            </label>
          </div>
        </div>
      )}

      {activeTab === 'security' && (
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-6">安全与风控</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">取消订单时限（小时）</label>
              <input type="number" value={form.cancelTimeLimit} onChange={e => setForm({...form, cancelTimeLimit: e.target.value})} className="input-field" />
              <p className="text-xs text-gray-400 mt-1">超过此时限取消需扣除一定费用</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">订单超时时间（分钟）</label>
              <input type="number" value={form.orderTimeout} onChange={e => setForm({...form, orderTimeout: e.target.value})} className="input-field" />
              <p className="text-xs text-gray-400 mt-1">服务人员超时未接单则自动取消</p>
            </div>
          </div>
          <hr className="my-6" />
          <label className="flex items-center justify-between p-4 bg-red-50 rounded-xl cursor-pointer">
            <div className="flex items-center gap-3">
              <RefreshCw className="w-5 h-5 text-red-500" />
              <div>
                <span className="font-medium text-red-900">维护模式</span>
                <p className="text-sm text-red-500">启用后平台暂停服务，仅管理员可访问</p>
              </div>
            </div>
            <input type="checkbox" checked={form.maintenanceMode} onChange={e => setForm({...form, maintenanceMode: e.target.checked})} className="w-5 h-5 text-red-600 rounded" />
          </label>
        </div>
      )}
    </div>
  );
}
