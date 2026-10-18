export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  signal?: AbortSignal;
}

// Transport has no implicit retries, redirects or state mutations.
export async function requestJson(path: string, options: RequestOptions = {}): Promise<unknown> {
  let response: Response;
  try { response = await fetch(path, {
    method: options.method ?? 'GET',
    credentials: 'same-origin',
    cache: 'no-store',
    signal: options.signal,
    ...(options.body === undefined ? {} : {
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(options.body),
    }),
  }); } catch (error) {
    options.signal?.throwIfAborted();
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError('連線中斷，請檢查網路後重試', 0, 'NETWORK_ERROR');
  }
  options.signal?.throwIfAborted();
  let text = '', data: unknown = null, parseError: unknown;
  try {
    text = await response.text();
    if (text.trim()) data = JSON.parse(text);
  } catch (error) { parseError = error; }
  options.signal?.throwIfAborted();
  if (!response.ok) {
    const body = data && typeof data === 'object' ? data as Record<string, unknown> : {};
    throw new ApiError(typeof body.error === 'string' ? body.error : `請求失敗（HTTP ${response.status}）`,
      response.status, typeof body.code === 'string' ? body.code : undefined);
  }
  if (parseError) throw new ApiError('無法讀取伺服器回應，請稍後重試', response.status, 'INVALID_RESPONSE');
  return data;
}
