import { useEffect, useMemo, useState } from 'react';

const isEnabled = () => {
  try {
    return localStorage.getItem('sf_theme_debug') === '1';
  } catch {
    return false;
  }
};

export default function ThemeDebugBadge() {
  const [enabled, setEnabled] = useState(isEnabled);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const onStorage = () => setEnabled(isEnabled());
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 250);
    return () => window.clearInterval(id);
  }, [enabled]);

  const data = useMemo(() => {
    if (!enabled) return null;
    const root = document.documentElement;
    const theme =
      root.dataset.sfTheme ||
      Array.from(root.classList).find((c) => c.startsWith('theme-'))?.replace(/^theme-/, '') ||
      '(none)';
    const css = getComputedStyle(root);
    return {
      theme,
      appBg: css.getPropertyValue('--sf-app-bg').trim(),
      surfaceAlpha: css.getPropertyValue('--sf-surface-alpha').trim(),
      blurMd: css.getPropertyValue('--sf-blur-md').trim(),
      shadowMd: css.getPropertyValue('--sf-shadow-md').trim(),
      gray200: css.getPropertyValue('--sf-gray-200').trim(),
    };
  }, [enabled, tick]);

  if (!enabled || !data) return null;

  return (
    <div className="fixed top-2 right-2 z-[9999] sf-card px-3 py-2 text-[11px] leading-4">
      <div className="font-semibold text-white">theme: {data.theme}</div>
      <div className="text-gray-200">--sf-app-bg: {data.appBg}</div>
      <div className="text-gray-200">--sf-surface-alpha: {data.surfaceAlpha}</div>
      <div className="text-gray-200">--sf-blur-md: {data.blurMd}</div>
      <div className="text-gray-200">--sf-shadow-md: {data.shadowMd}</div>
      <div className="text-gray-200">--sf-gray-200: {data.gray200}</div>
    </div>
  );
}
