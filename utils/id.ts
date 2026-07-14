// utils/id.ts

/**
 * Generate stable unique IDs for persisted entities.
 * - Prefer crypto.randomUUID when available.
 * - Fallback to time+random string.
 */
export function makeId(prefix = ''): string {
  try {
    const uuid = (globalThis.crypto as Crypto | undefined)?.randomUUID?.();
    if (uuid) return prefix ? `${prefix}_${uuid}` : uuid;
  } catch {
    // ignore
  }

  const rand = Math.random().toString(36).slice(2);
  const time = Date.now().toString(36);
  const id = `${time}_${rand}`;
  return prefix ? `${prefix}_${id}` : id;
}
