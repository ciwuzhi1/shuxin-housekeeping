import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { categoryApi, providerApi } from '../../api';
import { useApiData } from '../../hooks/useApiData';
import { mockServiceCategories, mockProviders } from '../../mock/data';
import { ArrowRight, Star, Clock, MapPin, Search, Sparkles, Refrigerator, Sofa, Baby, Heart, Wrench } from 'lucide-react';

const iconMap: Record<string, any> = { Sparkles, Refrigerator, Sofa, Baby, Heart, Wrench };

export default function ClientServices() {
  const { categoryId } = useParams();
  const navigate = useNavigate();
  const [selectedCat, setSelectedCat] = useState(categoryId || 'all');
  const [searchTerm, setSearchTerm] = useState('');

  // 修复：服务分类与在线家政员改从真实 API 获取（后端不可用时降级 Mock）
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
  const realCategories: any = combined.data.categories;
  const realProviders: any = combined.data.providers;
  const apiMode = combined.apiMode;

  const categories = [{ id: 'all', name: '全部', icon: 'Sparkles', description: '', image: '', subcategories: [] }, ...realCategories];

  const allSubCategories = realCategories.flatMap((c: any) =>
    c.subcategories.map((s: any) => ({ ...s, categoryName: c.name, categoryId: c.id, categoryIcon: c.icon }))
  );

  const filtered = selectedCat === 'all'
    ? allSubCategories
    : allSubCategories.filter((s: any) => s.categoryId === selectedCat);

  const searched = filtered.filter((s: any) =>
    !searchTerm || s.name.includes(searchTerm) || s.description.includes(searchTerm)
  );

  // 获取某类服务的推荐人员（真实在线家政员）
  const getRecommendedProviders = (skillName: string) => {
    return realProviders.filter((p: any) =>
      p.status === 'online' && (p.skills || []).some((s: any) => skillName.includes(s.name) || s.name.includes(skillName.slice(0, 2)))
    );
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* 搜索栏 */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="搜索服务..."
          className="input-field pl-10 py-3"
        />
      </div>

      {/* 分类导航 */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-hide">
        {categories.map(cat => {
          const Icon = iconMap[cat.icon] || Sparkles;
          const isActive = selectedCat === cat.id;
          return (
            <button key={cat.id} onClick={() => { setSelectedCat(cat.id); navigate(cat.id === 'all' ? '/client/services' : `/client/services/${cat.id}`, { replace: true }); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap transition-all ${
                isActive ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200 hover:border-blue-300'
              }`}>
              {cat.id !== 'all' && <Icon className="w-4 h-4" />}
              <span className="text-sm font-medium">{cat.name}</span>
            </button>
          );
        })}
      </div>

      {/* 服务列表 */}
      <div className="space-y-4">
        {searched.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Search className="w-12 h-12 mx-auto mb-4" />
            <p>未找到相关服务</p>
          </div>
        ) : (
          searched.map((sub: any) => {
            const Icon = iconMap[sub.categoryIcon] || Sparkles;
            const providers = getRecommendedProviders(sub.name);
            return (
              <div key={sub.id} className="card hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div className="w-14 h-14 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Icon className="w-7 h-7 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-lg font-semibold text-gray-900">{sub.name}</h3>
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-xs">{sub.categoryName}</span>
                      </div>
                      <p className="text-sm text-gray-500 mb-2">{sub.description}</p>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />预估{sub.estimatedDuration}小时</span>
                        {providers.length > 0 && (
                          <span className="flex items-center gap-1 text-green-600">
                            <MapPin className="w-3.5 h-3.5" />{providers.length}位可接单
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-2xl font-bold text-blue-600">¥{sub.price}</p>
                    <p className="text-xs text-gray-400">/小时</p>
                    <button onClick={() => navigate(`/client/booking/${sub.id}`)}
                      className="btn-primary mt-2 text-sm flex items-center gap-1">
                      预约 <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* 推荐人员 */}
                {providers.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-xs text-gray-400 mb-2">推荐服务人员：</p>
                    <div className="flex flex-wrap gap-2">
                      {providers.slice(0, 3).map((p: any) => (
                        <div key={p.id} className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg">
                          <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                            {p.name?.charAt(0) || '?'}
                          </div>
                          <span className="text-sm text-gray-700">{p.name}</span>
                          <div className="flex items-center gap-0.5 text-yellow-500">
                            <Star className="w-3 h-3 fill-current" />
                            <span className="text-xs">{p.rating}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
