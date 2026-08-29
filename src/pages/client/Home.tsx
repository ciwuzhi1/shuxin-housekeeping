import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Star, Shield, Clock, DollarSign, Sparkles, Refrigerator, Sofa, Baby, Heart, Wrench, Search } from 'lucide-react';
import { categoryApi, reviewApi, providerApi } from '../../api';
import { mockServiceCategories, mockProviders, mockReviews } from '../../mock/data';
import { useApiData } from '../../hooks/useApiData';

const iconMap: Record<string, any> = { Sparkles, Refrigerator, Sofa, Baby, Heart, Wrench, Search };

export default function ClientHome() {
  const navigate = useNavigate();

  const combined = useApiData(
    async () => {
      const [cats, provs, revs] = await Promise.all([
        categoryApi.getAll(),
        providerApi.getAll({ status: 'online' }),
        reviewApi.getAll({ limit: '3' }),
      ]);
      return { categories: cats, providers: provs, reviews: revs };
    },
    {
      categories: mockServiceCategories as any,
      providers: mockProviders.filter(p => p.status === 'online') as any,
      reviews: mockReviews.slice(0, 3) as any,
    },
    []
  );

  const categories: any = combined.data.categories;
  const providers: any = combined.data.providers;
  const reviews: any = combined.data.reviews;
  const loading = combined.loading;
  const apiMode = combined.apiMode;

  const topProviders = providers.filter((p: any) => p.status === 'online').slice(0, 4);
  const latestReviews = reviews.slice(0, 3);

  return (
    <div className="p-4 md:p-6 space-y-8 max-w-7xl mx-auto">
      {/* 顶部横幅 */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-700 p-8 md:p-12">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl md:text-4xl font-bold text-white">专业家政服务</h1>
            {loading ? null : (
              <span className={('px-2 py-0.5 rounded text-xs font-medium ') + (apiMode ? 'bg-green-500/30 text-green-200' : 'bg-yellow-500/30 text-yellow-200')}>
                {apiMode ? 'API' : 'Mock'}
              </span>
            )}
          </div>
          <p className="text-blue-100 text-lg mb-6">一键预约，享受品质家庭生活</p>
          <button onClick={() => navigate('/client/services')} className="inline-flex items-center gap-2 bg-white text-blue-700 px-6 py-3 rounded-xl font-semibold hover:bg-blue-50 transition-colors">
            立即预约 <ArrowRight className="w-4 h-4" />
          </button>
        </div>
        <div className="absolute right-4 bottom-4 opacity-10">
          <Sparkles className="w-48 h-48 text-white" />
        </div>
      </div>

      {/* 服务分类 */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">服务分类</h2>
          <button onClick={() => navigate('/client/services')} className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
            查看全部 <ArrowRight className="w-3 h-3" />
          </button>
        </div>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {categories.map((cat: any) => {
            const Icon = iconMap[cat.icon] || Sparkles;
            return (
              <button key={cat.id} onClick={() => navigate('/client/services/' + cat.id)}
                className="card flex flex-col items-center gap-2 p-4 hover:shadow-md hover:border-blue-200 transition-all group text-center">
                <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                  <Icon className="w-6 h-6 text-blue-600" />
                </div>
                <span className="text-sm font-medium text-gray-700">{cat.name}</span>
                <span className="text-xs text-gray-400">{cat.subcategories?.length || 0}项服务</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* 推荐服务人员 */}
      <section>
        <h2 className="text-xl font-bold text-gray-900 mb-4">推荐服务人员</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {topProviders.map((p: any) => (
            <div key={p.id} className="card hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                  {(p.name || '?').charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900">{p.name}</h3>
                  <div className="flex items-center gap-1 text-yellow-500">
                    <Star className="w-3 h-3 fill-current" />
                    <span className="text-sm font-medium">{p.rating}</span>
                    <span className="text-xs text-gray-400">（{p.completedOrders}单）</span>
                  </div>
                </div>
                <span className={('px-2 py-1 rounded-full text-xs font-medium ') + (p.status === 'online' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500')}>
                  {p.status === 'online' ? '在线' : '离线'}
                </span>
              </div>
              <p className="text-sm text-gray-500 line-clamp-2 mb-3">{p.introduction}</p>
              <div className="flex flex-wrap gap-1">
                {(p.skills || []).slice(0, 3).map((s: any) => (
                  <span key={s.id} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">{s.name}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 为什么选择我们 */}
      <section className="card">
        <h2 className="text-xl font-bold text-gray-900 mb-6 text-center">为什么选择舒心家政？</h2>
        <div className="grid md:grid-cols-4 gap-6">
          {[
            { icon: Shield, title: '实名认证', desc: '每位服务人员都经过严格实名认证和背景调查' },
            { icon: Star, title: '服务保障', desc: '不满意可申请退款，全程服务有保障' },
            { icon: Clock, title: '准时到达', desc: '服务人员准时上门，迟到赔付' },
            { icon: DollarSign, title: '价格透明', desc: '明码标价，无隐形消费' },
          ].map((item, i) => (
            <div key={i} className="text-center">
              <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mx-auto mb-3">
                <item.icon className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">{item.title}</h3>
              <p className="text-sm text-gray-500">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 用户好评 */}
      {latestReviews.length > 0 && (
        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-4">用户好评</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {latestReviews.map((r: any) => (
              <div key={r.id} className="card">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-xs font-bold">
                    {(r.clientName || '?').charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{r.clientName}</p>
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className={('w-3 h-3 ') + (i < r.rating ? 'text-yellow-500 fill-current' : 'text-gray-300')} />
                      ))}
                    </div>
                  </div>
                </div>
                <p className="text-sm text-gray-600">{r.content}</p>
                <p className="text-xs text-gray-400 mt-2">服务：{r.serviceName}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
