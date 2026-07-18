import { readJson, writeJson } from './storage';

export type SecuritySettings = {
  lockEnabled: boolean;
  pinSalt: string;
  pinHash: string;
  autoLockMinutes: 0 | 1 | 5 | 15 | 30;
  privacyMode: boolean;
  hideInAppSwitcher: boolean;
};

export const DEFAULT_SECURITY_SETTINGS: SecuritySettings = {
  lockEnabled: false, pinSalt: '', pinHash: '', autoLockMinutes: 5,
  privacyMode: false, hideInAppSwitcher: true,
};

let cached: SecuritySettings | null = null;

export function loadSecuritySettings(): SecuritySettings {
  if (cached) return cached;
  const saved = readJson<Partial<SecuritySettings>>('sf_security_v1');
  cached = { ...DEFAULT_SECURITY_SETTINGS, ...(saved || {}) };
  if (!cached.pinHash) cached.lockEnabled = false;
  return cached;
}

export function saveSecuritySettings(settings: SecuritySettings): void {
  cached = settings;
  writeJson('sf_security_v1', settings);
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('sf-security-change', { detail: settings }));
}

const bytesToBase64 = (bytes: Uint8Array) => {
  let value = '';
  bytes.forEach(byte => { value += String.fromCharCode(byte); });
  return btoa(value);
};

const base64ToBytes = (value: string) => Uint8Array.from(atob(value), character => character.charCodeAt(0));

async function derivePin(pin: string, salt: Uint8Array): Promise<string> {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations: 120_000 }, material, 256);
  return bytesToBase64(new Uint8Array(bits));
}

export async function createPinSecurity(pin: string, current = loadSecuritySettings()): Promise<SecuritySettings> {
  if (!/^\d{4,8}$/.test(pin)) throw new Error('PIN 必須為 4 至 8 位數字');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const next = { ...current, lockEnabled: true, pinSalt: bytesToBase64(salt), pinHash: await derivePin(pin, salt) };
  saveSecuritySettings(next);
  return next;
}

export async function verifyPin(pin: string, settings = loadSecuritySettings()): Promise<boolean> {
  if (!settings.pinHash || !settings.pinSalt) return false;
  const candidate = await derivePin(pin, base64ToBytes(settings.pinSalt));
  if (candidate.length !== settings.pinHash.length) return false;
  let different = 0;
  for (let index = 0; index < candidate.length; index += 1) different |= candidate.charCodeAt(index) ^ settings.pinHash.charCodeAt(index);
  return different === 0;
}

export function disablePinSecurity(): SecuritySettings {
  const next = { ...loadSecuritySettings(), lockEnabled: false, pinSalt: '', pinHash: '' };
  saveSecuritySettings(next);
  return next;
}

export function resetSecurityCache(): void {
  cached = { ...DEFAULT_SECURITY_SETTINGS };
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('sf-security-change', { detail: cached }));
}
