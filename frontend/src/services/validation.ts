export function record(value: unknown, message = '伺服器資料格式不正確'): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(message);
  return value as Record<string, unknown>;
}
export function array(value: unknown, message = '伺服器清單格式不正確'): unknown[] {
  if (!Array.isArray(value)) throw new Error(message);
  return value;
}
export const text = (value: unknown, fallback = ''): string => typeof value === 'string' ? value : fallback;
export const number = (value: unknown, fallback = 0): number => typeof value === 'number' && Number.isFinite(value) ? value : fallback;
export const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter((x): x is string => typeof x === 'string') : [];
