// utils/storageVersion.ts

const KEY = 'smartfinance_schema_version';
const CURRENT = 1;

export function getSchemaVersion(): number {
  try {
    const raw = localStorage.getItem(KEY);
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

export function setSchemaVersion(v: number): void {
  try {
    localStorage.setItem(KEY, String(v));
  } catch {
    // ignore
  }
}

export function ensureSchemaVersion(): void {
  const v = getSchemaVersion();
  if (v < CURRENT) setSchemaVersion(CURRENT);
}

export const SCHEMA_VERSION = CURRENT;
