import { ref } from 'vue';
import { useRequests } from './requests';

export function useMutation() {
  const requests = useRequests(), pending = ref(false), message = ref(''), failed = ref(false);
  async function run(operation: (request: typeof requests.request, signal: AbortSignal) => Promise<void>, success = ''): Promise<boolean> {
    if (pending.value) return false;
    pending.value = true; message.value = ''; failed.value = false;
    try {
      await requests.run(signal => operation(requests.request, signal));
      if (!requests.active()) return false;
      if (success) message.value = success;
      return true;
    } catch (reason) {
      if (requests.active() && !(reason instanceof DOMException && reason.name === 'AbortError')) {
        failed.value = true; message.value = reason instanceof Error ? reason.message : '操作失敗，請重試';
      }
      return false;
    } finally { if (requests.active()) pending.value = false; }
  }
  return { pending, message, failed, run };
}
