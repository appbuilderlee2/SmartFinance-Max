// utils/storage.ts
// Safe localStorage helpers to prevent hard crashes when JSON is corrupted

export type ParseResult<T> = {
  ok: true;
  value: T;
} | {
  ok: false;
  error: unknown;
};

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

export function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota / privacy mode errors
  }
}

export function removeKey(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}
