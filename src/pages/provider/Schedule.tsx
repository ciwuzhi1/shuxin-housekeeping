import React, { useState, useEffect } from 'react';
import { CalendarCheck } from 'lucide-react';
import { providerDataApi } from '../../api';
import { mockOrders } from '../../mock/data';
import { useAuth } from '../../store/AuthContext';
import type { ServiceProvider } from '../../types';

const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const timeSlots = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'];

// 修复：toISOString 取 UTC 日期在凌晨会错位，改用本地日期
const toLocalDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export default function ProviderSchedule() {
  const { user } = useAuth();
  const provider = user as ServiceProvider;
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day');
  const [orders, setOrders] = useState(mockOrders);

  useEffect(() => {
    if (!provider?.id) return;
    providerDataApi.getOrders(provider.id)
      .then(data => setOrders(data))
      .catch(() => {});
  }, [provider?.id]);

  const nextDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + i);
    return d;
  });

  const todayStr = toLocalDate(currentDate);
  const dayOrders = orders.filter(o => o.scheduledDate === todayStr);

  const daySchedule = timeSlots.map(time => {
    // 修复：scheduledTime 为 "09:00-12:00" 区间或 "09:00" 单点，按开始时间匹配
    const ordersAtTime = dayOrders.filter(o => String(o.scheduledTime || '').startsWith(time));
    return { time, orders: ordersAtTime };
  });

  const weekSchedule = nextDays.map(day => {
    const dateStr = toLocalDate(day);
    const ordersForDay = orders.filter(o => o.scheduledDate === dateStr);
    return { date: day, dateStr, orders: ordersForDay };
  });

  const navigateDate = (direction: number) => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + direction);
    setCurrentDate(d);
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <CalendarCheck className="w-6 h-6" /> 我的排期
        </h1>
        <div className="flex gap-2">
          <button onClick={() => setViewMode('day')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${viewMode === 'day' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>日</button>
          <button onClick={() => setViewMode('week')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${viewMode === 'week' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>周</button>
        </div>
      </div>

      {/* 日视图 */}
      {viewMode === 'day' && (
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <button onClick={() => navigateDate(-1)} className="btn-secondary text-sm">&lt; 前一天</button>
            <div className="text-center">
              <h2 className="text-lg font-bold text-gray-900">{currentDate.getMonth() + 1}月{currentDate.getDate()}日</h2>
              <p className="text-sm text-gray-500">{weekDays[currentDate.getDay()]}</p>
            </div>
            <button onClick={() => navigateDate(1)} className="btn-secondary text-sm">后一天 &gt;</button>
          </div>

          <div className="space-y-2">
            {daySchedule.map(({ time, orders: timeOrders }) => (
              <div key={time} className="flex gap-4 min-h-[60px]">
                <div className="w-16 text-right py-2">
                  <span className="text-sm text-gray-500">{time}</span>
                </div>
                <div className="flex-1 border-t border-gray-100 relative py-1">
                  {timeOrders.length > 0 ? timeOrders.map(order => (
                    <div key={order.id} className="absolute left-0 right-0 p-3 bg-blue-50 border-l-4 border-blue-500 rounded-lg shadow-sm">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-gray-900 text-sm">{order.serviceName}</p>
                          <p className="text-xs text-gray-500">{order.clientName} · {order.clientAddress}</p>
                        </div>
                        <span className="text-sm font-bold text-blue-600">¥{order.totalAmount}</span>
                      </div>
                    </div>
                  )) : (
                    <div className="py-3">
                      <p className="text-xs text-gray-300">空闲</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 周视图 */}
      {viewMode === 'week' && (
        <div className="space-y-4">
          {weekSchedule.map(({ date, dateStr, orders: dayOrders }) => (
            <div key={dateStr} className={`card ${dateStr === todayStr ? 'border-blue-300 bg-blue-50/50' : ''}`}>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="font-bold text-gray-900">{date.getMonth() + 1}/{date.getDate()}</span>
                  <span className="text-sm text-gray-500 ml-2">{weekDays[date.getDay()]}</span>
                </div>
                <span className={`text-sm ${dayOrders.length > 0 ? 'text-blue-600 font-medium' : 'text-gray-400'}`}>
                  {dayOrders.length > 0 ? `${dayOrders.length}个服务` : '休息日'}
                </span>
              </div>
              {dayOrders.length > 0 ? (
                <div className="space-y-2">
                  {dayOrders.map(order => (
                    <div key={order.id} className="flex items-center gap-3 p-2 bg-white rounded-lg border border-gray-100">
                      <div className="text-center min-w-[50px]">
                        <p className="font-bold text-gray-900">{order.scheduledTime}</p>
                        <p className="text-xs text-gray-400">{order.deadlineTime}</p>
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 text-sm">{order.serviceName}</p>
                        <p className="text-xs text-gray-500">{order.clientName}</p>
                      </div>
                      <span className="text-sm font-semibold text-blue-600">¥{order.totalAmount}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <CalendarCheck className="w-4 h-4" />
                  <span>暂无安排</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
