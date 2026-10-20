import { record, text } from './validation';
import { ApiError } from './http';
import type { useRequests } from '../composables/requests';

function submissionId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// Preserve the existing idempotency key across uncertain GitHub outcomes.
export async function submitIssue(request: ReturnType<typeof useRequests>['request'], data: unknown, key: string): Promise<boolean> {
  const id = sessionStorage.getItem(key) || submissionId();
  sessionStorage.setItem(key, id);
  let response: unknown;
  try { response = await request('/api/community/issues', { ...record(data), submissionId: id }); }
  catch (error) {
    if (error instanceof ApiError && error.payload && typeof error.payload === 'object' && (error.payload as Record<string, unknown>).state === 'failed') sessionStorage.removeItem(key);
    throw error;
  }
  const result = record(response);
  if (result.state === 'failed') { sessionStorage.removeItem(key); throw new Error(text(result.error, 'GitHub 拒絕提交')); }
  if (result.state === 'done') { sessionStorage.removeItem(key); return true; }
  return false;
}
