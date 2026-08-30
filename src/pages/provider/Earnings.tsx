import React, { useState } from 'react';
import { useAuth } from '../../store/AuthContext';
import type { ServiceProvider } from '../../types';
import { Wallet, TrendingUp, ArrowUpRight, ArrowDownRight, CreditCard, DollarSign, Clock } from 'lucide-react';
import { providerDataApi } from '../../api';
import { mockTransactions } from '../../mock/data';
import { useApiData } from '../../hooks/useApiData';

export default function ProviderEarnings() {
  const { user } = useAuth();
  const provider = user as ServiceProvider;
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'year'>('month');

  // 修复：交易来源使用本人流水接口（/provider/{id}/earnings 已按本人过滤），
  // 不再调用全平台 /finance/transactions（此前会泄露他人收入）
  const combined = useApiData(
    async () => {
      if (!provider?.id) throw new Error('no provider');
      const earn = await providerDataApi.getEarnings(provider.id);
      return { earnings: (earn as any), transactions: (earn as any).transactions || [] };
    },
    {
      earnings: { totalEarnings: 0, completedOrders: 0, thisMonthEarnings: 0, balance: 0, transactions: [] } as any,
      transactions: mockTransactions as any,
    },
    [provider?.id]
  );

  const apiMode = combined.apiMode;
  const earnings: any = combined.data.earnings;
  const transactions: any = combined.data.transactions;

  // 修复：已提现总额 = 本人 withdraw 流水绝对值之和（原"待结算 ¥1,200"为写死假数据）
  const withdrawnTotal = (transactions as any[])
    .filter((t: any) => t.type === 'withdraw')
    .reduce((s: number, t: any) => s + Math.abs(Number(t.amount) || 0), 0);

  const stats = [
    { icon: DollarSign, label: '总收入', value: '¥' + (earnings.totalEarnings || provider?.balance || 0), change: '+15%', up: true },
    // 修复：本月收入此前误显示总收入，改用后端 thisMonthEarnings
    { icon: TrendingUp, label: '本月收入', value: '¥' + (earnings.thisMonthEarnings ?? 0), change: '+8%', up: true },
    // 修复：余额以接口实时值为准（登录快照可能过期）
    { icon: CreditCard, label: '可提现余额', value: '¥' + (earnings.balance ?? provider?.balance ?? 0), change: '', up: true },
    { icon: Clock, label: '已提现', value: '¥' + withdrawnTotal, change: '', up: false },
  ];

  const handleWithdraw = async () => {
    const amount = prompt('请输入提现金额（元）：', '500');
    if (!amount) return;
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) { alert('请输入有效金额'); return; }
    if (numAmount > Number(earnings.balance ?? provider?.balance ?? 0)) { alert('余额不足！'); return; }
    try {
      // 真实提现申请：校验余额、写 pending 申请与流水、通知管理员
      await providerDataApi.requestWithdrawal(provider.id, {
        amount: numAmount,
        accountName: provider?.name || '',
        accountNo: '建设银行 ****1234',
      });
      alert('提现申请已提交！\n提现金额：¥' + numAmount + '\n等待管理员打款，可在流水中查看进度。');
      combined.reload();
    } catch (e: any) {
      alert('提现失败：' + (e?.message || '请重试'));
    }
  };

  const recentTransactions = transactions.slice(0, 5);
  // 真实趋势数据（后端按周/月/年聚合本人 income 流水）
  const trendData: { label: string; amount: number }[] =
    (earnings.trends && earnings.trends[timeRange]) || [];
  const trendMax = Math.max(1, ...trendData.map(d => d.amount));

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Wallet className="w-6 h-6" /> 收入中心
          {apiMode && <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">API</span>}
        </h1>
        <button onClick={handleWithdraw} className="btn-primary flex items-center gap-2">
          <ArrowUpRight className="w-4 h-4" /> 提现
        </button>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <div key={i} className="card">
            <div className="flex items-center justify-between mb-3">
              <div className={'w-10 h-10 rounded-lg flex items-center justify-center ' + (
                i === 0 ? 'bg-blue-100 text-blue-600' :
                i === 1 ? 'bg-green-100 text-green-600' :
                i === 2 ? 'bg-orange-100 text-orange-600' :
                'bg-purple-100 text-purple-600'
              )}>
                <s.icon className="w-5 h-5" />
              </div>
              {s.change && (
                <span className={'flex items-center gap-1 text-xs font-medium ' + (s.up ? 'text-green-600' : 'text-red-600')}>
                  {s.up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  {s.change}
                </span>
              )}
            </div>
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            <p className="text-sm text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* 收入趋势 */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">收入趋势</h2>
          <div className="flex gap-1">
            {(['week', 'month', 'year'] as const).map(r => (
              <button key={r} onClick={() => setTimeRange(r)}
                className={'px-3 py-1 rounded text-xs font-medium transition-all ' + (timeRange === r ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
                {r === 'week' ? '周' : r === 'month' ? '月' : '年'}
              </button>
            ))}
          </div>
        </div>
        <div className="h-48 flex items-end gap-2">
          {trendData.length === 0 && (
            <p className="w-full text-center py-12 text-gray-400 text-sm">暂无趋势数据（后端不可用时显示空图）</p>
          )}
          {trendData.map((d, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-xs text-gray-500">{d.amount > 0 ? '¥' + d.amount : ''}</span>
              <div className="w-full bg-blue-100 rounded-t-lg relative" style={{ height: String((d.amount / trendMax) * 150) + 'px' }}>
                <div className="absolute bottom-0 left-0 right-0 bg-blue-500 rounded-t-lg" style={{ height: '100%' }} />
              </div>
              <span className="text-xs text-gray-400">{d.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 最近交易 */}
      <div className="card">
        <h2 className="font-semibold text-gray-900 mb-4">最近交易</h2>
        <div className="space-y-3">
          {recentTransactions.length === 0 ? (
            <p className="text-center py-6 text-gray-400">暂无交易记录</p>
          ) : recentTransactions.map((t: any) => (
            <div key={t.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-3">
                <div className={'w-10 h-10 rounded-lg flex items-center justify-center ' + (Number(t.amount) < 0 ? 'bg-red-50' : 'bg-green-50')}>
                  {Number(t.amount) < 0 ? (
                    <ArrowDownRight className="w-5 h-5 text-red-500" />
                  ) : (
                    <ArrowUpRight className="w-5 h-5 text-green-500" />
                  )}
                </div>
                <div>
                  <p className="font-medium text-gray-900 text-sm">{t.description}</p>
                  <p className="text-xs text-gray-400">{t.createdAt}</p>
                </div>
              </div>
              <div className="text-right">
                {/* 修复：金额按正负显示，避免 refund 负数再拼 '-' 号出现 -¥-120 */}
                <p className={'font-bold ' + (Number(t.amount) < 0 ? 'text-red-500' : 'text-green-600')}>
                  {Number(t.amount) < 0 ? '-' : '+'}¥{Math.abs(Number(t.amount))}
                </p>
                <span className={'text-xs ' + (t.status === 'completed' ? 'text-green-600' : 'text-yellow-600')}>
                  {t.status === 'completed' ? '已到账' : '处理中'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
