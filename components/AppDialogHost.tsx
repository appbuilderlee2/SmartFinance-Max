import React, { FormEvent, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { getActiveAppDialog, resolveAppDialog, subscribeAppDialog } from '../utils/appDialog';

const AppDialogHost: React.FC = () => {
  const dialog = useSyncExternalStore(subscribeAppDialog, getActiveAppDialog);
  const dialogRef = useRef<HTMLElement>(null);
  const [value, setValue] = useState('');
  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    if (dialog?.type !== 'prompt') { setValue(''); setValidationError(''); return; }
    setValue(dialog.defaultValue);
    setValidationError('');
  }, [dialog?.id]);

  useEffect(() => {
    if (!dialog) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        resolveAppDialog(dialog.type === 'alert' ? undefined : dialog.type === 'confirm' ? false : null);
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = [...(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled])') || [])];
      if (!focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [dialog?.id]);

  if (!dialog) return null;
  const titleId = `app-dialog-title-${dialog.id}`;
  const messageId = `app-dialog-message-${dialog.id}`;
  const submitPrompt = (event: FormEvent) => {
    event.preventDefault();
    if (dialog.type !== 'prompt') return;
    const error = dialog.validate?.(value) || '';
    if (error) { setValidationError(error); return; }
    resolveAppDialog(value);
  };

  return <div className="fixed inset-0 z-[220] flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }} data-testid="app-dialog-backdrop">
    <section key={dialog.id} ref={dialogRef} role={dialog.type === 'alert' || dialog.type === 'confirm' ? 'alertdialog' : 'dialog'} aria-modal="true" aria-labelledby={titleId} aria-describedby={messageId} className="sf-panel w-full max-w-md rounded-3xl border border-white/10 p-5 shadow-2xl sm:p-6">
      <h2 id={titleId} className="text-lg font-semibold text-white">{dialog.title}</h2>
      <p id={messageId} className="mt-2 whitespace-pre-line text-sm leading-6 text-gray-300">{dialog.message}</p>
      {dialog.type === 'prompt' ? <form onSubmit={submitPrompt} className="mt-4 space-y-3">
        <input autoFocus type={dialog.inputType} inputMode={dialog.inputMode} maxLength={dialog.maxLength} placeholder={dialog.placeholder} aria-label={dialog.title} value={value} onChange={event => { setValue(event.target.value); setValidationError(''); }} className="sf-field w-full" />
        {validationError && <p role="alert" className="text-sm text-red-300">{validationError}</p>}
        <div className="grid grid-cols-2 gap-3">
          <button type="button" className="sf-control rounded-xl px-4 py-3 text-sm" onClick={() => resolveAppDialog(null)}>{dialog.cancelLabel}</button>
          <button type="submit" className="sf-primary-button rounded-xl px-4 py-3 text-sm">{dialog.confirmLabel}</button>
        </div>
      </form> : dialog.type === 'choice' ? <div className="mt-5 grid gap-2">
        {dialog.choices.map((choice, index) => <button autoFocus={index === 0} key={choice.value} type="button" className={`rounded-xl px-4 py-3 text-sm font-semibold ${choice.destructive ? 'bg-red-500/15 text-red-300' : 'sf-control text-gray-100'}`} onClick={() => resolveAppDialog(choice.value)}>{choice.label}</button>)}
        <button type="button" className="sf-control rounded-xl px-4 py-3 text-sm" onClick={() => resolveAppDialog(null)}>{dialog.cancelLabel}</button>
      </div> : <div className={`mt-5 grid ${dialog.type === 'confirm' ? 'grid-cols-2' : 'grid-cols-1'} gap-3`}>
        {dialog.type === 'confirm' && <button autoFocus type="button" className="sf-control rounded-xl px-4 py-3 text-sm" onClick={() => resolveAppDialog(false)}>{dialog.cancelLabel}</button>}
        <button autoFocus type="button" className={`${dialog.type === 'confirm' && dialog.destructive ? 'bg-red-600' : 'sf-primary-button'} rounded-xl px-4 py-3 text-sm font-semibold text-white`} onClick={() => resolveAppDialog(dialog.type === 'confirm' ? true : undefined)}>{dialog.type === 'alert' ? '好' : dialog.type === 'confirm' ? dialog.confirmLabel : '關閉'}</button>
      </div>}
    </section>
  </div>;
};

export default AppDialogHost;
