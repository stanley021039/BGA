import { onScopeDispose, ref } from 'vue';

interface Options<T> { allowed: () => boolean; blocked: () => boolean; save: (value: T) => Promise<boolean>; failure: () => string; delay?: number }
// Keep only the latest unsent value; serialize requests and never retry a mutation automatically.
export function useQueuedSave<T>({ allowed, blocked, save, failure, delay = 200 }: Options<T>) {
  const pending = ref(false), error = ref(''), saved = ref(false);
  let timer: ReturnType<typeof setTimeout> | null = null, queued: { value: T; revision: number } | null = null;
  let running: Promise<boolean> | null = null, revision = 0, generation = 0, disposed = false;
  const refresh = () => { pending.value = !!queued || !!running; };
  function clearTimer() { if (timer !== null) clearTimeout(timer); timer = null; }
  function schedule() { clearTimer(); timer = setTimeout(() => { timer = null; void flush(); }, delay); }
  function enqueue(value: T) { if (disposed) return; queued = { value, revision: ++revision }; error.value = ''; saved.value = false; refresh(); schedule(); }
  function invalidate(message: string) { revision++; queued = null; clearTimer(); error.value = message; saved.value = false; refresh(); }
  function reset() { generation++; revision++; queued = null; clearTimer(); error.value = ''; saved.value = false; refresh(); }
  async function flush(): Promise<boolean> {
    clearTimer(); if (disposed) return false;
    if (running) { await running; if (disposed) return false; return flush(); }
    if (!allowed()) { queued = null; refresh(); return false; }
    if (!queued) return !error.value;
    if (blocked()) { schedule(); return false; }
    const value = queued, epoch = generation; queued = null;
    const job: Promise<boolean> = Promise.resolve().then(async () => {
      if (disposed || epoch !== generation || !allowed()) return false;
      if (blocked()) { if (!queued) queued = value; schedule(); return false; }
      try {
        const accepted = await save(value.value);
        if (!accepted) throw Error(failure() || '設定儲存失敗，請重試。');
        if (!disposed && epoch === generation && value.revision === revision) { error.value = ''; saved.value = true; }
        return true;
      } catch (cause) {
        if (!disposed && epoch === generation && value.revision === revision) error.value = cause instanceof Error ? cause.message : '設定儲存失敗，請重試。';
        return false;
      }
    }).finally(() => { if (running === job) { running = null; refresh(); } });
    running = job; refresh(); await job;
    if (disposed || epoch !== generation) return false;
    return queued ? flush() : !error.value;
  }
  onScopeDispose(() => { disposed = true; reset(); });
  return { pending, error, saved, enqueue, invalidate, reset, flush };
}
