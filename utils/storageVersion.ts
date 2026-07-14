// utils/storageVersion.ts

const KEY = 'smartfinance_schema_version';
const CURRENT = 2;

type Migration = () => void;

const migrations: Record<number, Migration> = {
  // Legacy installs had no schema marker.
  0: () => undefined,
  // v2 makes credit-card cycles an explicit, always-present collection so
  // backup/reset/migration code can treat it like every other data entity.
  1: () => {
    const key = 'smartfinance_creditcard_cycles';
    const raw = localStorage.getItem(key);
    if (raw === null) {
      localStorage.setItem(key, '[]');
      return;
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) throw new Error('Invalid credit-card cycle data');
  },
};

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
  let version = getSchemaVersion();
  while (version < CURRENT) {
    const migrate = migrations[version];
    if (!migrate) throw new Error(`Missing storage migration ${version} -> ${version + 1}`);
    migrate();
    version += 1;
    // Only advance after a successful migration. A failed migration therefore
    // remains retryable and never claims that old data is current.
    setSchemaVersion(version);
  }
}

export const SCHEMA_VERSION = CURRENT;
