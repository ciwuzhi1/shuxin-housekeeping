import React, { useState, useRef } from 'react';
import { useAuth } from '../../store/AuthContext';
import { providerApi } from '../../api';
import { useApiData } from '../../hooks/useApiData';
import type { ServiceProvider } from '../../types';
import { Award, CheckCircle, Clock, AlertCircle, Upload, FileText, ShieldCheck } from 'lucide-react';

export default function ProviderCertification() {
  const { user } = useAuth();
  const provider = user as ServiceProvider;
  const [showUpload, setShowUpload] = useState(false);
  const [uploadType, setUploadType] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 修复：认证状态以真实接口为准（此前读登录快照，管理员审核通过后页面不刷新）
  const { data: liveProviders } = useApiData(
    () => providerApi.getAll().catch(() => [] as any),
    [] as any,
    [provider?.id]
  );
  const liveMe = (liveProviders as any[]).find((p: any) => p.id === provider?.id);
  const effectiveProvider = (liveMe || provider) as ServiceProvider;

  const certStatus = effectiveProvider?.certificationStatus || 'unsubmitted';

  const statusConfig: Record<string, { icon: any; label: string; color: string; bg: string }> = {
    unsubmitted: { icon: AlertCircle, label: '未提交', color: 'text-gray-400', bg: 'bg-gray-50' },
    pending: { icon: Clock, label: '审核中', color: 'text-yellow-600', bg: 'bg-yellow-50' },
    verified: { icon: CheckCircle, label: '已认证', color: 'text-green-600', bg: 'bg-green-50' },
    rejected: { icon: AlertCircle, label: '未通过', color: 'text-red-600', bg: 'bg-red-50' },
  };

  const config = statusConfig[certStatus] || statusConfig.unsubmitted;

  const certItems = [
    { title: '身份证信息', desc: '需要上传身份证正反面照片', uploaded: !!uploadedFiles.idcard || !!effectiveProvider?.idCardFront, type: 'idcard' },
    { title: '健康证明', desc: '有效期内健康证或体检报告', uploaded: !!uploadedFiles.health || !!effectiveProvider?.healthCert, type: 'health' },
    { title: '技能证书', desc: '家政服务相关职业技能证书', uploaded: !!uploadedFiles.skill || !!effectiveProvider?.skillCert, type: 'skill' },
  ];

  const handleUploadClick = (type: string) => {
    setUploadType(type);
    setShowUpload(true);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // 模拟上传过程
    setUploadedFiles(prev => ({ ...prev, [uploadType]: file.name }));
    setShowUpload(false);
    alert(`"${file.name}" 上传成功！等待管理员审核。`);
  };

  const handleDropZoneClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Award className="w-6 h-6" /> 资质认证
        </h1>
      </div>

      {/* 认证状态卡片 */}
      <div className={`card ${config.bg} border-l-4 ${certStatus === 'verified' ? 'border-l-green-500' : certStatus === 'rejected' ? 'border-l-red-500' : 'border-l-yellow-500'}`}>
        <div className="flex items-center gap-4">
          <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${config.bg}`}>
            <config.icon className={`w-7 h-7 ${config.color}`} />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-gray-900">认证状态：{config.label}</h2>
            <p className="text-sm text-gray-500 mt-1">
              {certStatus === 'unsubmitted' && '请提交相关资质材料进行实名认证'}
              {certStatus === 'pending' && '您的认证材料正在审核中，请耐心等待'}
              {certStatus === 'verified' && '已通过实名认证，享有更多接单权益'}
              {certStatus === 'rejected' && '认证未通过，请重新提交材料'}
            </p>
          </div>
          {certStatus === 'verified' && <ShieldCheck className="w-10 h-10 text-green-500" />}
        </div>
      </div>

      {/* 认证材料列表 */}
      <div className="card">
        <h2 className="font-semibold text-gray-900 mb-4">需要提交的材料</h2>
        <div className="space-y-4">
          {certItems.map((item, i) => (
            <div key={i} className="flex items-center justify-between p-4 border border-gray-100 rounded-xl hover:border-blue-200 transition-colors">
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${item.uploaded ? 'bg-green-50' : 'bg-gray-50'}`}>
                  <FileText className={`w-5 h-5 ${item.uploaded ? 'text-green-600' : 'text-gray-400'}`} />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">{item.title}</h3>
                  <p className="text-sm text-gray-500">{item.desc}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {item.uploaded ? (
                  <span className="flex items-center gap-1 text-sm text-green-600">
                    <CheckCircle className="w-4 h-4" /> 已上传
                  </span>
                ) : (
                  <button onClick={() => handleUploadClick(item.type)} className="btn-primary text-sm flex items-center gap-1">
                    <Upload className="w-4 h-4" /> 上传
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 资质说明 */}
      <div className="card bg-blue-50 border-blue-200">
        <h3 className="font-semibold text-blue-900 mb-2">认证权益说明</h3>
        <ul className="space-y-2 text-sm text-blue-700">
          <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4" /> 认证后可获得「已认证」标识，提升客户信任度</li>
          <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4" /> 优先获得平台订单推送，接单量提升300%</li>
          <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4" /> 享受平台提供的意外保险保障</li>
          <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4" /> 参与平台各类促销活动和奖励计划</li>
        </ul>
      </div>

      {/* 上传弹窗 */}
      {showUpload && (
        <div className="modal-overlay" onClick={() => setShowUpload(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">上传材料</h2>
            <input ref={fileInputRef} type="file" accept=".jpg,.jpeg,.png,.pdf" className="hidden" onChange={handleFileSelect} />
            <div onClick={handleDropZoneClick} className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-blue-400 transition-colors cursor-pointer mb-4">
              <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 font-medium">点击选择文件</p>
              <p className="text-sm text-gray-400 mt-1">支持 JPG、PNG、PDF 格式，文件不超过10MB</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowUpload(false)} className="btn-secondary flex-1">取消</button>
              <button onClick={handleDropZoneClick} className="btn-primary flex-1">选择文件</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
