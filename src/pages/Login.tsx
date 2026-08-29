import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import { LogIn, User, ShieldCheck, Sun } from 'lucide-react';

export default function Login() {
  const [username, setUsername] = useState('zhangsan');
  const [password, setPassword] = useState('123456');
  const [role, setRole] = useState<'client' | 'provider' | 'admin'>('client');
  const [error, setError] = useState('');
  const [logging, setLogging] = useState(false);
  const { login, user: authUser, backendAvailable } = useAuth();
  const navigate = useNavigate();
  const justLoggedRef = useRef(false);

  // 等待 authUser 状态刷新后跳转（仅在刚登录成功后触发，避免已有用户进入登录页时误跳）
  useEffect(() => {
    if (authUser && justLoggedRef.current) {
      justLoggedRef.current = false;
      navigate(`/${authUser.role}`, { replace: true });
    }
  }, [authUser, navigate]);

  const roles = [
    { value: 'client' as const, label: '用户端', icon: User, desc: '预约家政服务' },
    { value: 'provider' as const, label: '家政人员端', icon: ShieldCheck, desc: '接单与服务' },
    { value: 'admin' as const, label: '后台管理端', icon: Sun, desc: '平台运营管理' },
  ];

  const testAccounts = {
    client: { username: 'zhangsan', password: '123456', label: '张三（用户）' },
    provider: { username: 'liujie', password: '123456', label: '刘姐（家政人员）' },
    admin: { username: 'admin', password: 'admin123', label: '管理员' },
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLogging(true);
    try {
      const success = await login(username, password, role);
      if (success) {
        justLoggedRef.current = true; // 标记刚登录成功，触发 useEffect 跳转
      } else {
        setError('登录失败，请检查用户名');
      }
    } catch (err: any) {
      // 展示后端返回的具体错误（如"密码错误"）；网络异常时给出引导
      setError(err?.message || '登录失败，请检查用户名或密码');
    } finally {
      setLogging(false);
    }
  };

  // 缓冲机制：点击角色卡片仅「选中角色 + 预填账号密码」，不会自动登录，
  // 需用户再点击「登录」按钮确认后才会进入对应端。
  const selectRole = (r: 'client' | 'provider' | 'admin') => {
    setUsername(testAccounts[r].username);
    setPassword(testAccounts[r].password);
    setRole(r);
    setError('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-900 flex items-center justify-center p-4">
      <div className="w-full max-w-5xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-lg">
              <span className="text-2xl font-bold text-blue-600">舒</span>
            </div>
            <h1 className="text-4xl font-bold text-white">舒心家政</h1>
          </div>
          <p className="text-blue-200 text-lg">专业家政服务平台 — 您贴心的家庭服务管家</p>
        </div>

        <div className="grid md:grid-cols-3 gap-4 mb-6">
          {roles.map(r => (
            <button
              key={r.value}
              type="button"
              onClick={() => selectRole(r.value)}
              className={`p-6 rounded-2xl text-left transition-all duration-200 border-2 ${
                role === r.value
                  ? 'bg-white border-blue-400 shadow-xl scale-105'
                  : 'bg-white/10 border-transparent text-white hover:bg-white/20'
              }`}
            >
              <r.icon className={`w-8 h-8 mb-3 ${role === r.value ? 'text-blue-600' : 'text-blue-200'}`} />
              <h3 className={`text-lg font-semibold mb-1 ${role === r.value ? 'text-gray-900' : 'text-white'}`}>{r.label}</h3>
              <p className={`text-sm ${role === r.value ? 'text-gray-500' : 'text-blue-200'}`}>{r.desc}</p>
              {role === r.value && (
                <div className="mt-2 text-xs text-blue-500 font-medium">
                  ✓ 当前选择
                </div>
              )}
            </button>
          ))}
        </div>

        <div className="max-w-md mx-auto">
          <form onSubmit={handleLogin} className="bg-white rounded-2xl shadow-2xl p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">登录</h2>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                {error}
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">用户名</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="input-field"
                placeholder="请输入用户名"
                required
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">密码</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="input-field"
                placeholder="请输入密码"
                required
              />
            </div>

            <button type="submit" disabled={logging} className="btn-primary w-full py-3 text-lg flex items-center justify-center gap-2">
              {logging ? (
                <><svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>登录中...</>
              ) : (
                <><LogIn className="w-5 h-5" />登录</>
              )}
            </button>

            <div className="mt-4 space-y-2">
              <div className={`p-3 rounded-lg text-xs flex items-center gap-2 ${backendAvailable ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'}`}>
                <span className={`w-2 h-2 rounded-full ${backendAvailable ? 'bg-green-500' : 'bg-yellow-500'}`} />
                {backendAvailable ? '✅ 后端 API 已连接，数据通过 HTTP 接口获取' : '⚠️ 后端未启动，使用本地 Mock 数据'}
              </div>
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-xs text-blue-600 font-medium mb-2">测试账号：点卡片自动填入，再点「登录」进入对应端</p>
                <div className="space-y-1 text-xs text-blue-500">
                  <p>• 用户端：zhangsan / 123456</p>
                  <p>• 家政端：liujie / 123456</p>
                  <p>• 管理端：admin / admin123</p>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
