import { ref, shallowRef } from 'vue';
import { useRequests } from './requests';

export function useResource<T>(loader: (request: ReturnType<typeof useRequests>['request']) => Promise<T>) {
  const requests = useRequests();
  const data = shallowRef<T | null>(null), loading = ref(false), error = ref('');
  let version = 0;
  async function load(): Promise<boolean> {
    const epoch = ++version; loading.value = true; error.value = '';
    try {
      const value = await loader(requests.request);
      if (!requests.active() || epoch !== version) return false;
      data.value = value; return true;
    } catch (reason) {
      if (requests.active() && epoch === version && !(reason instanceof DOMException && reason.name === 'AbortError')) {
        error.value = reason instanceof Error ? reason.message : '載入失敗，請重試';
      }
      return false;
    } finally { if (requests.active() && epoch === version) loading.value = false; }
  }
  function reset() { version++; requests.cancel(); data.value = null; loading.value = false; error.value = ''; }
  return { data, loading, error, load, reset, requests };
}
