import { LocalNotifications } from '@capacitor/local-notifications';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../contexts/DataContext';
import { observeLocalDay } from '../utils/dayBoundary';
import { iosNotificationRoute, syncIosReminders } from '../utils/iosReminders';
import { getSaveStatus, subscribeStorage } from '../utils/storage';

export default function IosReminders() {
  const { creditCards, subscriptions, budgets, categories, currency } = useData();
  const navigate = useNavigate();

  useEffect(() => {
    const listener = LocalNotifications.addListener('localNotificationActionPerformed', ({ actionId, notification }) => {
      const path = iosNotificationRoute(actionId, notification.extra?.path);
      if (path) navigate(path);
    });
    void listener.catch(() => undefined);
    return () => { void listener.then(handle => handle.remove()).catch(() => undefined); };
  }, [navigate]);

  useEffect(() => {
    let timer: number;
    let day: string;
    const refresh = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void syncIosReminders({ creditCards, subscriptions, budgets, categories, currency }).catch(() => undefined);
      }, 150);
    };
    const unsubscribe = subscribeStorage(() => { if (getSaveStatus() === 'saved') refresh(); });
    const stopDayObserver = observeLocalDay(next => {
      if (day !== next) { day = next; refresh(); }
    });
    const onVisible = () => { if (!document.hidden) refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      unsubscribe();
      stopDayObserver();
      document.removeEventListener('visibilitychange', onVisible);
      window.clearTimeout(timer);
    };
  }, [creditCards, subscriptions, budgets, categories, currency]);

  return null;
}
