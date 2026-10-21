import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue';
import { defineStore } from 'pinia';
import { useRoomStore } from './room';
import { ApiError } from '../services/http';

interface Attempt {
  scope: number;
  turnId: string | null;
  tokenField: 'roundId' | 'stepId';
  phase: string;
  target: string;
  payload: Record<string, unknown>;
}
// A retry retains the exact turn token, request ID and body accepted by each engine.
export const usePartyActionsStore = defineStore('party-actions', () => {
  const room = useRoomStore(),
    retry = shallowRef<Attempt | null>(null),
    pending = ref(false),
    notice = ref(''),
    target = ref('');
  let disposed = false,
    controller: AbortController | null = null;
  const tokenField = computed((): Attempt['tokenField'] =>
    room.type === 'telephone' ? 'stepId' : 'roundId',
  );
  const turnId = computed(() => {
      const value = room.snapshot?.[tokenField.value];
      return value === null ? null : typeof value === 'string' ? value : '';
    }),
    phase = computed(() => room.snapshot?.phase || '');
  const current = (attempt: Attempt) =>
    attempt.scope === room.scope &&
    attempt.tokenField === tokenField.value &&
    attempt.turnId === turnId.value &&
    attempt.phase === phase.value &&
    attempt.target === target.value;
  const canRetry = computed(
    () => !!retry.value && current(retry.value) && !room.terminal && !pending.value && !room.busy,
  );
  function clear() {
    if (controller && pending.value) room.busy = false;
    controller?.abort();
    controller = null;
    retry.value = null;
    pending.value = false;
    notice.value = '';
  }
  async function execute(attempt: Attempt): Promise<boolean> {
    if (disposed || pending.value || room.busy || !room.seat || room.terminal || !current(attempt))
      return false;
    const request = new AbortController();
    controller = request;
    pending.value = true;
    room.busy = true;
    notice.value = '正在送出…';
    retry.value = null;
    const timer = setTimeout(
      () =>
        request.abort(
          new DOMException('操作結果尚未確認；更新房間後，可重試同一操作。', 'TimeoutError'),
        ),
      10000,
    );
    try {
      const value = await room.request('action', attempt.payload, { signal: request.signal });
      if (disposed || attempt.scope !== room.scope || controller !== request) return false;
      room.accept(value);
      if (room.terminal) return false;
      notice.value = '';
      return true;
    } catch (cause) {
      if (
        !disposed &&
        attempt.scope === room.scope &&
        controller === request &&
        !(cause instanceof DOMException && cause.name === 'AbortError')
      ) {
        notice.value = cause instanceof Error ? cause.message : '操作失敗。';
        if (!(cause instanceof ApiError) || !cause.status || cause.status >= 500)
          retry.value = attempt;
      }
      return false;
    } finally {
      clearTimeout(timer);
      if (controller === request) {
        controller = null;
        pending.value = false;
        if (attempt.scope === room.scope) room.busy = false;
      }
    }
  }
  function command(action: string, data: Record<string, unknown> = {}) {
    const setupCommand =
      room.type === 'musicquiz' &&
      action === 'configure' &&
      phase.value === 'waiting' &&
      turnId.value === null;
    if ((!turnId.value && !setupCommand) || !room.snapshot || room.terminal)
      return Promise.resolve(false);
    return execute({
      scope: room.scope,
      turnId: turnId.value,
      tokenField: tokenField.value,
      phase: phase.value,
      target: target.value,
      payload: structuredClone({
        ...data,
        action,
        [tokenField.value]: turnId.value,
        requestId: crypto.randomUUID(),
      }),
    });
  }
  function retrySame() {
    return retry.value && canRetry.value ? execute(retry.value) : Promise.resolve(false);
  }
  watch([() => room.scope, turnId, tokenField, phase, target], () => {
    if (retry.value && !current(retry.value)) retry.value = null;
    if (controller && (room.terminal || !room.seat)) clear();
  });
  watch(
    () => room.terminal,
    (value) => {
      if (value) clear();
    },
  );
  function visibility() {
    if (document.hidden && controller)
      controller.abort(
        new DOMException('背景連線已暫停；回到前景後先確認結果，可重試同一操作。', 'TimeoutError'),
      );
  }
  document.addEventListener('visibilitychange', visibility);
  onScopeDispose(() => {
    disposed = true;
    clear();
    document.removeEventListener('visibilitychange', visibility);
  });
  return {
    pending,
    notice,
    canRetry,
    command,
    retrySame,
    setTarget: (value: string) => {
      target.value = value;
    },
  };
});
