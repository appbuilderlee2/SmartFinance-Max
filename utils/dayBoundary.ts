import { toLocalYMD } from './date';

export function observeLocalDay(onDay: (day: string) => void): () => void {
  const refresh = () => onDay(toLocalYMD(new Date()));
  const timer = window.setInterval(refresh, 30_000);
  window.addEventListener('focus', refresh);
  document.addEventListener('visibilitychange', refresh);
  refresh();
  return () => {
    window.clearInterval(timer);
    window.removeEventListener('focus', refresh);
    document.removeEventListener('visibilitychange', refresh);
  };
}
