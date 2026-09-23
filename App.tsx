import React, { Suspense, lazy, useEffect, useState, useSyncExternalStore } from 'react';
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
const CreditCardCenter = lazy(routeModules.creditCardCenter);
const CreditCardCycles = lazy(routeModules.creditCardCycles);
const AddSubscriptionPage = lazy(routeModules.addSubscription);
const TagManager = lazy(() => import('./pages/TagManager'));
const Reports = lazy(routeModules.reports);
const CreditCard2 = lazy(routeModules.creditCard2);
const CreditCard2Match = lazy(routeModules.creditCard2Match);
const CreditCard2SwipeWhich = lazy(routeModules.creditCard2SwipeWhich);

// Layout
import Layout from './components/Layout';
import { hasOnboarded } from './utils/firstRun';
import { STORAGE_ERROR_EVENT, subscribeStorage, getSaveStatus, retryStorage, flushStorage, getStaleTab, subscribeStaleTab } from './utils/storage';
import SecurityGate from './components/SecurityGate';
import AppDialogHost from './components/AppDialogHost';
import { showAppConfirm } from './utils/appDialog';

const Loading: React.FC = () => <div className="p-4 text-gray-400">載入中…</div>;


const StorageStatus = () => {
  const saveStatus = useSyncExternalStore(subscribeStorage, getSaveStatus);
  const stale = useSyncExternalStore(subscribeStaleTab, getStaleTab);
  return (<div role="status" aria-live="polite" className={saveStatus === 'saved' ? 'sr-only' : 'fixed bottom-20 right-3 z-[60] rounded-lg bg-background border sf-divider px-2 py-1 text-xs'}>
          {saveStatus === 'saving' ? '儲存中…' : saveStatus === 'error' ? '尚未儲存' : '已儲存'}
          {saveStatus === 'error' && !stale && <button className="ml-2 text-primary" onClick={() => void retryStorage()}>重試</button>}
        </div>);
};

const App: React.FC = () => {
  const stale = useSyncExternalStore(subscribeStaleTab, getStaleTab);
  const [swUpdate, setSwUpdate] = useState<ServiceWorkerRegistration | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [networkNotice, setNetworkNotice] = useState<'offline' | 'restored' | null>(
    typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : null,
  );


  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => { if (getSaveStatus() !== 'saved') { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, []);

  useEffect(() => subscribeStorage(() => {
    if (getSaveStatus() === 'saved') setStorageError(false);
  }), []);

  useEffect(() => {
    const onStorageError = () => setStorageError(true);
    window.addEventListener(STORAGE_ERROR_EVENT, onStorageError);
    return () => window.removeEventListener(STORAGE_ERROR_EVENT, onStorageError);
  }, []);

  useEffect(() => {
    let restoredTimer: number | undefined;
    const onOffline = () => {
      if (restoredTimer) window.clearTimeout(restoredTimer);
      setNetworkNotice('offline');
    };
    const onOnline = () => {
      setNetworkNotice('restored');
      void navigator.serviceWorker?.getRegistration().then((registration) => {
        registration?.active?.postMessage({ type: 'REFRESH_CACHE' });
        return registration?.update();
      }).catch(() => undefined);
      restoredTimer = window.setTimeout(() => setNetworkNotice(null), 4000);
    };
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
      if (restoredTimer) window.clearTimeout(restoredTimer);
    };
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
    const onControllerChange = async () => {
      try { await flushStorage(); } catch { setStorageError(true); return; }
      if (refreshing) return;
      setRefreshing(true);
      window.location.reload();
    };
    navigator.serviceWorker?.addEventListener('controllerchange', onControllerChange);
    return () => navigator.serviceWorker?.removeEventListener('controllerchange', onControllerChange);
  }, [swUpdate, refreshing]);

  const handleReload = async () => {
    try { await flushStorage(); } catch { setStorageError(true); return; }
    if (!swUpdate) return;
    if (swUpdate.waiting) {
      swUpdate.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  };

  return (
    <DataProvider>
      <SecurityGate>
      <Router>
        {stale && <div role="alertdialog" aria-modal="true" aria-label="另一分頁有更新" className="fixed inset-0 z-[110] flex items-center justify-center bg-black/75 px-5">
          <div className="sf-panel max-w-sm rounded-2xl p-6 text-gray-100 shadow-2xl space-y-4">
            <h2 className="text-lg font-semibold">另一分頁已更新資料</h2>
            <p className="text-sm text-gray-300">此分頁嘅帳目可能已過期。重新載入後會取得最新資料；未儲存嘅修改可能會消失，記帳草稿會保留。</p>
            <button className="w-full rounded-xl bg-primary px-4 py-3 font-semibold text-white" onClick={() => void (async () => {
              if (getSaveStatus() !== 'saved' && !await showAppConfirm('此分頁可能有未儲存修改，重新載入後會取得最新資料。', { title: '重新載入？', confirmLabel: '重新載入', destructive: true })) return;
              window.location.reload();
            })()}>重新載入最新資料</button>
          </div>
        </div>}
        {networkNotice && (
          <div
            role="status"
            aria-live="polite"
            className={`fixed left-1/2 -translate-x-1/2 z-[90] w-[calc(100%-2rem)] max-w-sm rounded-xl border px-4 py-3 shadow-lg text-sm font-medium text-center ${
              networkNotice === 'offline'
                ? 'bg-amber-950 border-amber-500 text-amber-100'
                : 'bg-emerald-950 border-emerald-500 text-emerald-100'
            }`}
            style={{ top: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
          >
            {networkNotice === 'offline' ? '離線模式' : '網絡已恢復'}
          </div>
        )}
        {swUpdate && (
          <div role="status" aria-live="polite" className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[80] sf-panel border border-primary/40 rounded-xl px-4 py-3 flex items-center gap-3 shadow-lg">
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
        <StorageStatus />
        <AppDialogHost />
        <Routes>
          <Route path="/settings/tags" element={<Suspense fallback={<Loading />}><Layout hideNav><TagManager /></Layout></Suspense>} />
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
            path="/cards/*"
            element={<Suspense fallback={<Layout><Loading /></Layout>}><Layout><CreditCardCenter /></Layout></Suspense>}
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
      </SecurityGate>
    </DataProvider>
  );
};

export default App;
