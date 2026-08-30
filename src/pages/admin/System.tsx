import React, { useEffect, useState } from 'react';
import { Settings, Save, Bell, Shield, DollarSign, KeyRound } from 'lucide-react';
import { adminApi, authApi } from '../../api';
import { useAuth } from '../../store/AuthContext';

export default function AdminSystem() {
  const [activeTab, setActiveTab] = useState('basic');
  const { user } = useAuth();

  const tabs = [
    { key: 'basic', label: '基本设置', icon: Settings },
    { key: 'commission', label: '佣金设置', icon: DollarSign },
    { key: 'notification', label: '通知管理', icon: Bell },
    { key: 'security', label: '安全设置', icon: Shield },
  ];

  // 与后端 settings 表键一一对应（未知键会被后端拒绝）
  const [form, setForm] = useState<Record<string, string>>({
    platform_name: '',
    service_phone: '',
    work_start: '',
    work_end: '',
    service_radius: '10',
    auto_dispatch: 'true',
    commission_rate: '15',
    notify_new_order: 'true',
    notify_income: 'true',
    notify_review: 'true',
  });
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  // 修改密码表单
  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [pwdMsg, setPwdMsg] = useState('');
  const [pwdSaving, setPwdSaving] = useState(false);

  useEffect(() => {
    adminApi.getSettings()
      .then(s => setForm(prev => ({ ...prev, ...s })))
      .catch(() => setSaveMsg('⚠️ 无法加载设置（后端不可用），显示默认值'));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg('');
    try {
      const saved = await adminApi.saveSettings(form);
      setForm(prev => ({ ...prev, ...saved }));
      setSaveMsg('✅ 设置已保存到数据库');
    } catch (e: any) {
      setSaveMsg('❌ 保存失败：' + (e?.message || '请重试'));
    } finally {
      setSaving(false);
    }
  };

  const toggle = (key: string) => setForm(prev => ({ ...prev, [key]: prev[key] === 'true' ? 'false' : 'true' }));

  const changePwd = async () => {
    setPwdSaving(true);
    setPwdMsg('');
    try {
      await authApi.changePassword(oldPwd, newPwd);
      setPwdMsg('✅ 密码已修改，下次登录请使用新密码');
      setOldPwd('');
      setNewPwd('');
    } catch (e: any) {
      setPwdMsg('❌ ' + (e?.message || '修改失败'));
    } finally {
      setPwdSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Settings className="w-6 h-6" /> 系统设置
        </h1>
        {activeTab !== 'security' && (
          <div className="flex items-center gap-3">
            {saveMsg && <span className={'text-sm ' + (saveMsg.startsWith('✅') ? 'text-green-600' : 'text-yellow-600')}>{saveMsg}</span>}
            <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2 disabled:opacity-50">
              <Save className="w-4 h-4" /> {saving ? '保存中...' : '保存设置'}
            </button>
          </div>
        )}
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
              <input type="text" value={form.platform_name} onChange={e => setForm({ ...form, platform_name: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">客服热线</label>
              <input type="text" value={form.service_phone} onChange={e => setForm({ ...form, service_phone: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">营业开始时间</label>
              <input type="time" value={form.work_start} onChange={e => setForm({ ...form, work_start: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">营业结束时间</label>
              <input type="time" value={form.work_end} onChange={e => setForm({ ...form, work_end: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">服务半径（公里）</label>
              <input type="number" value={form.service_radius} onChange={e => setForm({ ...form, service_radius: e.target.value })} className="input-field" />
            </div>
            <div className="flex items-center">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={form.auto_dispatch === 'true'} onChange={() => toggle('auto_dispatch')} className="w-5 h-5 text-blue-600 rounded" />
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
              <input type="number" value={form.commission_rate} onChange={e => setForm({ ...form, commission_rate: e.target.value })} className="input-field" />
              <p className="text-xs text-gray-400 mt-1">建议范围 10%-30%，保存后生效</p>
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
                <span className="font-medium text-gray-900">新订单提醒</span>
                <p className="text-sm text-gray-500">客户下单或指派订单时通知家政人员</p>
              </div>
              <input type="checkbox" checked={form.notify_new_order === 'true'} onChange={() => toggle('notify_new_order')} className="w-5 h-5 text-blue-600 rounded" />
            </label>
            <label className="flex items-center justify-between p-4 bg-gray-50 rounded-xl cursor-pointer">
              <div>
                <span className="font-medium text-gray-900">收入到账通知</span>
                <p className="text-sm text-gray-500">订单完成结算后通知家政人员</p>
              </div>
              <input type="checkbox" checked={form.notify_income === 'true'} onChange={() => toggle('notify_income')} className="w-5 h-5 text-blue-600 rounded" />
            </label>
            <label className="flex items-center justify-between p-4 bg-gray-50 rounded-xl cursor-pointer">
              <div>
                <span className="font-medium text-gray-900">服务评价提醒</span>
                <p className="text-sm text-gray-500">收到新评价时通知家政人员</p>
              </div>
              <input type="checkbox" checked={form.notify_review === 'true'} onChange={() => toggle('notify_review')} className="w-5 h-5 text-blue-600 rounded" />
            </label>
          </div>
        </div>
      )}

      {activeTab === 'security' && (
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-6">安全设置</h2>
          <div className="max-w-md space-y-4">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <KeyRound className="w-4 h-4" />
              当前账号：{user?.username}（{user?.name}）
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">原密码</label>
              <input type="password" value={oldPwd} onChange={e => setOldPwd(e.target.value)} className="input-field" placeholder="请输入原密码" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">新密码</label>
              <input type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} className="input-field" placeholder="至少 6 位" />
            </div>
            {pwdMsg && <p className={'text-sm ' + (pwdMsg.startsWith('✅') ? 'text-green-600' : 'text-red-600')}>{pwdMsg}</p>}
            <button
              disabled={pwdSaving || !oldPwd || newPwd.length < 6}
              onClick={changePwd}
              className="btn-primary disabled:opacity-50"
            >
              {pwdSaving ? '提交中...' : '修改密码'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
