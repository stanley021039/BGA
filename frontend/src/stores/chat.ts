import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue';
import { defineStore } from 'pinia';
import { useRoomStore } from './room';
import { usePreferencesStore } from './preferences';
import { readChatReceipt } from '../contracts/social';
import type { ChatMessage, ChatReceipt } from '../contracts/social';

export const useChatStore = defineStore('chat', () => {
  const room = useRoomStore(),
    preferences = usePreferencesStore();
  const messages = shallowRef<ChatMessage[]>([]),
    draft = ref(''),
    viewerId = ref<string | null>(null),
    visible = ref(true),
    unread = ref(0);
  const pending = ref(false),
    loading = ref(false),
    status = ref(''),
    identityChanged = ref(false);
  const context = computed(() => {
    if (!room.seat || !room.snapshot || room.terminal) return null;
    const media = room.snapshot.media;
    const instance =
      media && typeof media === 'object'
        ? (media as Record<string, unknown>).roomInstanceId || ''
        : '';
    return `${room.scope}:${room.code}:${room.snapshot.me}:${instance}`;
  });
  const enabled = computed(() => !!context.value && !identityChanged.value);
  let generation = 0,
    pollEpoch = 0,
    disposed = false,
    initial = false,
    backoff = 3000;
  let timer: ReturnType<typeof setTimeout> | null = null,
    posting: AbortController | null = null;
  let reading: { controller: AbortController; promise: Promise<boolean> | null } | null = null;
  let retry: { key: string; id: string; frame: string | undefined } | null = null;
  const current = (epoch: number) => !disposed && epoch === generation && enabled.value;
  function clearTimer() {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  }
  function cancelRead() {
    const job = reading;
    reading = null;
    job?.controller.abort();
    loading.value = false;
  }
  function reset() {
    generation++;
    pollEpoch++;
    clearTimer();
    cancelRead();
    posting?.abort();
    posting = null;
    messages.value = [];
    draft.value = '';
    viewerId.value = null;
    unread.value = 0;
    initial = false;
    pending.value = false;
    status.value = '';
    identityChanged.value = false;
    retry = null;
    backoff = 3000;
  }
  function changedIdentity(viewer: string) {
    reset();
    identityChanged.value = true;
    viewerId.value = viewer;
    status.value = '登入身分已變更，請重新確認房間。';
    room.invalidateIdentity(status.value);
  }
  function consume(value: ChatReceipt): boolean {
    if (value.code !== room.code) throw Error('收到其他房間的聊天訊息');
    if (viewerId.value && viewerId.value !== value.viewerId) {
      changedIdentity(value.viewerId);
      return false;
    }
    const previous = new Set(messages.value.map((message) => message.id));
    if (initial && !visible.value)
      unread.value = Math.min(
        50,
        unread.value + value.messages.filter((message) => !previous.has(message.id)).length,
      );
    viewerId.value = value.viewerId;
    messages.value = value.messages;
    initial = true;
    status.value = '';
    if (value.roomState) room.accept(value.roomState);
    return enabled.value;
  }
  async function poll(): Promise<boolean> {
    if (!enabled.value || document.hidden || pending.value) return false;
    if (reading?.promise) return reading.promise;
    const epoch = generation,
      job = { controller: new AbortController(), promise: null as Promise<boolean> | null };
    reading = job;
    loading.value = !initial;
    const timeout = setTimeout(
      () => job.controller.abort(new DOMException('聊天室連線逾時，請重試。', 'TimeoutError')),
      10000,
    );
    job.promise = (async () => {
      try {
        const value = readChatReceipt(
          await room.request('chat', undefined, {
            query: { channel: 'table' },
            signal: job.controller.signal,
          }),
        );
        return current(epoch) && reading === job && !job.controller.signal.aborted
          ? consume(value)
          : false;
      } catch (cause) {
        if (
          current(epoch) &&
          reading === job &&
          !(cause instanceof DOMException && cause.name === 'AbortError')
        )
          status.value = cause instanceof Error ? cause.message : '聊天室暫時無法連線';
        return false;
      } finally {
        clearTimeout(timeout);
        if (reading === job) {
          reading = null;
          loading.value = false;
        }
      }
    })();
    return job.promise;
  }
  function schedule(delay: number) {
    clearTimer();
    if (enabled.value && !disposed && !document.hidden)
      timer = setTimeout(() => {
        timer = null;
        void tick();
      }, delay);
  }
  async function tick() {
    const token = ++pollEpoch;
    clearTimer();
    if (!enabled.value || disposed || document.hidden) return;
    if (pending.value) {
      schedule(3000);
      return;
    }
    const ok = await poll();
    if (token !== pollEpoch || !enabled.value || disposed || document.hidden) return;
    backoff = ok ? (streamLive() ? 15000 : 3000) : Math.min(30000, backoff * 2);
    schedule(backoff);
  }
  async function send(value = draft.value): Promise<boolean> {
    if (
      !enabled.value ||
      !viewerId.value ||
      pending.value ||
      typeof value !== 'string' ||
      !value.trim()
    )
      return false;
    if ([...value.trim()].length > 160 || /[\u0000-\u0008\u000b-\u001f\u007f]/.test(value)) {
      status.value = '留言需為 1–160 字純文字。';
      return false;
    }
    cancelRead();
    const epoch = generation,
      key = context.value + ':' + value;
    if (retry?.key !== key)
      retry = {
        key,
        id:
          globalThis.crypto?.randomUUID?.() ||
          Date.now() + '-' + Math.random().toString(16).slice(2),
        frame: preferences.barrage?.selected,
      };
    const attempt = retry,
      controller = new AbortController();
    posting = controller;
    pending.value = true;
    status.value = '';
    const timeout = setTimeout(
      () =>
        controller.abort(new DOMException('傳送結果尚未確認，已保留訊息供重試。', 'TimeoutError')),
      10000,
    );
    try {
      const valueReply = await room.request(
        'chat',
        {
          channel: 'table',
          message: value,
          requestId: attempt.id,
          ...(attempt.frame ? { builtinFrameId: attempt.frame } : {}),
        },
        { signal: controller.signal },
      );
      if (!current(epoch) || posting !== controller || controller.signal.aborted) return false;
      if (!consume(readChatReceipt(valueReply))) return false;
      retry = null;
      if (draft.value === value) draft.value = '';
      return true;
    } catch (cause) {
      if (current(epoch) && posting === controller)
        status.value = cause instanceof Error ? cause.message : '傳送失敗，已保留訊息。';
      return false;
    } finally {
      clearTimeout(timeout);
      if (posting === controller) {
        posting = null;
        pending.value = false;
        schedule(3000);
      }
    }
  }
  function show(value: boolean) {
    visible.value = value;
    if (value) unread.value = 0;
  }
  function compose(value: string): boolean {
    if (!enabled.value || !viewerId.value || pending.value) return false;
    draft.value = [...(draft.value + value)].slice(0, 160).join('');
    return true;
  }
  // While the room event stream is open it announces new messages (#232), so
  // the fallback poll can be slow.
  const streamLive = () => document.documentElement.dataset.roomStream === 'live';
  function streamed(event: Event) {
    if ((event as CustomEvent<{ kind?: string }>).detail?.kind === 'chat') void tick();
  }
  function visibility() {
    if (document.hidden) {
      pollEpoch++;
      clearTimer();
      cancelRead();
      posting?.abort(new DOMException('背景連線已暫停；未確認的訊息可重試。', 'AbortError'));
    } else void tick();
  }
  function logout(event: StorageEvent) {
    if (event.key === 'ah-chat-logout') {
      reset();
      identityChanged.value = true;
      status.value = '帳號狀態已變更，請重新確認房間。';
      room.invalidateIdentity(status.value);
    }
  }
  const online = () => {
    void tick();
  };
  watch(
    context,
    () => {
      reset();
      if (context.value) void tick();
    },
    { immediate: true },
  );
  document.addEventListener('visibilitychange', visibility);
  window.addEventListener('online', online);
  window.addEventListener('storage', logout);
  window.addEventListener('bga:room-event', streamed);
  onScopeDispose(() => {
    disposed = true;
    reset();
    document.removeEventListener('visibilitychange', visibility);
    window.removeEventListener('online', online);
    window.removeEventListener('storage', logout);
    window.removeEventListener('bga:room-event', streamed);
  });
  return {
    messages,
    draft,
    viewerId,
    visible,
    unread,
    pending,
    loading,
    status,
    enabled,
    poll,
    send,
    show,
    compose,
  };
});
