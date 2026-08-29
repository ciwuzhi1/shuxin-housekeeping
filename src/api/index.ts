/**
 * 舒心家政 - API 服务层
 * 所有与后端的 HTTP 通信通过此模块处理
 */
import type {
  ServiceCategory, Order, Review, Transaction,
  Notification, AdminStats, FinancialSummary, User, ServiceProvider
} from '../types';

const API_BASE = '/api';

// ==================== Token 管理 ====================
const TOKEN_KEY = 'housekeeping_token';

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

// ==================== 请求基础库 ====================
type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: any;
  params?: Record<string, string>;
};

class ApiError extends Error {
  code: string;
  status: number;

  constructor(message: string, code: string = 'UNKNOWN', status: number = 500) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

/**
 * 后端已统一返回 camelCase 数据，前端无需再次转换。
 * 失败时抛出 ApiError，让调用方统一 catch 处理。
 */
async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, params } = options;
  let url = API_BASE + endpoint;
  if (params) {
    const searchParams = new URLSearchParams(params);
    url += '?' + searchParams.toString();
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) {
    headers['Authorization'] = 'Bearer ' + token;
  }

  const fetchOptions: RequestInit = { method, headers };
  if (body) fetchOptions.body = JSON.stringify(body);

  let res: Response;
  try {
    res = await fetch(url, fetchOptions);
  } catch (e) {
    throw new ApiError('网络连接失败，请检查后端服务是否启动', 'NETWORK_ERROR', 0);
  }

  let json: any;
  try {
    json = await res.json();
  } catch {
    throw new ApiError('服务器响应格式异常', 'PARSE_ERROR', res.status);
  }

  if (!res.ok || json.success === false) {
    throw new ApiError(
      json.message || '请求失败 (' + res.status + ')',
      json.code || 'REQUEST_FAILED',
      res.status
    );
  }

  return json.data as T;
}

// ==================== 认证 ====================
// FastAPI 后端已启用密码校验：登录必须携带 password（SHA-256 哈希比对）。
export const authApi = {
  login: (username: string, role: string, password: string) =>
    request<{ token: string } & User>('/auth/login', { method: 'POST', body: { username, role, password } }),
  // 刷新页面后凭 token 恢复登录态
  me: () => request<User>('/auth/me'),
};

// ==================== 服务分类 ====================
export const categoryApi = {
  getAll: () => request<ServiceCategory[]>('/categories'),
};

// ==================== 服务人员 ====================
export const providerApi = {
  getAll: (params?: Record<string, string>) => request<ServiceProvider[]>('/providers', { params }),
  verify: (id: string) => request<any>('/providers/' + id + '/verify', { method: 'PUT' }),
  reject: (id: string, reason?: string) =>
    request<any>('/providers/' + id + '/reject', { method: 'PUT', body: { reason } }),
};

// ==================== 订单 ====================
export const orderApi = {
  getAll: (params?: Record<string, string>) => request<Order[]>('/orders', { params }),
  create: (data: any) => request<{ id: string; orderNo: string }>('/orders', { method: 'POST', body: data }),
  updateStatus: (id: string, data: any) =>
    request<any>('/orders/' + id + '/status', { method: 'PUT', body: data }),
  review: (id: string, rating: number, content: string) =>
    request<any>('/orders/' + id + '/review', { method: 'POST', body: { rating, content } }),
};

// ==================== 评价 ====================
export const reviewApi = {
  getAll: (params?: Record<string, string>) => request<Review[]>('/reviews', { params }),
};

// ==================== 通知 ====================
export const notificationApi = {
  getAll: (params?: Record<string, string>) => request<Notification[]>('/notifications', { params }),
  markRead: (id: string) => request<any>('/notifications/' + id + '/read', { method: 'PUT' }),
  markAllRead: (userId?: string) =>
    request<any>('/notifications/read-all', { method: 'PUT', params: userId ? { userId } : undefined }),
};

// ==================== 财务 ====================
export const financeApi = {
  getSummary: () => request<FinancialSummary>('/finance/summary'),
  getTransactions: (params?: Record<string, string>) => request<Transaction[]>('/finance/transactions', { params }),
};

// ==================== 管理后台 ====================
export const adminApi = {
  getStats: () => request<AdminStats>('/admin/stats'),
  getUsers: (params?: Record<string, string>) => request<User[]>('/admin/users', { params }),
};

// ==================== 家政人员端数据 ====================
export const providerDataApi = {
  getOrders: (providerId: string) => request<Order[]>('/provider/' + providerId + '/orders'),
  getEarnings: (providerId: string) => request<any>('/provider/' + providerId + '/earnings'),
};

// ==================== 用户端数据 ====================
export const clientDataApi = {
  getStats: (clientId: string) => request<{ totalOrders: number; completedOrders: number; totalSpent: number }>('/client/' + clientId + '/stats'),
};

