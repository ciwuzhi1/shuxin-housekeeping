import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Phone, ShieldCheck } from 'lucide-react';

export default function Register() {
  const navigate = useNavigate();

  // 安全修复：管理员不允许公开注册
  const [role, setRole] = useState<'client' | 'provider'>('client');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [registering, setRegistering] = useState(false);

  const roles = [
    { value: 'client' as const, label: '用户', icon: User },
    { value: 'provider' as const, label: '家政人员', icon: ShieldCheck },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) { setError('请输入姓名'); return; }
    if (!phone.trim()) { setError('请输入手机号'); return; }
    if (!username.trim()) { setError('请输入用户名'); return; }
    if (!password.trim()) { setError('请输入密码'); return; }

    setRegistering(true);
    try {
      // 先尝试调用后端 API 注册
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, name, phone, role }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success) {
        alert('注册成功！请登录');
        navigate('/login');
        return;
      }
      // 修复：后端明确失败（用户名已存在/参数不合法等）时如实提示，不再假装成功
      setError(json?.message || '注册失败（' + res.status + '），请稍后重试');
    } catch (e: any) {
      // 仅当网络层失败（后端未启动）时保留离线演示降级
      if (e instanceof TypeError || e?.name === 'TypeError') {
        alert('注册成功！请登录（后端未连接，数据未保存，演示模式）');
        navigate('/login');
        return;
      }
      setError('注册失败：' + (e?.message || '请稍后重试'));
    } finally {
      setRegistering(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Link to="/login" className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6">
          <ArrowLeft className="w-4 h-4" />
          返回登录
        </Link>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <div className="text-center mb-8">
            <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <span className="text-xl font-bold text-blue-600">舒</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900">注册账号</h2>
            <p className="text-gray-500 mt-1">加入舒心家政，享受专业服务</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">选择角色</label>
              <div className="grid grid-cols-3 gap-2">
                {roles.map(r => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setRole(r.value)}
                    className={`p-3 border rounded-xl text-center transition-colors ${
                      role === r.value
                        ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                        : 'hover:border-blue-500 hover:bg-blue-50'
                    }`}
                  >
                    <r.icon className={`w-5 h-5 mx-auto mb-1 ${role === r.value ? 'text-blue-600' : 'text-blue-600'}`} />
                    <span className={`text-xs font-medium ${role === r.value ? 'text-blue-700' : ''}`}>{r.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">姓名</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="input-field"
                placeholder="请输入真实姓名"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">手机号</label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="input-field"
                placeholder="请输入手机号码"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">用户名</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="input-field"
                placeholder="设置登录用户名"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">密码</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="input-field"
                placeholder="设置登录密码"
                required
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                {error}
              </div>
            )}

            <button type="submit" disabled={registering} className="btn-primary w-full py-3">
              {registering ? '注册中...' : '注册'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-500">
            已有账号？
            <Link to="/login" className="text-blue-600 hover:text-blue-700 font-medium ml-1">立即登录</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
