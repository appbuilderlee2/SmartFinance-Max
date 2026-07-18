import React, { useEffect, useState } from 'react';
import { LockKeyhole } from 'lucide-react';
import { loadSecuritySettings, verifyPin, type SecuritySettings } from '../utils/security';

const SecurityGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<SecuritySettings>(() => loadSecuritySettings());
  const [locked, setLocked] = useState(() => loadSecuritySettings().lockEnabled);
  const [covered, setCovered] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const onSettings = (event: Event) => {
      const next = (event as CustomEvent<SecuritySettings>).detail;
      setSettings(next);
      if (!next.lockEnabled) setLocked(false);
    };
    window.addEventListener('sf-security-change', onSettings);
    return () => window.removeEventListener('sf-security-change', onSettings);
  }, []);

  useEffect(() => {
    let hiddenAt = 0;
    const onVisibility = () => {
      if (document.hidden) {
        hiddenAt = Date.now();
        if (settings.hideInAppSwitcher) setCovered(true);
        return;
      }
      setCovered(false);
      if (!settings.lockEnabled || !hiddenAt) return;
      const elapsed = Date.now() - hiddenAt;
      if (settings.autoLockMinutes === 0 || elapsed >= settings.autoLockMinutes * 60_000) setLocked(true);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [settings]);

  const unlock = async (event: React.FormEvent) => {
    event.preventDefault();
    setChecking(true);
    const valid = await verifyPin(pin, settings).catch(() => false);
    setChecking(false);
    if (!valid) { setError('PIN 不正確'); setPin(''); return; }
    setError(''); setPin(''); setLocked(false);
  };

  return <>
    {children}
    {covered ? <div className="fixed inset-0 z-[200] bg-slate-950 flex items-center justify-center"><div className="text-center"><LockKeyhole className="mx-auto mb-3" /><div className="font-semibold">SmartFinance 已隱藏</div></div></div> : null}
    {locked && settings.lockEnabled ? (
      <div className="fixed inset-0 z-[190] bg-slate-950 flex items-center justify-center p-6 pt-safe-top">
        <form onSubmit={unlock} className="w-full max-w-sm text-center space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-primary/20 text-primary flex items-center justify-center mx-auto"><LockKeyhole size={30} /></div>
          <div><h1 className="text-xl font-bold">SmartFinance 已鎖定</h1><p className="text-sm text-gray-400 mt-1">輸入 PIN 解鎖本機財務資料</p></div>
          <input autoFocus aria-label="解鎖 PIN" type="password" inputMode="numeric" pattern="[0-9]*" maxLength={8} value={pin} onChange={event => setPin(event.target.value.replace(/\D/g, ''))} className="w-full sf-control rounded-xl p-4 text-center tracking-[0.5em] text-xl" />
          {error ? <p role="alert" className="text-red-400 text-sm">{error}</p> : null}
          <button disabled={pin.length < 4 || checking} className="w-full rounded-xl bg-primary text-white p-4 font-semibold disabled:opacity-40">{checking ? '驗證中…' : '解鎖'}</button>
        </form>
      </div>
    ) : null}
  </>;
};

export default SecurityGate;
