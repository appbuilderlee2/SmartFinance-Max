import React, { Suspense, lazy, useEffect, useState } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { DataProvider } from './contexts/DataContext';
import { routeModules } from './routeModules';

const Welcome = lazy(routeModules.welcome);
const Dashboard = lazy(routeModules.dashboard);
const AddTransaction = lazy(routeModules.addTransaction);
const Calendar = lazy(routeModules.calendar);
const Records = lazy(routeModules.records);
const Settings = lazy(routeModules.settings);
const TransactionDetail = lazy(routeModules.transactionDetail);
const TransactionView = lazy(routeModules.transactionView);
const CategoryManager = lazy(routeModules.categoryManager);
const BudgetSettings = lazy(routeModules.budgetSettings);
const Subscriptions = lazy(routeModules.subscriptions);
const NotificationSettings = lazy(routeModules.notificationSettings);
const CreditCardManager = lazy(routeModules.creditCardManager);
const CreditCardCycles = lazy(routeModules.creditCardCycles);
const AddSubscriptionPage = lazy(routeModules.addSubscription);
const Reports = lazy(routeModules.reports);
const CreditCard2 = lazy(routeModules.creditCard2);
const CreditCard2Match = lazy(routeModules.creditCard2Match);
const CreditCard2SwipeWhich = lazy(routeModules.creditCard2SwipeWhich);

// Layout
import Layout from './components/Layout';
import { hasOnboarded } from './utils/firstRun';
import { STORAGE_ERROR_EVENT } from './utils/storage';

const Loading: React.FC = () => <div className="p-4 text-gray-400">載入中…</div>;


const App: React.FC = () => {
  const [swUpdate, setSwUpdate] = useState<ServiceWorkerRegistration | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [storageError, setStorageError] = useState(false);


  useEffect(() => {
    const onStorageError = () => setStorageError(true);
    window.addEventListener(STORAGE_ERROR_EVENT, onStorageError);
    return () => window.removeEventListener(STORAGE_ERROR_EVENT, onStorageError);
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ registration: ServiceWorkerRegistration }>).detail;
      if (detail?.registration) {
        setSwUpdate(detail.registration);
      }
    };
    window.addEventListener('sf-sw-update', handler as EventListener);
    return () => window.removeEventListener('sf-sw-update', handler as EventListener);
  }, []);


  useEffect(() => {
    if (!swUpdate || refreshing) return;
    const onControllerChange = () => {
      if (refreshing) return;
      setRefreshing(true);
      window.location.reload();
    };
    navigator.serviceWorker?.addEventListener('controllerchange', onControllerChange);
    return () => navigator.serviceWorker?.removeEventListener('controllerchange', onControllerChange);
  }, [swUpdate, refreshing]);

  const handleReload = () => {
    if (!swUpdate) return;
    if (swUpdate.waiting) {
      swUpdate.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  };

  return (
    <DataProvider>
      <Router>
        {swUpdate && (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[60] sf-panel px-4 py-3 flex items-center gap-3">
            <span className="text-sm text-gray-200">有新版本可用</span>
            <button
              type="button"
              onClick={handleReload}
              className="text-sm text-primary font-semibold"
            >
              重新載入
            </button>
          </div>
        )}
        {storageError && (
          <div role="alert" className="fixed top-safe-top left-1/2 -translate-x-1/2 z-[70] mt-3 w-[calc(100%-2rem)] max-w-md bg-red-950 border border-red-500 rounded-xl px-4 py-3 shadow-lg">
            <div className="flex items-start justify-between gap-3">
              <span className="text-sm text-red-100">資料未能儲存。請立即匯出備份，並檢查瀏覽器儲存空間。</span>
              <button type="button" onClick={() => setStorageError(false)} className="text-red-200" aria-label="關閉儲存錯誤提示">×</button>
            </div>
          </div>
        )}
        <Routes>
          {/* Public but local-only: keep Welcome as landing (1B) */}
          <Route path="/welcome" element={<Suspense fallback={<Loading />}><Welcome /></Suspense>} />

          {/* App routes (no login required) */}
          <Route path="/" element={<Suspense fallback={<Layout><Loading /></Layout>}><Layout><Dashboard /></Layout></Suspense>} />

          <Route
            path="/records"
            element={
              <Suspense fallback={<Layout><Loading /></Layout>}>
                <Layout><Records /></Layout>
              </Suspense>
            }
          />
          <Route
            path="/calendar"
            element={
              <Suspense fallback={<Layout><Loading /></Layout>}>
                <Layout><Calendar /></Layout>
              </Suspense>
            }
          />
          <Route
            path="/view/:id"
            element={
              <Suspense fallback={<Layout hideNav><Loading /></Layout>}>
                <Layout hideNav><TransactionView /></Layout>
              </Suspense>
            }
          />
          <Route
            path="/add"
            element={
              <Suspense fallback={<Layout hideNav><Loading /></Layout>}>
                <Layout hideNav><AddTransaction /></Layout>
              </Suspense>
            }
          />
          <Route
            path="/edit/:id"
            element={
              <Suspense fallback={<Layout hideNav><Loading /></Layout>}>
                <Layout hideNav><TransactionDetail /></Layout>
              </Suspense>
            }
          />
          <Route
            path="/categories"
            element={
              <Suspense fallback={<Layout hideNav><Loading /></Layout>}>
                <Layout hideNav><CategoryManager /></Layout>
              </Suspense>
            }
          />
          <Route
            path="/budget"
            element={
              <Suspense fallback={<Layout hideNav><Loading /></Layout>}>
                <Layout hideNav><BudgetSettings /></Layout>
              </Suspense>
            }
          />
          <Route
            path="/settings"
            element={
              <Suspense fallback={<Layout><Loading /></Layout>}>
                <Layout><Settings /></Layout>
              </Suspense>
            }
          />
          <Route
            path="/settings/notifications"
            element={
              <Suspense fallback={<Layout hideNav><Loading /></Layout>}>
                <Layout hideNav><NotificationSettings /></Layout>
              </Suspense>
            }
          />
          <Route
            path="/settings/creditcards"
            element={
              <Suspense fallback={<Layout hideNav><Loading /></Layout>}>
                <Layout hideNav><CreditCardManager /></Layout>
              </Suspense>
            }
          />
          <Route
            path="/settings/creditcard-cycles"
            element={
              <Suspense fallback={<Layout hideNav><Loading /></Layout>}>
                <Layout hideNav><CreditCardCycles /></Layout>
              </Suspense>
            }
          />

          <Route
            path="/settings/creditcards2"
            element={
              <Suspense fallback={<Layout hideNav><Loading /></Layout>}>
                <Layout hideNav><CreditCard2 /></Layout>
              </Suspense>
            }
          />
          <Route
            path="/settings/creditcards2/match"
            element={
              <Suspense fallback={<Layout hideNav><Loading /></Layout>}>
                <Layout hideNav><CreditCard2Match /></Layout>
              </Suspense>
            }
          />
          <Route
            path="/settings/creditcards2/a"
            element={
              <Suspense fallback={<Layout hideNav><Loading /></Layout>}>
                <Layout hideNav><CreditCard2SwipeWhich /></Layout>
              </Suspense>
            }
          />

          <Route
            path="/reports"
            element={
              <Suspense fallback={<Layout><Loading /></Layout>}>
                <Layout><Reports /></Layout>
              </Suspense>
            }
          />

          <Route
            path="/subscriptions"
            element={
              <Suspense fallback={<Layout hideNav><Loading /></Layout>}>
                <Layout hideNav><Subscriptions /></Layout>
              </Suspense>
            }
          />
          <Route
            path="/add-subscription"
            element={
              <Suspense fallback={<Layout hideNav><Loading /></Layout>}>
                <Layout hideNav><AddSubscriptionPage /></Layout>
              </Suspense>
            }
          />
          <Route
            path="/subscriptions/:id/edit"
            element={
              <Suspense fallback={<Layout hideNav><Loading /></Layout>}>
                <Layout hideNav><AddSubscriptionPage /></Layout>
              </Suspense>
            }
          />

          {/* Default route: first-time users to Welcome; otherwise go to Dashboard */}
          <Route path="*" element={<Navigate to={hasOnboarded() ? "/" : "/welcome"} />} />
        </Routes>
      </Router>
    </DataProvider>
  );
};

export default App;
