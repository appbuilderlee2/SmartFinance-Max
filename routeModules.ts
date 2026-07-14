export const routeModules = {
  welcome: () => import('./pages/Welcome'),
  dashboard: () => import('./pages/Dashboard'),
  addTransaction: () => import('./pages/AddTransaction'),
  calendar: () => import('./pages/Calendar'),
  records: () => import('./pages/Records'),
  settings: () => import('./pages/Settings'),
  transactionDetail: () => import('./pages/TransactionDetail'),
  transactionView: () => import('./pages/TransactionView'),
  categoryManager: () => import('./pages/CategoryManager'),
  budgetSettings: () => import('./pages/BudgetSettings'),
  subscriptions: () => import('./pages/Subscriptions'),
  notificationSettings: () => import('./pages/NotificationSettings'),
  creditCardManager: () => import('./pages/CreditCardManager'),
  creditCardCycles: () => import('./pages/CreditCardCycles'),
  addSubscription: () => import('./pages/AddSubscription'),
  reports: () => import('./pages/Reports'),
  creditCard2: () => import('./pages/CreditCard2'),
  creditCard2Match: () => import('./pages/CreditCard2Match'),
  creditCard2SwipeWhich: () => import('./pages/CreditCard2SwipeWhich'),
} as const;

export const navRoutePreloads: Record<string, () => Promise<unknown>> = {
  '/add': routeModules.addTransaction,
  '/calendar': routeModules.calendar,
  '/': routeModules.dashboard,
  '/records': routeModules.records,
  '/settings': routeModules.settings,
};
