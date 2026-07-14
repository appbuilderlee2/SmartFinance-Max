// utils/storage.ts
// Safe localStorage helpers to prevent hard crashes when JSON is corrupted

export type ParseResult<T> = {
  ok: true;
  value: T;
} | {
  ok: false;
  error: unknown;
};

export const STORAGE_ERROR_EVENT = 'sf-storage-error';

export function reportStorageError(key: string, error: unknown): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(STORAGE_ERROR_EVENT, {
    detail: { key, message: error instanceof Error ? error.message : 'Storage write failed' },
  }));
}

export function safeJsonParse<T>(raw: string): ParseResult<T> {
  try {
    return { ok: true, value: JSON.parse(raw) as T };
  } catch (error) {
    return { ok: false, error };
  }
}

export function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = safeJsonParse<T>(raw);
    return parsed.ok ? parsed.value : null;
  } catch {
    return null;
  }
}

export function writeJson(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    reportStorageError(key, error);
    return false;
  }
}

export function writeText(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    reportStorageError(key, error);
    return false;
  }
}

export function removeKey(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}
