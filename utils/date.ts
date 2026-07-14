// utils/date.ts

/**
 * Convert a Date (or date-like) to a local YYYY-MM-DD string.
 * This avoids UTC offset issues when using toISOString().
 */
export function toLocalYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Convert a local YYYY-MM-DD into a stable stored ISO string representing local midnight.
 *
 * We store as: new Date(y, m-1, d).toISOString()
 * This makes persistence consistent, while display should always convert back to local.
 */
export function localYMDToStoredISOString(ymd: string): string | null {
  const dt = parseLocalYMD(ymd);
  if (!dt) return null;
  return dt.toISOString();
}

/**
 * Parse a local YYYY-MM-DD string into a Date at local midnight.
 *
 * Important: DO NOT use `new Date('YYYY-MM-DD')` because JS treats it as UTC and
 * may shift the day when displayed in local timezones.
 */
export function parseLocalYMD(ymd: string): Date | null {
  if (typeof ymd !== 'string') return null;
  const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(ymd);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(y, mo - 1, d);
  return isNaN(dt.getTime()) ? null : dt;
}

/** Parse various stored date formats into a Date. */
export function parseDate(value: unknown): Date | null {
  if (value instanceof Date && !isNaN(value.getTime())) return value;
  if (typeof value === 'string') {
    // If it's a plain date (YYYY-MM-DD), parse as local midnight to avoid day shifts.
    const local = parseLocalYMD(value);
    if (local) return local;

    const dt = new Date(value);
    if (!isNaN(dt.getTime())) return dt;
  }
  if (typeof value === 'number') {
    const dt = new Date(value);
    if (!isNaN(dt.getTime())) return dt;
  }
  return null;
}

export function isSameMonth(d: Date, month: number, year: number): boolean {
  return d.getMonth() === month && d.getFullYear() === year;
}
