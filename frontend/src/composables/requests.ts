import { onScopeDispose } from 'vue';
import { ApiError, requestJson } from '../services/http';

export function useRequests() {
  const controllers = new Set<AbortController>();
  let disposed = false;
  async function run<T>(operation: (signal: AbortSignal) => Promise<T>): Promise<T> {
    if (disposed) throw new DOMException('Page disposed', 'AbortError');
    const controller = new AbortController(); controllers.add(controller);
    try { const value = await operation(controller.signal); controller.signal.throwIfAborted(); return value; }
    catch (error) {
      if (!disposed && error instanceof ApiError && error.status === 401) {
        location.replace('/login?next=' + encodeURIComponent(location.pathname + location.search));
      }
      throw error;
    } finally { controllers.delete(controller); }
  }
  const request = (path: string, body?: unknown) => run(signal => requestJson(path, {
    method: body === undefined ? 'GET' : 'POST', body, signal,
  }));
  function dispose() { disposed = true; for (const c of controllers) c.abort(); controllers.clear(); }
  onScopeDispose(dispose);
  return { run, request, dispose, active: () => !disposed };
}
