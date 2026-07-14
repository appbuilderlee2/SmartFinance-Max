import { Category, TransactionType, Transaction, Budget, Subscription } from './types';

export const CATEGORIES: Category[] = [
  { id: '1', name: '餐飲', icon: 'Utensils', color: 'bg-blue-500', type: TransactionType.EXPENSE },
  { id: '2', name: '交通', icon: 'Car', color: 'bg-indigo-500', type: TransactionType.EXPENSE },
  { id: '3', name: '娛樂', icon: 'Film', color: 'bg-purple-500', type: TransactionType.EXPENSE },
  { id: '4', name: '購物', icon: 'ShoppingBag', color: 'bg-pink-500', type: TransactionType.EXPENSE },
  { id: '5', name: '住宿', icon: 'Home', color: 'bg-orange-500', type: TransactionType.EXPENSE },
  { id: '6', name: '醫療', icon: 'Stethoscope', color: 'bg-red-500', type: TransactionType.EXPENSE },
  { id: '7', name: '工作', icon: 'Briefcase', color: 'bg-emerald-500', type: TransactionType.INCOME },
];

export const MOCK_TRANSACTIONS: Transaction[] = [
  { id: 't1', amount: 1250, date: '2024-05-15T18:30:00', note: '午餐與同事聚餐', categoryId: '1', type: TransactionType.EXPENSE, tags: ['公司聚餐', '報銷'] },
  { id: 't2', amount: 3500, date: '2024-05-14T08:00:00', note: '加油', categoryId: '2', type: TransactionType.EXPENSE },
  { id: 't3', amount: 390, date: '2024-05-12T20:00:00', note: 'Netflix', categoryId: '3', type: TransactionType.EXPENSE, isRecurring: true },
  { id: 't4', amount: 42000, date: '2024-05-01T09:00:00', note: '五月薪資', categoryId: '7', type: TransactionType.INCOME },
  { id: 't5', amount: 1500, date: '2024-05-18T19:00:00', note: '超市採買', categoryId: '4', type: TransactionType.EXPENSE, tags: ['生活用品'] },
];

export const MOCK_BUDGETS: Budget[] = [
  { categoryId: '1', limit: 8000, spent: 4500 }, // Dining
  { categoryId: '2', limit: 8000, spent: 3500 }, // Transport
  { categoryId: '4', limit: 9000, spent: 2500 }, // Shopping
];

export const MOCK_SUBSCRIPTIONS: Subscription[] = [
  { id: 's1', name: 'Netflix Premium', amount: 390, billingCycle: 'Monthly', nextBillingDate: '2024-07-15' },
  { id: 's2', name: 'YouTube Premium Family', amount: 269, billingCycle: 'Monthly', nextBillingDate: '2024-07-05' },
  { id: 's3', name: 'Spotify Premium', amount: 149, billingCycle: 'Monthly', nextBillingDate: '2024-07-20' },
];