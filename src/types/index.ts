// ==================== 核心类型定义 ====================
// 前后端字段命名契约：服务端数据库使用 snake_case（如 client_id），
// 经 backend/app/database.py 的 to_camel 转换后以 camelCase 返回，
// 本文件全部使用 camelCase，与服务端返回结构一一对应。
// 注意：skills / serviceArea / reviewImages / images 等字段由服务端
// 从 JSON 文本自动反序列化为数组，请勿按字符串处理。

export type UserRole = 'client' | 'provider' | 'admin';

export type OrderStatus = 'pending' | 'accepted' | 'in_progress' | 'completed' | 'cancelled' | 'refunding';
export type PaymentStatus = 'unpaid' | 'paid' | 'refunding' | 'refunded';
export type CertificationStatus = 'unsubmitted' | 'pending' | 'verified' | 'rejected';
export type ProviderStatus = 'online' | 'offline' | 'busy';

// ==================== 用户 ====================
export interface User {
  id: string;
  username: string;
  name: string;
  phone: string;
  avatar: string;
  role: UserRole;
  createdAt: string;
}

export interface Client extends User {
  role: 'client';
  address: string;
  totalOrders: number;
  totalSpent: number;
}

export interface ServiceProvider extends User {
  role: 'provider';
  age: number;
  gender: 'male' | 'female';
  idCard: string;
  experience: number; // years
  skills: ServiceSkill[];
  certificationStatus: CertificationStatus;
  status: ProviderStatus;
  rating: number;
  completedOrders: number;
  balance: number;
  serviceArea: string[];
  introduction: string;
  idCardFront?: string;
  idCardBack?: string;
  healthCert?: string;
  skillCert?: string;
}

export interface Admin extends User {
  role: 'admin';
  department: string;
  permissions: string[];
}

// ==================== 服务分类 ====================
export interface ServiceCategory {
  id: string;
  name: string;
  icon: string;
  description: string;
  image: string;
  subcategories: ServiceSubCategory[];
}

export interface ServiceSubCategory {
  id: string;
  name: string;
  description: string;
  price: number; // per hour
  estimatedDuration: number; // hours
  image: string;
}

export interface ServiceSkill {
  id: string;
  name: string;
  level: 'junior' | 'intermediate' | 'senior';
}

// ==================== 订单 ====================
export interface Order {
  id: string;
  orderNo: string;
  clientId: string;
  providerId?: string;
  clientName: string;
  clientPhone: string;
  clientAddress: string;
  serviceCategory: string;
  serviceName: string;
  servicePrice: number;
  totalHours: number;
  totalAmount: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  scheduledDate: string;
  scheduledTime: string;
  deadlineTime?: string;
  specialRequirements?: string;
  rating?: number;
  review?: string;
  reviewImages?: string[];
  createdAt: string;
  updatedAt: string;
  providerName?: string;
}

// ==================== 评价 ====================
export interface Review {
  id: string;
  orderId: string;
  clientId: string;
  clientName: string;
  clientAvatar: string;
  providerId: string;
  providerName: string;
  rating: number;
  content: string;
  images: string[];
  createdAt: string;
  serviceName: string;
}

// ==================== 交易 ====================
export interface Transaction {
  id: string;
  orderId: string;
  orderNo: string;
  type: 'income' | 'payment' | 'withdraw' | 'refund' | 'commission';
  amount: number;
  status: 'completed' | 'pending' | 'failed';
  description: string;
  createdAt: string;
}

// ==================== 财务管理 ====================
export interface FinancialSummary {
  totalRevenue: number;
  monthlyRevenue: number;
  pendingPayout: number;
  completedOrders: number;
  averageOrderValue: number;
  commissionRate: number;
  revenueByMonth: { month: string; revenue: number; orders: number }[];
  revenueByCategory: { category: string; revenue: number; percentage: number }[];
}

// ==================== 系统通知 ====================
export interface Notification {
  id: string;
  userId: string;
  title: string;
  content: string;
  type: 'order' | 'system' | 'promotion' | 'certification';
  read: boolean;
  createdAt: string;
}

// ==================== 后台统计数据 ====================
export interface AdminStats {
  totalUsers: number;
  totalProviders: number;
  totalOrders: number;
  totalRevenue: number;
  monthlyActiveUsers: number;
  averageRating: number;
  newUsersToday: number;
  pendingCertifications: number;
  pendingRefunds: number;
  orderTrend: { date: string; count: number; revenue: number }[];
  userGrowth: { month: string; users: number; providers: number }[];
  serviceDistribution: { name: string; count: number; percentage: number }[];
}
