export interface User {
  id: string;
  username: string;
  displayName: string;
  role: 'admin' | 'member';
  appearance: Record<string, unknown> | null;
}

export type AuthMode = 'login' | 'register' | 'reset';

declare global {
  interface Window {
    EntryIntro?: { prepareFrom(image: HTMLImageElement | null): void };
  }
}

export interface Credentials {
  username: string;
  password: string;
}
export interface Registration extends Credentials {
  invite: string;
  displayName: string;
  confirmPassword: string;
}

// TypeScript does not validate the HTTP boundary.
export function readUser(value: unknown): User {
  if (!value || typeof value !== 'object') throw new Error('伺服器回傳的帳號資料格式不正確');
  const user = value as Record<string, unknown>;
  if (
    typeof user.id !== 'string' ||
    typeof user.username !== 'string' ||
    typeof user.displayName !== 'string' ||
    !['admin', 'member'].includes(String(user.role)) ||
    !(
      user.appearance === null ||
      (user.appearance && typeof user.appearance === 'object' && !Array.isArray(user.appearance))
    )
  ) {
    throw new Error('伺服器回傳的帳號資料格式不正確');
  }
  return user as unknown as User;
}
