import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import { LogIn, User, ShieldCheck, Sun, ArrowLeft } from 'lucide-react';

export default function Login() {
  const [username, setUsername] = useState('zhangsan');
  const [password, setPassword] = useState('123456');
  const [role, setRole] = useState<'client' | 'provider' | 'admin'>('client');
  const [error, setError] = useState('');
  const [logging, setLogging] = useState(false);
  // 两步式登录：第一屏选角色，第二屏输入账号密码
  const [step, setStep] = useState<'select' | 'login'>('select');
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

  // 第一步：点击角色卡片 → 预填演示账号并进入登录表单（不会自动登录）
  const selectRole = (r: 'client' | 'provider' | 'admin') => {
    setUsername(testAccounts[r].username);
    setPassword(testAccounts[r].password);
    setRole(r);
    setError('');
    setStep('login');
  };

  const currentRole = roles.find(r => r.value === role)!;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-900 flex items-center justify-center p-4">
      {/* ===== 第一步：选择端 ===== */}
      {step === 'select' && (
        <div className="w-full max-w-5xl">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-lg">
                <span className="text-2xl font-bold text-blue-600">舒</span>
              </div>
              <h1 className="text-4xl font-bold text-white">舒心家政</h1>
            </div>
            <p className="text-blue-200 text-lg">专业家政服务平台 — 请选择您的入口</p>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {roles.map(r => (
              <button
                key={r.value}
                type="button"
                onClick={() => selectRole(r.value)}
                className="group p-8 rounded-2xl bg-white/10 border-2 border-transparent text-white hover:bg-white hover:text-gray-900 hover:border-blue-400 hover:shadow-xl hover:scale-105 transition-all duration-200 text-left"
              >
                <r.icon className="w-10 h-10 mb-4 text-blue-200 group-hover:text-blue-600" />
                <h3 className="text-xl font-semibold mb-1">{r.label}</h3>
                <p className="text-sm text-blue-200 group-hover:text-gray-500">{r.desc}</p>
                <div className="mt-4 text-xs font-medium text-blue-300 group-hover:text-blue-600">
                  进入登录 →
                </div>
              </button>
            ))}
          </div>

          <div className="text-center mt-8">
            <span className={'inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-full ' + (backendAvailable ? 'bg-green-500/20 text-green-200' : 'bg-yellow-500/20 text-yellow-200')}>
              <span className={'w-2 h-2 rounded-full ' + (backendAvailable ? 'bg-green-400' : 'bg-yellow-400')} />
              {backendAvailable ? '后端 API 已连接' : '后端未启动，将使用本地演示数据'}
            </span>
          </div>
        </div>
      )}

      {/* ===== 第二步：登录表单 ===== */}
      {step === 'login' && (
        <div className="w-full max-w-md">
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-xl font-bold text-blue-600">舒</span>
              </div>
              <h1 className="text-3xl font-bold text-white">舒心家政</h1>
            </div>
            <p className="text-blue-200">{currentRole.label} · {currentRole.desc}</p>
          </div>

          <form onSubmit={handleLogin} className="bg-white rounded-2xl shadow-2xl p-8">
            <button
              type="button"
              onClick={() => { setStep('select'); setError(''); }}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-blue-600 mb-4"
            >
              <ArrowLeft className="w-4 h-4" /> 返回重新选择
            </button>

            <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">{currentRole.label}登录</h2>

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
                <p className="text-xs text-blue-600 font-medium mb-1">演示账号（已自动填入）</p>
                <p className="text-xs text-blue-500">
                  {role === 'client' && '• 用户端：zhangsan / 123456'}
                  {role === 'provider' && '• 家政端：liujie / 123456'}
                  {role === 'admin' && '• 管理端：admin / admin123'}
                </p>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
