import type {
  Client, ServiceProvider, Admin, ServiceCategory,
  Order, Review, Transaction, Notification, AdminStats, FinancialSummary
} from '../types';

// ==================== 用户数据 ====================
export const mockClients: Client[] = [
  { id: 'c1', username: 'zhangsan', name: '张三', phone: '13800138001', avatar: '', role: 'client', createdAt: '2025-01-15', address: '北京市朝阳区建国路88号', totalOrders: 13, totalSpent: 5680 },
  { id: 'c2', username: 'lisi', name: '李四', phone: '13800138002', avatar: '', role: 'client', createdAt: '2025-02-20', address: '北京市海淀区中关村大街5号', totalOrders: 8, totalSpent: 3120 },
  { id: 'c3', username: 'wangwu', name: '王五', phone: '13800138003', avatar: '', role: 'client', createdAt: '2025-03-10', address: '北京市西城区金融街1号', totalOrders: 3, totalSpent: 1280 },
];

export const mockProviders: ServiceProvider[] = [
  {
    id: 'p1', username: 'liujie', name: '刘姐', phone: '13900139001', avatar: '', role: 'provider', createdAt: '2024-06-01',
    age: 42, gender: 'female', idCard: '110101198201011234', experience: 8,
    skills: [
      { id: 'sk1', name: '深度保洁', level: 'senior' },
      { id: 'sk2', name: '家电清洗', level: 'intermediate' },
      { id: 'sk3', name: '油烟机清洗', level: 'senior' },
    ],
    certificationStatus: 'verified', status: 'online', rating: 4.8, completedOrders: 356, balance: 5800,
    serviceArea: ['海淀区', '朝阳区', '西城区'], introduction: '从事家政服务8年，经验丰富，客户好评如潮。擅长深度清洁、家电清洗等专业服务。持有高级家政服务员证书和健康证。',
    idCardFront: '', idCardBack: '', healthCert: '', skillCert: '',
  },
  {
    id: 'p2', username: 'wangyi', name: '王姨', phone: '13900139002', avatar: '', role: 'provider', createdAt: '2024-08-15',
    age: 48, gender: 'female', idCard: '110101197601012345', experience: 12,
    skills: [
      { id: 'sk4', name: '日常保洁', level: 'senior' },
      { id: 'sk5', name: '老人陪护', level: 'senior' },
      { id: 'sk6', name: '做饭', level: 'intermediate' },
    ],
    certificationStatus: 'verified', status: 'online', rating: 4.9, completedOrders: 589, balance: 9200,
    serviceArea: ['东城区', '西城区', '朝阳区'], introduction: '12年家政工作经验，持有高级家政服务员、养老护理员双证。性格温和有耐心，特别擅长与老人沟通相处。',
    idCardFront: '', idCardBack: '', healthCert: '', skillCert: '',
  },
  {
    id: 'p3', username: 'xiaoli', name: '小李', phone: '13900139003', avatar: '', role: 'provider', createdAt: '2025-01-10',
    age: 28, gender: 'male', idCard: '110101199601013456', experience: 3,
    skills: [
      { id: 'sk7', name: '家电维修', level: 'intermediate' },
      { id: 'sk8', name: '水管维修', level: 'junior' },
      { id: 'sk9', name: '家具组装', level: 'intermediate' },
    ],
    certificationStatus: 'pending', status: 'offline', rating: 4.5, completedOrders: 89, balance: 2200,
    serviceArea: ['朝阳区', '通州区', '大兴区'], introduction: '年轻力壮，手脚麻利。擅长家电维修和家具组装，服务态度好。',
    idCardFront: '', idCardBack: '', healthCert: '', skillCert: '',
  },
  {
    id: 'p4', username: 'chenjie', name: '陈姐', phone: '13900139004', avatar: '', role: 'provider', createdAt: '2024-11-20',
    age: 38, gender: 'female', idCard: '110101198501014567', experience: 6,
    skills: [
      { id: 'sk10', name: '深度保洁', level: 'intermediate' },
      { id: 'sk11', name: '除螨服务', level: 'senior' },
      { id: 'sk12', name: '收纳整理', level: 'senior' },
    ],
    certificationStatus: 'verified', status: 'online', rating: 4.7, completedOrders: 234, balance: 4100,
    serviceArea: ['海淀区', '朝阳区', '丰台区'], introduction: '专业收纳整理师，持有日本收纳协会认证。提供深度保洁和除螨服务，让您的家焕然一新。',
    idCardFront: '', idCardBack: '', healthCert: '', skillCert: '',
  },
];

export const mockAdmins: Admin[] = [
  { id: 'a1', username: 'admin', name: '系统管理员', phone: '13700137001', avatar: '', role: 'admin', createdAt: '2024-01-01', department: '运营部', permissions: ['all'] },
  { id: 'a2', username: 'finance', name: '财务管理员', phone: '13700137002', avatar: '', role: 'admin', createdAt: '2024-01-01', department: '财务部', permissions: ['finance', 'orders'] },
];

// ==================== 服务分类 ====================
export const mockServiceCategories: ServiceCategory[] = [
  {
    id: 'sc1', name: '日常保洁', icon: 'Sparkles', description: '专业日常保洁服务，让家时刻保持整洁', image: '',
    subcategories: [
      { id: 'ssc1', name: '普通日常保洁', description: '100平米以内基础清洁', price: 180, estimatedDuration: 3, image: '' },
      { id: 'ssc2', name: '厨房专项清洁', description: '厨房油污深度处理', price: 120, estimatedDuration: 2, image: '' },
      { id: 'ssc3', name: '卫生间专项清洁', description: '卫生间除垢消毒', price: 100, estimatedDuration: 2, image: '' },
    ],
  },
  {
    id: 'sc2', name: '深度清洁', icon: 'Sparkles', description: '全屋深度清洁、装修后清洁', image: '',
    subcategories: [
      { id: 'ssc4', name: '全屋深度清洁', description: '100平米以内深度清洁', price: 480, estimatedDuration: 6, image: '' },
      { id: 'ssc5', name: '装修后开荒', description: '新房装修后精细清洁', price: 1200, estimatedDuration: 12, image: '' },
      { id: 'ssc6', name: '租房退租清洁', description: '退租前精细还原', price: 600, estimatedDuration: 8, image: '' },
    ],
  },
  {
    id: 'sc3', name: '家电清洗', icon: 'Refrigerator', description: '空调、油烟机、洗衣机等家电清洗', image: '',
    subcategories: [
      { id: 'ssc7', name: '空调清洗', description: '挂机/柜机深度清洗', price: 80, estimatedDuration: 1, image: '' },
      { id: 'ssc8', name: '油烟机清洗', description: '免拆洗深度处理', price: 150, estimatedDuration: 2, image: '' },
      { id: 'ssc9', name: '洗衣机清洗', description: '滚筒/波轮拆洗', price: 120, estimatedDuration: 1.5, image: '' },
      { id: 'ssc10', name: '冰箱清洗', description: '断电除霜深度清洁', price: 80, estimatedDuration: 1, image: '' },
    ],
  },
  {
    id: 'sc4', name: '家居保养', icon: 'Sofa', description: '地板打蜡、皮具保养等', image: '',
    subcategories: [
      { id: 'ssc11', name: '地板打蜡', description: '实木地板养护', price: 200, estimatedDuration: 3, image: '' },
      { id: 'ssc12', name: '皮具保养', description: '沙发皮具护理', price: 150, estimatedDuration: 2, image: '' },
      { id: 'ssc13', name: '地毯清洗', description: '专业设备清洗', price: 180, estimatedDuration: 2, image: '' },
      { id: 'ssc14', name: '除螨服务', description: '床垫、沙发专业除螨杀菌', price: 80, estimatedDuration: 1.5, image: '' },
    ],
  },
  {
    id: 'sc5', name: '收纳整理', icon: 'Package', description: '专业收纳、搬家整理', image: '',
    subcategories: [
      { id: 'ssc15', name: '衣柜整理', description: '换季衣物分类收纳', price: 200, estimatedDuration: 3, image: '' },
      { id: 'ssc16', name: '厨房整理', description: '厨房用品分区摆放', price: 180, estimatedDuration: 2, image: '' },
      { id: 'ssc17', name: '搬家整理', description: '打包还原一站式', price: 800, estimatedDuration: 10, image: '' },
    ],
  },
  {
    id: 'sc6', name: '专项服务', icon: 'Heart', description: '月嫂、养老护理等', image: '',
    subcategories: [
      { id: 'ssc18', name: '月嫂服务', description: '新生儿专业护理', price: 12000, estimatedDuration: 1, image: '' },
      { id: 'ssc19', name: '养老护理', description: '老人专业陪护', price: 300, estimatedDuration: 1, image: '' },
      { id: 'ssc20', name: '医院陪诊', description: '就医陪同服务', price: 200, estimatedDuration: 4, image: '' },
      { id: 'ssc21', name: '家庭厨师', description: '上门做菜服务', price: 300, estimatedDuration: 4, image: '' },
    ],
  },
];

// ==================== 订单数据 ====================
export const mockOrders: Order[] = [
  {
    id: 'o1', orderNo: 'HK20250721001', clientId: 'c1', providerId: 'p1', clientName: '张三', clientPhone: '13800138001',
    clientAddress: '北京市朝阳区建国路88号', serviceCategory: '日常保洁', serviceName: '普通日常保洁',
    servicePrice: 180, totalHours: 3, totalAmount: 180, status: 'completed', paymentStatus: 'paid',
    scheduledDate: '2025-07-21', scheduledTime: '09:00-12:00', deadlineTime: '',
    specialRequirements: '', rating: 5, review: '非常专业，态度认真。家里焕然一新！', reviewImages: [],
    createdAt: '2025-07-21 09:00', updatedAt: '2025-07-21 12:00', providerName: '刘姐',
  },
  {
    id: 'o2', orderNo: 'HK20250722002', clientId: 'c1', providerId: 'p2', clientName: '张三', clientPhone: '13800138001',
    clientAddress: '北京市朝阳区建国路88号', serviceCategory: '深度清洁', serviceName: '全屋深度清洁',
    servicePrice: 480, totalHours: 6, totalAmount: 480, status: 'completed', paymentStatus: 'paid',
    scheduledDate: '2025-07-22', scheduledTime: '09:00-15:00', deadlineTime: '',
    specialRequirements: '', rating: 5, review: '王姨很用心，每个角落都打扫到了。', reviewImages: [],
    createdAt: '2025-07-22 09:00', updatedAt: '2025-07-22 15:00', providerName: '王姨',
  },
  {
    id: 'o3', orderNo: 'HK20250723003', clientId: 'c2', providerId: 'p1', clientName: '李四', clientPhone: '13800138002',
    clientAddress: '北京市海淀区中关村大街5号', serviceCategory: '家电清洗', serviceName: '空调清洗+油烟机清洗',
    servicePrice: 230, totalHours: 3, totalAmount: 230, status: 'completed', paymentStatus: 'paid',
    scheduledDate: '2025-07-23', scheduledTime: '10:00-13:00', deadlineTime: '',
    specialRequirements: '', rating: 4, review: '准时到达，手艺不错。', reviewImages: [],
    createdAt: '2025-07-23 10:00', updatedAt: '2025-07-23 13:00', providerName: '刘姐',
  },
  {
    id: 'o4', orderNo: 'HK20250724004', clientId: 'c1', clientName: '张三', clientPhone: '13800138001',
    clientAddress: '北京市朝阳区建国路88号', serviceCategory: '收纳整理', serviceName: '衣柜整理',
    servicePrice: 200, totalHours: 3, totalAmount: 200, status: 'accepted', paymentStatus: 'paid',
    scheduledDate: '2025-07-25', scheduledTime: '14:00-17:00', deadlineTime: '',
    specialRequirements: '', rating: 0, review: '', reviewImages: [],
    createdAt: '2025-07-24 11:00', updatedAt: '2025-07-24 11:30', providerName: '陈姐',
  },
  {
    id: 'o5', orderNo: 'HK20250725005', clientId: 'c3', providerId: 'p1', clientName: '王五', clientPhone: '13800138003',
    clientAddress: '北京市西城区金融街1号', serviceCategory: '专项服务', serviceName: '家庭厨师',
    servicePrice: 300, totalHours: 4, totalAmount: 300, status: 'completed', paymentStatus: 'unpaid',
    scheduledDate: '2025-07-26', scheduledTime: '18:00-22:00', deadlineTime: '',
    specialRequirements: '想做川菜，4个人', rating: 0, review: '', reviewImages: [],
    createdAt: '2025-07-25 16:00', updatedAt: '2025-07-29 12:09', providerName: '刘姐',
  },
  {
    id: 'o6', orderNo: 'HK20250720006', clientId: 'c2', providerId: 'p4', clientName: '李四', clientPhone: '13800138002',
    clientAddress: '北京市海淀区中关村大街5号', serviceCategory: '家居保养', serviceName: '地板打蜡',
    servicePrice: 200, totalHours: 3, totalAmount: 200, status: 'completed', paymentStatus: 'paid',
    scheduledDate: '2025-07-20', scheduledTime: '09:00-12:00', deadlineTime: '',
    specialRequirements: '', rating: 5, review: '地板打蜡后光亮如新。', reviewImages: [],
    createdAt: '2025-07-20 09:00', updatedAt: '2025-07-20 12:00', providerName: '陈姐',
  },
  {
    id: 'o7', orderNo: 'HK20250719007', clientId: 'c3', providerId: 'p2', clientName: '王五', clientPhone: '13800138003',
    clientAddress: '北京市西城区金融街1号', serviceCategory: '专项服务', serviceName: '老人陪护',
    servicePrice: 300, totalHours: 1, totalAmount: 300, status: 'completed', paymentStatus: 'paid',
    scheduledDate: '2025-07-19', scheduledTime: '08:00-09:00', deadlineTime: '',
    specialRequirements: '', rating: 5, review: '王姨很专业，老人很喜欢。', reviewImages: [],
    createdAt: '2025-07-19 08:00', updatedAt: '2025-07-19 09:00', providerName: '王姨',
  },
  {
    id: 'o8', orderNo: 'HK20250718008', clientId: 'c1', clientName: '张三', clientPhone: '13800138001',
    clientAddress: '北京市朝阳区建国路88号', serviceCategory: '家电清洗', serviceName: '洗衣机清洗',
    servicePrice: 120, totalHours: 1.5, totalAmount: 120, status: 'in_progress', paymentStatus: 'paid',
    scheduledDate: '2025-07-25', scheduledTime: '15:00-16:30', deadlineTime: '',
    specialRequirements: '', rating: 0, review: '', reviewImages: [],
    createdAt: '2025-07-25 14:00', updatedAt: '2025-07-25 15:00', providerName: '小李',
  },
  {
    id: 'o9', orderNo: 'HK20250715009', clientId: 'c2', providerId: 'p1', clientName: '李四', clientPhone: '13800138002',
    clientAddress: '北京市海淀区中关村大街5号', serviceCategory: '日常保洁', serviceName: '厨房专项清洁',
    servicePrice: 120, totalHours: 2, totalAmount: 120, status: 'cancelled', paymentStatus: 'refunded',
    scheduledDate: '2025-07-16', scheduledTime: '10:00-12:00', deadlineTime: '',
    specialRequirements: '临时有事取消', rating: 0, review: '', reviewImages: [],
    createdAt: '2025-07-15 10:00', updatedAt: '2025-07-15 18:00', providerName: '刘姐',
  },
];

// ==================== 评价数据 ====================
export const mockReviews: Review[] = [
  { id: 'r1', orderId: 'o1', clientId: 'c1', clientName: '张三', clientAvatar: '', providerId: 'p1', providerName: '刘姐', rating: 5, content: '非常专业，态度认真。家里焕然一新！', images: [], createdAt: '2025-07-21 12:30', serviceName: '普通日常保洁' },
  { id: 'r2', orderId: 'o2', clientId: 'c1', clientName: '张三', clientAvatar: '', providerId: 'p2', providerName: '王姨', rating: 5, content: '王姨很用心，每个角落都打扫到了。', images: [], createdAt: '2025-07-22 15:30', serviceName: '全屋深度清洁' },
  { id: 'r3', orderId: 'o3', clientId: 'c2', clientName: '李四', clientAvatar: '', providerId: 'p1', providerName: '刘姐', rating: 4, content: '准时到达，手艺不错。', images: [], createdAt: '2025-07-23 13:30', serviceName: '空调清洗+油烟机清洗' },
  { id: 'r4', orderId: 'o6', clientId: 'c2', clientName: '李四', clientAvatar: '', providerId: 'p4', providerName: '陈姐', rating: 5, content: '地板打蜡后光亮如新。', images: [], createdAt: '2025-07-20 12:30', serviceName: '地板打蜡' },
];

// ==================== 交易数据 ====================
export const mockTransactions: Transaction[] = [
  { id: 't1', orderId: 'o1', orderNo: 'HK20250721001', type: 'income', amount: 180, status: 'completed', description: '订单收入-普通日常保洁', createdAt: '2025-07-21 12:00' },
  { id: 't2', orderId: 'o2', orderNo: 'HK20250722002', type: 'income', amount: 480, status: 'completed', description: '订单收入-全屋深度清洁', createdAt: '2025-07-22 15:00' },
  { id: 't3', orderId: 'o3', orderNo: 'HK20250723003', type: 'income', amount: 230, status: 'completed', description: '订单收入-空调清洗+油烟机清洗', createdAt: '2025-07-23 13:00' },
  { id: 't4', orderId: 'o6', orderNo: 'HK20250720006', type: 'income', amount: 200, status: 'completed', description: '订单收入-地板打蜡', createdAt: '2025-07-20 12:00' },
  { id: 't5', orderId: 'o7', orderNo: 'HK20250719007', type: 'income', amount: 300, status: 'completed', description: '订单收入-老人陪护', createdAt: '2025-07-19 09:00' },
  { id: 't6', orderId: '', orderNo: '', type: 'withdraw', amount: -2000, status: 'completed', description: '月度提现-刘姐', createdAt: '2025-07-15 10:00' },
  { id: 't7', orderId: '', orderNo: '', type: 'withdraw', amount: -1500, status: 'pending', description: '提现申请处理中-王姨', createdAt: '2025-07-25 14:00' },
  { id: 't8', orderId: 'o9', orderNo: 'HK20250715009', type: 'refund', amount: -120, status: 'completed', description: '订单退款-取消', createdAt: '2025-07-15 18:00' },
  { id: 't9', orderId: '', orderNo: '', type: 'commission', amount: -25, status: 'completed', description: '平台佣金', createdAt: '2025-07-21 12:00' },
];

// ==================== 通知数据 ====================
export const mockNotifications: Notification[] = [
  { id: 'n1', userId: 'c1', title: '订单完成通知', content: '您的订单 HK20250721001 已完成，欢迎评价', type: 'order', read: true, createdAt: '2025-07-21 12:30' },
  { id: 'n2', userId: 'c1', title: '家政人员已接单', content: '刘姐已接受您的订单 HK20250722002', type: 'order', read: false, createdAt: '2025-07-22 08:30' },
  { id: 'n3', userId: 'c1', title: '优惠活动通知', content: '夏季深度清洁8折优惠，限时7天', type: 'promotion', read: false, createdAt: '2025-07-20 10:00' },
  { id: 'n4', userId: 'p1', title: '新订单提醒', content: '您有一个新的订单待处理', type: 'order', read: false, createdAt: '2025-07-24 11:00' },
  { id: 'n5', userId: 'p2', title: '收入到账通知', content: '您有一笔收入 480元 已到账', type: 'system', read: true, createdAt: '2025-07-22 15:00' },
  { id: 'n6', userId: 'p3', title: '认证进度更新', content: '您的资质认证材料已提交，请耐心等待审核。', type: 'certification', read: true, createdAt: '2025-07-24 16:00' },
  { id: 'n7', userId: 'a1', title: '新注册审核', content: '有1名新的家政人员等待资质审核。', type: 'system', read: false, createdAt: '2025-07-25 09:00' },
];

// ==================== 后台统计数据 ====================
export const mockAdminStats: AdminStats = {
  totalUsers: 12580,
  totalProviders: 368,
  totalOrders: 15680,
  totalRevenue: 1256800,
  monthlyActiveUsers: 3280,
  averageRating: 4.7,
  newUsersToday: 28,
  pendingCertifications: 12,
  pendingRefunds: 3,
  orderTrend: [
    { date: '2025-01', count: 980, revenue: 78400 },
    { date: '2025-02', count: 1050, revenue: 84000 },
    { date: '2025-03', count: 1200, revenue: 96000 },
    { date: '2025-04', count: 1380, revenue: 110400 },
    { date: '2025-05', count: 1520, revenue: 121600 },
    { date: '2025-06', count: 1680, revenue: 134400 },
    { date: '2025-07', count: 890, revenue: 71200 },
  ],
  userGrowth: [
    { month: '2025-01', users: 8200, providers: 200 },
    { month: '2025-02', users: 9100, providers: 230 },
    { month: '2025-03', users: 10200, providers: 265 },
    { month: '2025-04', users: 11100, providers: 290 },
    { month: '2025-05', users: 11800, providers: 320 },
    { month: '2025-06', users: 12580, providers: 368 },
  ],
  serviceDistribution: [
    { name: '日常保洁', count: 5200, percentage: 33.2 },
    { name: '家电清洗', count: 3200, percentage: 20.4 },
    { name: '家居保养', count: 2100, percentage: 13.4 },
    { name: '深度清洁', count: 1800, percentage: 11.5 },
    { name: '专项服务', count: 1500, percentage: 9.6 },
    { name: '收纳整理', count: 1880, percentage: 12.0 },
  ],
};

// ==================== 财务统计 ====================
export const mockFinancialSummary: FinancialSummary = {
  totalRevenue: 1256800,
  monthlyRevenue: 134400,
  pendingPayout: 3800,
  completedOrders: 15680,
  averageOrderValue: 80.12,
  commissionRate: 15,
  revenueByMonth: [
    { month: '2025-01', revenue: 78400, orders: 980 },
    { month: '2025-02', revenue: 84000, orders: 1050 },
    { month: '2025-03', revenue: 96000, orders: 1200 },
    { month: '2025-04', revenue: 110400, orders: 1380 },
    { month: '2025-05', revenue: 121600, orders: 1520 },
    { month: '2025-06', revenue: 134400, orders: 1680 },
  ],
  revenueByCategory: [
    { category: '日常保洁', revenue: 416000, percentage: 33.1 },
    { category: '家电清洗', revenue: 256000, percentage: 20.4 },
    { category: '家居保养', revenue: 168000, percentage: 13.4 },
    { category: '深度清洁', revenue: 144000, percentage: 11.5 },
    { category: '收纳整理', revenue: 150000, percentage: 11.9 },
    { category: '专项服务', revenue: 124800, percentage: 9.9 },
  ],
};

// ==================== 辅助函数 ====================
export function getStatusBadge(status: string): string {
  const map: Record<string, string> = {
    pending: 'badge-pending', accepted: 'badge-processing', in_progress: 'badge-processing',
    completed: 'badge-completed', cancelled: 'badge-cancelled', refunding: 'badge-pending',
    unpaid: 'badge-pending', paid: 'badge-completed',
  };
  return map[status] || 'badge-pending';
}

export function getStatusText(status: string): string {
  const map: Record<string, string> = {
    pending: '待处理', accepted: '已确认', in_progress: '服务中',
    completed: '已完成', cancelled: '已取消', refunding: '退款中',
    unpaid: '未支付', paid: '已支付', refunded: '已退款',
    online: '在线', offline: '离线', busy: '忙碌中',
    unsubmitted: '未提交', verified: '已认证', rejected: '驳回',
  };
  return map[status] || status;
}

