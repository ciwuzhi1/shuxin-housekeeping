import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users as UsersIcon, Search, Phone, X } from 'lucide-react';
import { adminApi } from '../../api';
import { mockClients } from '../../mock/data';
import { useApiData } from '../../hooks/useApiData';
import type { Client } from '../../types';

export default function AdminUsers() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<Client | null>(null);
  const [showModal, setShowModal] = useState(false);
  const navigate = useNavigate();

  // 加载真实用户（客户角色）；后端不可用时降级 Mock
  const { data: users } = useApiData(
    () => adminApi.getUsers({ role: 'client' }),
    mockClients as any,
    []
  );

  const filtered = (users as Client[]).filter(u =>
    !searchTerm || u.name.includes(searchTerm) || u.phone.includes(searchTerm) || u.address.includes(searchTerm)
  );

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <UsersIcon className="w-6 h-6" /> 用户管理
        </h1>
        <span className="text-sm text-gray-500">共 {(users as Client[]).length} 人</span>
      </div>

      {/* 搜索 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
          placeholder="搜索用户姓名、手机号或地址..."
          className="input-field pl-10 py-3" />
      </div>

      {/* 用户列表 */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left py-4 px-4 text-gray-500 font-medium">用户</th>
                <th className="text-left py-4 px-4 text-gray-500 font-medium">手机号</th>
                <th className="text-left py-4 px-4 text-gray-500 font-medium">地址</th>
                <th className="text-left py-4 px-4 text-gray-500 font-medium">订单数</th>
                <th className="text-left py-4 px-4 text-gray-500 font-medium">消费总额</th>
                <th className="text-left py-4 px-4 text-gray-500 font-medium">注册时间</th>
                <th className="text-left py-4 px-4 text-gray-500 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-xs font-bold text-blue-600">
                        {u.name?.charAt(0) || '?'}
                      </div>
                      <span className="font-medium text-gray-900">{u.name}</span>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-gray-600">{u.phone}</td>
                  <td className="py-4 px-4 text-gray-600 max-w-[200px] truncate">{u.address}</td>
                  <td className="py-4 px-4 font-medium">{u.totalOrders}</td>
                  <td className="py-4 px-4 font-medium text-blue-600">¥{u.totalSpent}</td>
                  <td className="py-4 px-4 text-gray-400 text-xs">{u.createdAt}</td>
                  <td className="py-4 px-4">
                    <button onClick={() => { setSelectedUser(u); setShowModal(true); }}
                      className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                      详情
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 用户详情弹窗 */}
      {showModal && selectedUser && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold">用户详情</h2>
              <button onClick={() => setShowModal(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-2xl font-bold text-blue-600">
                {selectedUser.name?.charAt(0) || '?'}
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">{selectedUser.name}</h3>
                <p className="text-sm text-gray-500 flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5" /> {selectedUser.phone}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-xl mb-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900">{selectedUser.totalOrders}</p>
                <p className="text-sm text-gray-500">总订单</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">¥{selectedUser.totalSpent}</p>
                <p className="text-sm text-gray-500">总消费</p>
              </div>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">地址</span><span className="text-gray-900">{selectedUser.address}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">注册时间</span><span className="text-gray-900">{selectedUser.createdAt}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">用户名</span><span className="text-gray-900">{selectedUser.username}</span></div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => { alert(`已向 ${selectedUser.name} 发送通知`); setShowModal(false); }} className="btn-primary flex-1">发送通知</button>
              <button onClick={() => { setShowModal(false); navigate('/admin/orders'); }} className="btn-secondary flex-1">查看订单</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
