import React, { useState } from 'react';
import { ShieldCheck, Star, Search, CheckCircle, XCircle, X } from 'lucide-react';
import { providerApi } from '../../api';
import { mockProviders, getStatusText } from '../../mock/data';
import { useApiData } from '../../hooks/useApiData';
import type { ServiceProvider } from '../../types';

export default function AdminProviders() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedProvider, setSelectedProvider] = useState<ServiceProvider | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showCertModal, setShowCertModal] = useState(false);
  const [selectedCert, setSelectedCert] = useState<ServiceProvider | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // 加载真实家政人员；后端不可用时降级 Mock
  // includeBalance=true：余额为敏感字段，仅管理员视角可见（后端按角色校验）
  const { data: providers } = useApiData(
    () => providerApi.getAll({ includeBalance: 'true' }),
    mockProviders as any,
    [refreshKey]
  );

  const filtered = (providers as ServiceProvider[]).filter(p => {
    const matchSearch = !searchTerm || p.name.includes(searchTerm) || p.phone.includes(searchTerm);
    const matchStatus = filterStatus === 'all' || p.certificationStatus === filterStatus || p.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const pendingCert = (providers as ServiceProvider[]).filter(p => p.certificationStatus === 'pending');

  const handleVerify = async (provider: ServiceProvider) => {
    if (!confirm(`确认通过 ${provider.name} 的认证申请？`)) return;
    try {
      await providerApi.verify(provider.id);
      alert('认证已通过！');
      setShowCertModal(false);
      setRefreshKey(k => k + 1);
    } catch (e: any) {
      alert('操作失败：' + (e?.message || '请重试'));
    }
  };

  const handleReject = async (provider: ServiceProvider) => {
    const reason = prompt('请输入驳回原因：');
    if (reason === null) return; // 用户点击取消
    try {
      await providerApi.reject(provider.id, reason || '');
      alert(`已驳回认证申请。原因：${reason || '未提供原因'}`);
      setShowCertModal(false);
      setRefreshKey(k => k + 1);
    } catch (e: any) {
      alert('操作失败：' + (e?.message || '请重试'));
    }
  };

  const handleBan = (provider: ServiceProvider) => {
    if (confirm(`确定禁用 ${provider.name} 的账号？`)) {
      // 说明：禁用账号为演示占位（后端暂无禁用状态），此处仅作提示
      alert('【演示占位】禁用账号功能未接入后端，账号未被实际禁用');
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <ShieldCheck className="w-6 h-6" /> 家政人员管理
        </h1>
        <span className="text-sm text-gray-500">共 {(providers as ServiceProvider[]).length} 人</span>
      </div>

      {/* 待审核提醒 */}
      {pendingCert.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="font-medium text-yellow-800">{pendingCert.length} 名家政人员等待资质审核</p>
              <p className="text-sm text-yellow-600">请及时审核认证材料</p>
            </div>
          </div>
          <button onClick={() => { setFilterStatus('pending'); }} className="btn-primary text-sm">去审核</button>
        </div>
      )}

      {/* 搜索和筛选 */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            placeholder="搜索姓名、手机号..."
            className="input-field pl-10 py-3" />
        </div>
        {['all', 'verified', 'pending', 'online', 'offline'].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={`px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
              filterStatus === s ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:border-blue-300'
            }`}>
            {s === 'all' ? '全部' : s === 'verified' ? '已认证' : s === 'pending' ? '审核中' : s === 'online' ? '在线' : '离线'}
          </button>
        ))}
      </div>

      {/* 人员列表 */}
      <div className="grid md:grid-cols-2 gap-4">
        {filtered.map(p => (
          <div key={p.id} className="card hover:shadow-md transition-shadow">
            <div className="flex items-start gap-4 mb-3">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                {p.name?.charAt(0) || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-gray-900">{p.name}</h3>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    p.status === 'online' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}>{p.status === 'online' ? '在线' : '离线'}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    p.certificationStatus === 'verified' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                  }`}>{getStatusText(p.certificationStatus)}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                  <span>{p.gender === 'female' ? '女' : '男'} · {p.age}岁</span>
                  <span>{p.experience}年经验</span>
                  <div className="flex items-center text-yellow-500">
                    <Star className="w-3 h-3 fill-current" />
                    <span>{p.rating}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-1 mb-3">
              {p.skills.map(s => (
                <span key={s.id} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">{s.name}</span>
              ))}
            </div>
            <p className="text-sm text-gray-500 mb-3 line-clamp-2">{p.introduction}</p>
            <div className="flex items-center justify-between pt-3 border-t border-gray-100">
              <span className="text-sm text-gray-500">服务区域：{p.serviceArea.join('、')}</span>
              <div className="flex gap-2">
                <button onClick={() => { setSelectedProvider(p); setShowModal(true); }} className="text-blue-600 text-sm font-medium hover:text-blue-700">详情</button>
                {p.certificationStatus === 'pending' && (
                  <button onClick={() => { setSelectedCert(p); setShowCertModal(true); }} className="text-yellow-600 text-sm font-medium hover:text-yellow-700">审核</button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 详情弹窗 */}
      {showModal && selectedProvider && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content max-w-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold">家政人员详情</h2>
              <button onClick={() => setShowModal(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-3">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white text-xl font-bold">
                    {selectedProvider.name?.charAt(0) || '?'}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{selectedProvider.name}</h3>
                    <p className="text-gray-500">{selectedProvider.gender === 'female' ? '女' : '男'} · {selectedProvider.age}岁</p>
                  </div>
                </div>
                <div className="flex justify-between"><span className="text-gray-500">手机</span><span>{selectedProvider.phone}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">身份证</span><span>{selectedProvider.idCard}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">经验</span><span>{selectedProvider.experience}年</span></div>
                <div className="flex justify-between"><span className="text-gray-500">评分</span><span className="text-yellow-500">{'★'.repeat(Math.round(selectedProvider.rating))} {selectedProvider.rating}</span></div>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between"><span className="text-gray-500">完成订单</span><span className="font-medium">{selectedProvider.completedOrders}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">余额</span><span className="font-medium text-blue-600">¥{selectedProvider.balance}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">状态</span><span>{selectedProvider.status === 'online' ? '在线' : '离线'}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">认证</span><span>{getStatusText(selectedProvider.certificationStatus)}</span></div>
              </div>
            </div>
            <div className="mt-4">
              <p className="text-sm text-gray-500 mb-2">服务区域</p>
              <div className="flex flex-wrap gap-1">
                {selectedProvider.serviceArea.map(a => <span key={a} className="px-2 py-1 bg-gray-50 rounded text-sm">{a}</span>)}
              </div>
            </div>
            <div className="mt-4">
              <p className="text-sm text-gray-500 mb-2">技能</p>
              <div className="flex flex-wrap gap-1">
                {selectedProvider.skills.map(s => <span key={s.id} className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-sm">{s.name}</span>)}
              </div>
            </div>
            <div className="mt-4 p-3 bg-gray-50 rounded-xl text-sm text-gray-600">
              <p className="font-medium mb-1">个人简介</p>
              <p>{selectedProvider.introduction}</p>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => { alert(`已向 ${selectedProvider.name} 发送通知`); setShowModal(false); }} className="btn-primary flex-1">发送通知</button>
              <button onClick={() => handleBan(selectedProvider)} className="btn-danger flex-1">禁用账号</button>
            </div>
          </div>
        </div>
      )}

      {/* 审核弹窗 */}
      {showCertModal && selectedCert && (
        <div className="modal-overlay" onClick={() => setShowCertModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">资质审核</h2>
              <button onClick={() => setShowCertModal(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="flex items-center gap-4 mb-6 p-4 bg-gray-50 rounded-xl">
              <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                {selectedCert.name?.charAt(0) || '?'}
              </div>
              <div>
                <h3 className="font-bold text-gray-900">{selectedCert.name}</h3>
                <p className="text-sm text-gray-500">申请认证 · 提交于 2025-07-01</p>
              </div>
            </div>
            <div className="space-y-4 mb-6">
              <h4 className="font-medium text-gray-900">提交材料</h4>
              {[
                { label: '身份证正面', status: '已上传' },
                { label: '身份证反面', status: '已上传' },
                { label: '健康证明', status: '已上传' },
                { label: '技能证书', status: '未上传' },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between p-3 border border-gray-100 rounded-lg">
                  <span className="text-sm text-gray-700">{item.label}</span>
                  <span className={`text-xs font-medium ${item.status === '已上传' ? 'text-green-600' : 'text-gray-400'}`}>
                    {item.status === '已上传' ? <CheckCircle className="w-4 h-4 inline mr-1" /> : null}
                    {item.status}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => handleVerify(selectedCert)} className="btn-success flex-1 flex items-center justify-center gap-1">
                <CheckCircle className="w-4 h-4" /> 通过认证
              </button>
              <button onClick={() => handleReject(selectedCert)} className="btn-danger flex-1 flex items-center justify-center gap-1">
                <XCircle className="w-4 h-4" /> 驳回
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
