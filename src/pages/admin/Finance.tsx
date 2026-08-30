import React, { useCallback, useEffect, useState } from 'react';
import { CreditCard, TrendingUp, DollarSign, ArrowUpRight, ArrowDownRight, Download, X, CheckCircle, XCircle } from 'lucide-react';
import { financeApi } from '../../api';
import { mockFinancialSummary, mockTransactions } from '../../mock/data';
import { useApiData } from '../../hooks/useApiData';

type Withdrawal = {
  id: string; userId: string; userName: string; amount: number;
  accountName: string; accountNo: string; status: string; createdAt: string; processedAt?: string;
};

export default function AdminFinance() {
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'year'>('month');
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [processing, setProcessing] = useState(false);

  const { data: finance, apiMode } = useApiData(
    () => financeApi.getSummary(),
    mockFinancialSummary as any,
    []
  );

  // 真实交易流水（income/refund/withdraw/commission）
  const { data: transactions } = useApiData(
    () => financeApi.getTransactions(),
    mockTransactions as any,
    []
  );

  // 真实提现申请列表（admin 全量）
  const loadWithdrawals = useCallback(() => {
    financeApi.getWithdrawals().then(setWithdrawals).catch(() => setWithdrawals([]));
  }, []);
  useEffect(() => { loadWithdrawals(); }, [loadWithdrawals]);

  const stats = [
    { icon: DollarSign, label: '总收入', value: '¥' + ((finance.totalRevenue || 0) / 10000).toFixed(1) + '万', change: '+20.1%', up: true, bgColor: 'bg-blue-100', iconColor: 'text-blue-600' },
    { icon: TrendingUp, label: '本月收入', value: '¥' + (finance.monthlyRevenue || 0).toLocaleString(), change: '+12.3%', up: true, bgColor: 'bg-green-100', iconColor: 'text-green-600' },
    { icon: CreditCard, label: '待结算', value: '¥' + (finance.pendingPayout || 0).toLocaleString(), change: '-5.2%', up: false, bgColor: 'bg-orange-100', iconColor: 'text-orange-600' },
    { icon: DollarSign, label: '平均客单价', value: '¥' + (finance.averageOrderValue || 0), change: '+3.1%', up: true, bgColor: 'bg-purple-100', iconColor: 'text-purple-600' },
  ];

  const pendingWithdrawals = withdrawals.filter(r => r.status === 'pending');

  // 打款/驳回：调用真实接口后刷新列表
  const processWithdrawal = async (id: string, action: 'pay' | 'reject') => {
    setProcessing(true);
    try {
      if (action === 'pay') await financeApi.payWithdrawal(id);
      else await financeApi.rejectWithdrawal(id);
      loadWithdrawals();
    } catch (e: any) {
      alert('操作失败：' + (e?.message || '请重试'));
    } finally {
      setProcessing(false);
    }
  };

  // 导出报表：用真实流水生成 CSV 下载
  const exportCsv = async () => {
    try {
      const list = (transactions as any[]) || [];
      const header = '类型,描述,金额,状态,时间';
      const typeText = (t: string) => (t === 'income' ? '收入' : t === 'refund' ? '退款' : t === 'withdraw' ? '提现' : '佣金');
      const statusText = (s: string) => (s === 'completed' ? '已完成' : s === 'pending' ? '处理中' : '已作废');
      const rows = list.map(t =>
        [typeText(t.type), '"' + String(t.description || '').replace(/"/g, '""') + '"', Number(t.amount), statusText(t.status), t.createdAt].join(',')
      );
      const csv = '\ufeff' + [header, ...rows].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = '财务流水_' + new Date().toISOString().slice(0, 10) + '.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert('导出失败：' + (e?.message || '请重试'));
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <CreditCard className="w-6 h-6" /> 财务管理
        </h1>
        <div className="flex items-center gap-3">
          <div className="flex gap-1">
            {(['week', 'month', 'year'] as const).map(r => (
              <button key={r} onClick={() => setTimeRange(r)}
                className={'px-3 py-1.5 rounded text-sm font-medium transition-all ' + (timeRange === r ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
                {r === 'week' ? '周' : r === 'month' ? '月' : '年'}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <span className={'flex items-center gap-1 text-xs ' + (apiMode ? 'text-green-600' : 'text-yellow-600')}>
              <span className={'w-2 h-2 rounded-full ' + (apiMode ? 'bg-green-500' : 'bg-yellow-500')} />
              {apiMode ? 'API 数据' : 'Mock'}
            </span>
            <button onClick={exportCsv} className="btn-secondary text-sm flex items-center gap-1">
              <Download className="w-4 h-4" /> 导出报表
            </button>
          </div>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <div key={i} className="card">
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

      {/* 月度收入趋势 */}
      <div className="card">
        <h2 className="font-semibold text-gray-900 mb-4">月度收入趋势</h2>
        <div className="h-56 flex items-end gap-2">
          {(finance.revenueByMonth || []).map((d: any, i: number) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-2">
              <div className="w-full flex flex-col items-center gap-0.5">
                <span className="text-xs text-gray-500">¥{(d.revenue / 10000).toFixed(1)}万</span>
                <div className="w-full bg-blue-100 rounded-t-lg relative" style={{ height: String(((d.revenue) / 134400) * 180) + 'px' }}>
                  <div className="absolute bottom-0 left-0 right-0 bg-blue-500 rounded-t-lg hover:bg-blue-600 transition-colors" style={{ height: '100%' }} />
                </div>
              </div>
              <span className="text-xs text-gray-400">{d.month.slice(5)}月</span>
            </div>
          ))}
        </div>
      </div>

      {/* 收入分类 */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-4">收入分类</h2>
          <div className="space-y-4">
            {(finance.revenueByCategory || []).map((c: any, i: number) => (
              <div key={i} className="flex items-center gap-3">
                <span className="w-20 text-sm text-gray-600">{c.category}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-3">
                  <div className="bg-blue-500 h-3 rounded-full transition-all" style={{ width: String(c.percentage) + '%' }} />
                </div>
                <span className="text-sm font-medium text-gray-700 w-12 text-right">{c.percentage}%</span>
                <span className="text-xs text-gray-400 w-20 text-right">¥{((c.revenue || 0) / 10000).toFixed(1)}万</span>
              </div>
            ))}
          </div>
        </div>

        {/* 提现管理 */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">提现管理</h2>
            {pendingWithdrawals.length > 0 && (
              <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
                {pendingWithdrawals.length} 笔待处理
              </span>
            )}
          </div>
          <div className="space-y-3">
            {withdrawals.slice(0, 4).map(r => (
              <div key={r.id} className="flex items-center justify-between p-3 border border-gray-100 rounded-xl">
                <div>
                  <p className="font-medium text-gray-900 text-sm">{r.userName}</p>
                  <p className="text-xs text-gray-400">{r.accountName} {r.accountNo}</p>
                  <p className="text-xs text-gray-400">{String(r.createdAt).slice(0, 10)}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-gray-900">¥{r.amount}</p>
                  <span className={'text-xs font-medium ' + (r.status === 'paid' ? 'text-green-600' : r.status === 'rejected' ? 'text-red-500' : 'text-yellow-600')}>
                    {r.status === 'paid' ? '已打款' : r.status === 'rejected' ? '已驳回' : '待处理'}
                  </span>
                </div>
              </div>
            ))}
            {withdrawals.length === 0 && <p className="text-center text-gray-400 text-sm py-4">暂无提现记录</p>}
            <button onClick={() => setShowPayoutModal(true)} className="btn-secondary w-full text-sm">处理提现</button>
          </div>
        </div>
      </div>

      {/* 交易流水 */}
      <div className="card">
        <h2 className="font-semibold text-gray-900 mb-4">最近交易流水</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-3 px-2 text-gray-500 font-medium">类型</th>
                <th className="text-left py-3 px-2 text-gray-500 font-medium">描述</th>
                <th className="text-left py-3 px-2 text-gray-500 font-medium">金额</th>
                <th className="text-left py-3 px-2 text-gray-500 font-medium">状态</th>
                <th className="text-left py-3 px-2 text-gray-500 font-medium">时间</th>
              </tr>
            </thead>
            <tbody>
              {(transactions as any[]).map(t => (
                <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-3 px-2">
                    <span className={'px-2 py-0.5 rounded text-xs font-medium ' + (
                      t.type === 'income' ? 'bg-green-100 text-green-700' :
                      t.type === 'refund' ? 'bg-red-100 text-red-700' :
                      t.type === 'withdraw' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                    )}>
                      {t.type === 'income' ? '收入' : t.type === 'refund' ? '退款' : t.type === 'withdraw' ? '提现' : '佣金'}
                    </span>
                  </td>
                  <td className="py-3 px-2 text-gray-700">{t.description}</td>
                  <td className={'py-3 px-2 font-medium ' + (Number(t.amount) < 0 ? 'text-red-600' : 'text-green-600')}>
                    {Number(t.amount) < 0 ? '-' : '+'}¥{Math.abs(Number(t.amount))}
                  </td>
                  <td className="py-3 px-2">
                    <span className={t.status === 'completed' ? 'text-green-600' : 'text-yellow-600'}>
                      {t.status === 'completed' ? '已完成' : '处理中'}
                    </span>
                  </td>
                  <td className="py-3 px-2 text-gray-400 text-xs">{t.createdAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 提现弹窗：真实打款/驳回 */}
      {showPayoutModal && (
        <div className="modal-overlay" onClick={() => setShowPayoutModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">处理提现</h2>
              <button onClick={() => setShowPayoutModal(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              {pendingWithdrawals.map(r => (
                <div key={r.id} className="flex items-center justify-between p-3 border border-gray-100 rounded-xl">
                  <div>
                    <p className="font-medium text-gray-900">{r.userName}</p>
                    <p className="text-sm text-gray-500">{r.accountName} {r.accountNo}</p>
                    <p className="text-lg font-bold text-blue-600 mt-1">¥{r.amount}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      disabled={processing}
                      onClick={() => processWithdrawal(r.id, 'pay')}
                      className="btn-success flex items-center gap-1 disabled:opacity-50"
                    >
                      <CheckCircle className="w-4 h-4" /> 确认打款
                    </button>
                    <button
                      disabled={processing}
                      onClick={() => processWithdrawal(r.id, 'reject')}
                      className="px-3 py-2 rounded-lg text-sm text-red-600 border border-red-200 hover:bg-red-50 disabled:opacity-50 flex items-center gap-1"
                    >
                      <XCircle className="w-4 h-4" /> 驳回
                    </button>
                  </div>
                </div>
              ))}
              {pendingWithdrawals.length === 0 && (
                <p className="text-center py-8 text-gray-400">暂无待处理的提现申请</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
