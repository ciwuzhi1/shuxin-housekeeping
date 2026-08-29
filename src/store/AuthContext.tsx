import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import type { User } from '../types';
import { mockClients, mockProviders, mockAdmins } from '../mock/data';
import { authApi, setToken as storeToken, clearToken, getToken } from '../api';

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string, role: 'client' | 'provider' | 'admin') => Promise<boolean>;
  logout: () => void;
  isLoggedIn: boolean;
  role: 'client' | 'provider' | 'admin' | null;
  loading: boolean;
  backendAvailable: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  login: async () => false,
  logout: () => {},
  isLoggedIn: false,
  role: null,
  loading: false,
  backendAvailable: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [backendAvailable, setBackendAvailable] = useState(true);

  // 初始化时检查 localStorage 中是否有 token，并向后端恢复用户会话
  useEffect(() => {
    const savedToken = getToken();
    if (!savedToken) return;
    setBackendAvailable(true);
    // 修复：刷新页面后凭 token 调 /api/auth/me 恢复登录态，避免"刷新即登出"
    authApi.me()
      .then((me) => {
        setUser(me);
        setBackendAvailable(true);
      })
      .catch((err: any) => {
        // token 失效（过期/用户不存在/后端未启动）→ 清除本地登录态
        if (err?.status === 401) {
          clearToken();
        }
        // 生产环境按未登录处理（不留本地会话），开发环境保留以便演示恢复
        if (import.meta.env.PROD) {
          clearToken();
        }
        setBackendAvailable(false);
      });
  }, []);

  const login = async (username: string, password: string, role: 'client' | 'provider' | 'admin'): Promise<boolean> => {
    setLoading(true);
    try {
      // 优先调用后端 API（FastAPI 后端校验密码）
      const result = await authApi.login(username, role, password);
      // result 包含 user 字段 + token
      storeToken(result.token);
      const { token: _t, ...userData } = result as any;
      setUser(userData);
      setBackendAvailable(true);
      setLoading(false);
      return true;
    } catch (err: any) {
      // 仅当后端返回明确的鉴权/校验失败（401 密码错 / 422 缺密码）时
      // 视为"真实登录失败"，抛出让页面展示具体错误信息。
      // 其余情况（网络错误 status=0、Vite 代理 500 等）视为后端不可用；
      // 生产环境一律如实失败（不再降级本地 Mock 账号校验），仅开发环境降级。
      const authFailed = err?.status === 401 || err?.status === 422;
      if (authFailed) {
        setBackendAvailable(true);
        setLoading(false);
        throw err;
      }
      if (import.meta.env.PROD) {
        setBackendAvailable(false);
        setLoading(false);
        throw err;
      }
      console.warn('⚠️ 后端 API 不可用，使用本地 Mock 数据');
      setBackendAvailable(false);

      let found: User | undefined;
      if (role === 'client') found = mockClients.find(u => u.username === username) as User;
      else if (role === 'provider') found = mockProviders.find(u => u.username === username) as User;
      else found = mockAdmins.find(u => u.username === username) as User;

      if (found) {
        setUser(found);
        setLoading(false);
        return true;
      }
      setLoading(false);
      return false;
    }
  };

  const logout = () => {
    clearToken();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user, login, logout,
      isLoggedIn: !!user,
      role: user?.role || null,
      loading,
      backendAvailable,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
