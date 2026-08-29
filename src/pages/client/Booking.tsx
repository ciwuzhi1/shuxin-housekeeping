import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext';
import { orderApi, categoryApi, providerApi } from '../../api';
import { mockServiceCategories, mockProviders } from '../../mock/data';
import { useApiData } from '../../hooks/useApiData';
import { ArrowLeft, Star, Calendar } from 'lucide-react';

const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const timeSlots = ['08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00'];

// 修复：toISOString 取 UTC 日期，中国时区 00:00-07:59 会得到昨天；改为本地日期
const toLocalDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export default function ClientBooking() {
  const { subCategoryId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  // P0 修复：服务分类/价格/在线家政员改从真实 API 拉取（后端不可用时降级 Mock）
  const combined = useApiData(
    async () => {
      const [cats, provs] = await Promise.all([
        categoryApi.getAll(),
        providerApi.getAll({ status: 'online' }),
      ]);
      return { categories: cats as any, providers: provs as any };
    },
    {
      categories: mockServiceCategories as any,
      providers: mockProviders.filter(p => p.status === 'online') as any,
    },
    []
  );

  const categories: any = combined.data.categories;
  const providers: any = combined.data.providers;
  const apiMode = combined.apiMode;

  // 查找服务（优先真实分类数据，字段与 Mock 结构一致）
  let subService = null;
  let categoryName = '';
  for (const cat of categories) {
    const found = (cat.subcategories || []).find((s: any) => s.id === subCategoryId);
    if (found) { subService = found; categoryName = cat.name; break; }
  }

  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [selectedProvider, setSelectedProvider] = useState('');
  const [hours, setHours] = useState(subService?.estimatedDuration || 2);
  const [address, setAddress] = useState(user && 'address' in user ? (user as any).address : '北京市海淀区中关村大街1号');
  const [requirements, setRequirements] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 使用当前登录用户的电话，否则用 mock 的默认值
  const userPhone = user?.phone || '13800138001';

  if (!subService) {
    return (
      <div className="p-8 text-center text-gray-400">
        <p>服务不存在</p>
        <button onClick={() => navigate('/client/services')} className="btn-primary mt-4">返回选择</button>
      </div>
    );
  }

  const totalAmount = subService.price * hours;
  const today = new Date();
  const next7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    return d;
  });

  const handleSubmit = async () => {
    if (!user) { alert('请先登录'); return; }
    if (!selectedDate || !selectedTime) { alert('请选择服务时间和日期'); return; }

    setSubmitting(true);
    try {
      // P0 修复：选择的家政员写入下单 payload（智能匹配则留空）
      const selectedProv = providers.find((p: any) => p.id === selectedProvider);
      const orderData = {
        clientId: user.id,
        clientName: user.name,
        clientPhone: userPhone,
        clientAddress: address,
        serviceCategory: categoryName,
        serviceName: subService.name,
        servicePrice: subService.price,
        totalHours: hours,
        totalAmount: totalAmount,
        scheduledDate: selectedDate,
        scheduledTime: selectedTime,
        specialRequirements: requirements || undefined,
        providerId: selectedProvider || undefined,
        providerName: selectedProvider ? (selectedProv?.name || selectedProvider) : undefined,
      };

      // 优先调用 API，API 不可用时模拟成功（mock 模式）
      try {
        await orderApi.create(orderData);
      } catch (apiErr: any) {
        // API 不可用（网络错误/未登录）时走 mock 降级
        if (apiErr.code === 'NO_TOKEN' || apiErr.status === 0) {
          console.warn('API 不可用，使用 Mock 模拟预约');
        } else {
          throw apiErr; // 真正的错误往上抛
        }
      }

      alert('✅ 预约成功！\n服务：' + subService.name + '\n时间：' + selectedDate + ' ' + selectedTime + '\n金额：¥' + totalAmount + '\n地址：' + address);
      navigate('/client/orders');
    } catch (e: any) {
      alert('❌ 预约失败：' + (e?.message || '请重试'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      {/* 返回 */}
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4">
        <ArrowLeft className="w-4 h-4" /> 返回
      </button>

      {/* 步骤指示 */}
      <div className="flex items-center gap-2 mb-6">
        {['选择服务', '填写信息', '确认下单'].map((s, i) => (
          <React.Fragment key={i}>
            <div className={'flex items-center gap-2 ' + (i + 1 <= 3 ? 'text-blue-600' : 'text-gray-300')}>
              <div className={'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ' + (
                true ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-400'
              )}>{i + 1}</div>
              <span className="text-sm font-medium hidden sm:inline">{s}</span>
            </div>
            {i < 2 && <div className={'flex-1 h-0.5 ' + (true ? 'bg-blue-600' : 'bg-gray-200')} />}
          </React.Fragment>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* 主内容 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 服务信息 */}
          <div className="card">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
                <Calendar className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">{subService.name}</h2>
                <p className="text-sm text-gray-500">{categoryName} · 预估{subService.estimatedDuration}小时</p>
              </div>
              <div className="ml-auto text-right">
                <p className="text-2xl font-bold text-blue-600">¥{subService.price}</p>
                <p className="text-xs text-gray-400">/小时</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mt-3">{subService.description}</p>
            {/* P0 修复：数据来源提示，避免把 Mock 数据当真实 */}
            <p className={'text-xs font-medium mt-2 ' + (apiMode ? 'text-green-600' : 'text-yellow-600')}>
              {apiMode ? '· 分类与人员来自真实服务' : '· 后端不可用，以下为演示数据'}
            </p>
          </div>

          {/* 选择服务人员 */}
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-4">选择服务人员</h3>
            <div className="space-y-3">
              <label className="flex items-center gap-3 p-3 border rounded-xl cursor-pointer hover:border-blue-300 transition-colors">
                <input type="radio" name="provider" value="" checked={selectedProvider === ''} onChange={() => setSelectedProvider('')} className="text-blue-600" />
                <span className="text-sm text-gray-600">智能匹配（推荐）</span>
              </label>
              {providers.map((p: any) => (
                <label key={p.id} className={'flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-colors ' + (
                  selectedProvider === p.id ? 'border-blue-500 bg-blue-50' : 'hover:border-blue-300'
                )}>
                  <input type="radio" name="provider" value={p.id} checked={selectedProvider === p.id} onChange={() => setSelectedProvider(p.id)} className="text-blue-600" />
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                    {(p.name || '?').charAt(0)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{p.name}</span>
                      <div className="flex items-center gap-0.5 text-yellow-500">
                        <Star className="w-3 h-3 fill-current" />
                        <span className="text-xs">{p.rating}</span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500">{p.experience}年经验 · {p.completedOrders}单</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* 选择时间 */}
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-4">选择服务时间</h3>
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">日期</p>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {next7Days.map(d => {
                  const dateStr = toLocalDate(d);
                  const isActive = selectedDate === dateStr;
                  return (
                    <button key={dateStr} onClick={() => setSelectedDate(dateStr)}
                      className={'flex flex-col items-center px-4 py-3 rounded-xl min-w-[72px] transition-all ' + (
                        isActive ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                      )}>
                      <span className="text-xs">{weekDays[d.getDay()]}</span>
                      <span className="text-lg font-bold">{d.getDate()}</span>
                      <span className="text-xs">{d.getMonth() + 1}月</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-2">时间</p>
              <div className="flex flex-wrap gap-2">
                {timeSlots.map(t => (
                  <button key={t} onClick={() => setSelectedTime(t)}
                    className={'px-4 py-2 rounded-lg text-sm font-medium transition-all ' + (
                      selectedTime === t ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                    )}>{t}</button>
                ))}
              </div>
            </div>
          </div>

          {/* 服务时长与地址 */}
          <div className="card">
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">服务时长（小时）</label>
              <div className="flex items-center gap-3">
                <button onClick={() => setHours(Math.max(1, hours - 0.5))} className="w-10 h-10 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50">-</button>
                <span className="text-xl font-bold w-16 text-center">{hours}</span>
                <button onClick={() => setHours(hours + 0.5)} className="w-10 h-10 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50">+</button>
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">服务地址</label>
              <input type="text" value={address} onChange={e => setAddress(e.target.value)} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">特殊要求</label>
              <textarea value={requirements} onChange={e => setRequirements(e.target.value)} rows={3}
                className="input-field resize-none" placeholder="如有特殊需求，请在此说明..." />
            </div>
          </div>
        </div>

        {/* 侧边摘要 */}
        <div className="lg:col-span-1">
          <div className="card sticky top-24">
            <h3 className="font-semibold text-gray-900 mb-4">订单摘要</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">服务</span><span>{subService.name}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">单价</span><span>¥{subService.price}/小时</span></div>
              <div className="flex justify-between"><span className="text-gray-500">时长</span><span>{hours}小时</span></div>
              {selectedDate && <div className="flex justify-between"><span className="text-gray-500">时间</span><span>{selectedDate} {selectedTime}</span></div>}
              {selectedProvider && (
                <div className="flex justify-between"><span className="text-gray-500">服务人员</span><span>{(providers.find((p: any) => p.id === selectedProvider) as any)?.name || ''}</span></div>
              )}
              <hr className="border-gray-200" />
              <div className="flex justify-between text-base">
                <span className="font-semibold text-gray-900">合计</span>
                <span className="font-bold text-2xl text-blue-600">¥{totalAmount}</span>
              </div>
            </div>
            <button onClick={handleSubmit}
              disabled={!selectedDate || !selectedTime || submitting}
              className="btn-primary w-full mt-4 py-3 text-lg">
              {submitting ? '提交中...' : '提交预约'}
            </button>
            <div className="mt-4 p-3 bg-blue-50 rounded-lg text-xs text-blue-600 space-y-1">
              <p>· 预约后将由客服与您确认</p>
              <p>· 支持提前24小时免费取消</p>
              <p>· 服务不满意可申请退款</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
