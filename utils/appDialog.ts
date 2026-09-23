export type AppDialogChoice = { label: string; value: string; destructive?: boolean };
export type AppPromptOptions = {
  title?: string;
  defaultValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  inputType?: 'text' | 'password';
  inputMode?: 'text' | 'numeric' | 'decimal';
  maxLength?: number;
  validate?: (value: string) => string | null;
};

type BaseDialog = { id: number; title: string; message: string };
export type AppDialogRequest =
  | (BaseDialog & { type: 'alert'; resolve: (value: void) => void })
  | (BaseDialog & { type: 'confirm'; confirmLabel: string; cancelLabel: string; destructive?: boolean; resolve: (value: boolean) => void })
  | (BaseDialog & { type: 'prompt'; defaultValue: string; placeholder: string; confirmLabel: string; cancelLabel: string; inputType: 'text' | 'password'; inputMode: 'text' | 'numeric' | 'decimal'; maxLength?: number; validate?: (value: string) => string | null; resolve: (value: string | null) => void })
  | (BaseDialog & { type: 'choice'; choices: AppDialogChoice[]; cancelLabel: string; resolve: (value: string | null) => void });

let nextId = 0;
let active: AppDialogRequest | null = null;
const pending: AppDialogRequest[] = [];
const listeners = new Set<() => void>();

export function subscribeAppDialog(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getActiveAppDialog(): AppDialogRequest | null { return active; }

function publish(): void { listeners.forEach(listener => listener()); }

function enqueue<T extends AppDialogRequest>(make: (id: number, resolve: (value: any) => void) => T): Promise<Parameters<T['resolve']>[0]> {
  return new Promise(resolve => {
    const item = make(++nextId, resolve);
    if (active) pending.push(item);
    else active = item;
    publish();
  });
}

export function resolveAppDialog(value: void | boolean | string | null): void {
  const current = active;
  if (!current) return;
  (current.resolve as (result: typeof value) => void)(value);
  active = pending.shift() || null;
  publish();
}

export function showAppAlert(message: string, title = '提示'): Promise<void> {
  return enqueue((id, resolve) => ({ id, type: 'alert', title, message, resolve }));
}

export function showAppConfirm(message: string, options: { title?: string; confirmLabel?: string; cancelLabel?: string; destructive?: boolean } = {}): Promise<boolean> {
  return enqueue((id, resolve) => ({
    id, type: 'confirm', title: options.title || '請確認', message,
    confirmLabel: options.confirmLabel || '確認', cancelLabel: options.cancelLabel || '取消',
    destructive: options.destructive, resolve,
  }));
}

export function showAppPrompt(message: string, options: AppPromptOptions = {}): Promise<string | null> {
  return enqueue((id, resolve) => ({
    id, type: 'prompt', title: options.title || '輸入資料', message,
    defaultValue: options.defaultValue || '', placeholder: options.placeholder || '',
    confirmLabel: options.confirmLabel || '確認', cancelLabel: options.cancelLabel || '取消',
    inputType: options.inputType || 'text', inputMode: options.inputMode || 'text',
    maxLength: options.maxLength, validate: options.validate, resolve,
  }));
}

export function showAppChoice(message: string, choices: AppDialogChoice[], title = '選擇操作', cancelLabel = '取消'): Promise<string | null> {
  return enqueue((id, resolve) => ({ id, type: 'choice', title, message, choices, cancelLabel, resolve }));
}
