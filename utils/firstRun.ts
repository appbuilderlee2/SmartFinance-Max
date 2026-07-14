// utils/firstRun.ts

const KEY = 'smartfinance_has_onboarded';

export function hasOnboarded(): boolean {
  try {
    return localStorage.getItem(KEY) === 'true';
  } catch {
    return false;
  }
}

export function setOnboarded(): void {
  try {
    localStorage.setItem(KEY, 'true');
  } catch {
    // ignore
  }
}
