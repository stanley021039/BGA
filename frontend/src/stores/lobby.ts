import { computed, markRaw, onScopeDispose, ref, shallowRef, watch } from 'vue';
import { defineStore } from 'pinia';
import { useSessionStore } from './session';
import { ApiError, requestJson } from '../services/http';
import {
  readLobbySnapshot,
  readLobbyExpressions,
  readPublicRooms,
  type LobbySnapshot,
  type LobbyExpression,
  type PublicRoom,
} from '../contracts/lobby';
import {
  gamePath,
  gameTypes,
  readSeat,
  sessionKey,
  type GameType,
  type RoomSeat,
} from '../contracts/room';
import type { InteractionSource } from '../services/interaction-source';

export const useLobbyStore = defineStore('lobby', () => {
  const session = useSessionStore();
  const snapshot = shallowRef<LobbySnapshot | null>(null),
    rooms = shallowRef<PublicRoom[]>([]),
    expressions = shallowRef<LobbyExpression[]>([]);
  const connected = ref(false),
    presenceStatus = ref('正在進入大廳…'),
    roomsStatus = ref('正在載入房間…'),
    expressionStatus = ref(''),
    entryStatus = ref('');
  const roomsLoading = ref(false),
    expressionsLoading = ref(false),
    expressionsReady = ref(false),
    entryPending = ref(false),
    emotePending = ref(false),
    positionReset = ref(0),
    roomRevision = ref(0);
  const destination = shallowRef<{ x: number; y: number } | null>(null);
  let generation = 0,
    expressionRevision = 0,
    disposed = false,
    presenceJob: Promise<void> | null = null,
    roomsJob: Promise<boolean> | null = null,
    expressionsJob: Promise<void> | null = null;
  let presenceTimer: ReturnType<typeof setTimeout> | null = null,
    roomsTimer: ReturnType<typeof setTimeout> | null = null,
    queued: { x: number; y: number } | null = null,
    backoff = 500;
  const controllers = new Set<AbortController>();
  const identity = computed(() => session.user?.id || '');
  const current = (epoch: number, account: string) =>
    !disposed && epoch === generation && !!account && account === identity.value;
  function invalidateIdentity(message: string) {
    reset();
    presenceStatus.value = message;
    if (!disposed) location.replace('/login?next=%2F');
  }
  async function request(
    path: string,
    body?: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<unknown> {
    if (!identity.value || disposed) throw new DOMException('大廳已停止。', 'AbortError');
    const epoch = generation,
      account = identity.value,
      controller = new AbortController();
    controllers.add(controller);
    const abort = () => controller.abort(signal?.reason);
    if (signal?.aborted) abort();
    else signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(
      () =>
        controller.abort(
          new DOMException(
            body ? '操作結果尚未確認，請先查看目前狀態。' : '大廳連線逾時，請重試。',
            'TimeoutError',
          ),
        ),
      10000,
    );
    try {
      const value = await requestJson(path, {
        method: body ? 'POST' : 'GET',
        body,
        signal: controller.signal,
      });
      controller.signal.throwIfAborted();
      if (!current(epoch, account)) throw new DOMException('大廳身分已變更。', 'AbortError');
      return value;
    } catch (cause) {
      if (current(epoch, account) && cause instanceof ApiError && cause.status === 401)
        invalidateIdentity('登入已失效，請重新登入。');
      throw cause;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      controllers.delete(controller);
    }
  }
  function consume(value: unknown) {
    const next = readLobbySnapshot(value);
    if (next.selfId !== identity.value) {
      invalidateIdentity('登入身分已變更，請重新登入。');
      return;
    }
    if (snapshot.value && next.serverNow < snapshot.value.serverNow) return;
    snapshot.value = next;
    connected.value = true;
    presenceStatus.value = '';
    const own = next.visitors.find((visitor) => visitor.id === next.selfId);
    if (
      destination.value &&
      own &&
      Math.hypot(own.x - destination.value.x, own.y - destination.value.y) < 1
    )
      destination.value = null;
  }
  function clearTimers() {
    if (presenceTimer) clearTimeout(presenceTimer);
    if (roomsTimer) clearTimeout(roomsTimer);
    presenceTimer = roomsTimer = null;
  }
  function schedulePresence(delay: number) {
    if (presenceTimer) clearTimeout(presenceTimer);
    presenceTimer = null;
    if (identity.value && !disposed && !document.hidden)
      presenceTimer = setTimeout(() => {
        presenceTimer = null;
        void sync();
      }, delay);
  }
  async function sync(target?: { x: number; y: number }) {
    if (disposed || !identity.value || document.hidden) return;
    if (target) {
      queued = target;
      destination.value = target;
    }
    if (presenceJob || emotePending.value) return presenceJob;
    if (presenceTimer) clearTimeout(presenceTimer);
    presenceTimer = null;
    const epoch = generation,
      account = identity.value,
      next = queued;
    queued = null;
    const job = (async () => {
      try {
        consume(await request(next ? '/api/lobby/move' : '/api/lobby', next || undefined));
        if (current(epoch, account)) backoff = 500;
      } catch (cause) {
        if (
          current(epoch, account) &&
          !(cause instanceof DOMException && cause.name === 'AbortError')
        ) {
          connected.value = false;
          queued = null;
          destination.value = null;
          presenceStatus.value = cause instanceof Error ? cause.message : '大廳暫時無法連線。';
          backoff = Math.min(10000, backoff * 2);
        }
      }
    })();
    presenceJob = job;
    await job;
    if (presenceJob === job) {
      presenceJob = null;
      if (current(epoch, account)) {
        if (queued && connected.value) void sync();
        else schedulePresence(backoff);
      }
    }
  }
  function move(target: { x: number; y: number }) {
    if (connected.value)
      void sync({
        x: Math.max(15, Math.min(85, target.x)),
        y: Math.max(32, Math.min(92, target.y)),
      });
  }
  async function loadExpressions(force = false) {
    if (expressionsJob) return expressionsJob;
    if (!identity.value || (expressionsReady.value && !force)) return;
    const epoch = generation,
      revision = expressionRevision,
      account = identity.value;
    expressionsLoading.value = true;
    expressionStatus.value = '';
    const job = (async () => {
      try {
        const data = readLobbyExpressions(await request('/api/lobby/emotes'));
        if (current(epoch, account) && revision === expressionRevision) {
          expressions.value = data;
          expressionsReady.value = true;
        }
      } catch (cause) {
        if (
          current(epoch, account) &&
          revision === expressionRevision &&
          !(cause instanceof DOMException && cause.name === 'AbortError')
        )
          expressionStatus.value = cause instanceof Error ? cause.message : '無法載入表情。';
      }
    })();
    expressionsJob = job;
    await job;
    if (expressionsJob === job) {
      expressionsJob = null;
      expressionsLoading.value = false;
    }
  }
  async function emote(expression: string): Promise<boolean> {
    if (
      emotePending.value ||
      !connected.value ||
      !expressions.value.some((item) => item.expression === expression)
    )
      return false;
    emotePending.value = true;
    expressionStatus.value = '';
    const epoch = generation,
      account = identity.value;
    try {
      if (presenceJob) await presenceJob;
      if (!current(epoch, account) || document.hidden) return false;
      consume(await request('/api/lobby/emote', { expression }));
      return current(epoch, account);
    } catch (cause) {
      if (
        current(epoch, account) &&
        !(cause instanceof DOMException && cause.name === 'AbortError')
      )
        expressionStatus.value = cause instanceof Error ? cause.message : '無法使用表情。';
      return false;
    } finally {
      if (current(epoch, account)) {
        emotePending.value = false;
        if (queued) void sync();
        else schedulePresence(500);
      }
    }
  }
  function pruneSeatHints(data: PublicRoom[]) {
    for (const type of gameTypes)
      try {
        const key = sessionKey(type),
          saved = JSON.parse(localStorage.getItem(key) || 'null');
        if (
          saved?.code &&
          !data.some(
            (room) =>
              room.type === type && room.code === String(saved.code).toUpperCase() && room.seated,
          )
        ) {
          localStorage.removeItem(key + ':' + saved.code);
          localStorage.removeItem(key);
        }
      } catch {
        /* Hints never authorize a seat; unavailable storage cannot block entry. */
      }
  }
  function scheduleRooms() {
    if (roomsTimer) clearTimeout(roomsTimer);
    roomsTimer = null;
    if (identity.value && !disposed && !document.hidden)
      roomsTimer = setTimeout(() => {
        roomsTimer = null;
        void refreshRooms();
      }, 10000);
  }
  async function refreshRooms(): Promise<boolean> {
    if (roomsJob) return roomsJob;
    if (!identity.value || disposed || document.hidden) return false;
    const epoch = generation,
      account = identity.value;
    roomsLoading.value = true;
    const job = (async () => {
      try {
        const data = readPublicRooms(await request('/api/rooms'));
        if (!current(epoch, account)) return false;
        rooms.value = data;
        roomRevision.value++;
        roomsStatus.value = '';
        pruneSeatHints(data);
        return true;
      } catch (cause) {
        if (
          current(epoch, account) &&
          !(cause instanceof DOMException && cause.name === 'AbortError')
        )
          roomsStatus.value = cause instanceof Error ? cause.message : '無法取得房間列表。';
        return false;
      }
    })();
    roomsJob = job;
    const ok = await job;
    if (roomsJob === job) {
      roomsJob = null;
      roomsLoading.value = false;
      if (current(epoch, account)) scheduleRooms();
    }
    return ok;
  }
  function remember(seat: RoomSeat) {
    try {
      localStorage.setItem(sessionKey(seat.type), JSON.stringify(seat));
      localStorage.setItem(sessionKey(seat.type) + ':' + seat.code, JSON.stringify(seat));
    } catch {
      /* Cookie authentication remains authoritative. */
    }
  }
  async function enter(
    options:
      { code: string } | { type: GameType; roomName: string; seconds: number; rounds: number },
  ): Promise<boolean> {
    if (entryPending.value || !identity.value) return false;
    if ('code' in options && !/^[a-f0-9]{6}$/i.test(options.code.trim())) {
      entryStatus.value = '請輸入正確的 6 碼房間代碼。';
      return false;
    }
    if (
      'type' in options &&
      options.type === 'draw' &&
      (![60, 90, 120].includes(options.seconds) ||
        !Number.isInteger(options.rounds) ||
        options.rounds < 1 ||
        options.rounds > 64)
    ) {
      entryStatus.value = '作畫時間需為 60、90、120 秒，總題數需為 1–64 題。';
      return false;
    }
    entryPending.value = true;
    entryStatus.value = '';
    const epoch = generation,
      account = identity.value;
    const payload =
      'code' in options
        ? { code: options.code.trim().toUpperCase() }
        : {
            type: options.type,
            roomName: options.roomName.trim().slice(0, 24),
            ...(options.type === 'draw'
              ? { seconds: options.seconds, ending: { mode: 'rounds', value: options.rounds } }
              : {}),
          };
    try {
      const seat = readSeat(
        await request('/api/' + ('code' in options ? 'join' : 'create'), payload),
      );
      if (!current(epoch, account)) return false;
      remember(seat);
      location.assign('/' + gamePath(seat.type) + '/' + seat.code);
      return true;
    } catch (cause) {
      if (
        current(epoch, account) &&
        !(cause instanceof DOMException && cause.name === 'AbortError')
      ) {
        entryStatus.value = cause instanceof Error ? cause.message : '無法入座，請重試。';
        void refreshRooms();
      }
      return false;
    } finally {
      if (current(epoch, account)) entryPending.value = false;
    }
  }
  async function resume(room: PublicRoom) {
    if (entryPending.value) return;
    entryPending.value = true;
    const epoch = generation,
      account = identity.value;
    try {
      const ok = await refreshRooms();
      if (!current(epoch, account)) return;
      if (
        ok &&
        rooms.value.some(
          (item) => item.code === room.code && item.type === room.type && item.seated,
        )
      )
        location.assign('/' + gamePath(room.type) + '/' + room.code);
      else
        entryStatus.value = ok
          ? '房間已結束或你已離開，請重新開桌或加入房間。'
          : '無法確認房間，請稍後重試。';
    } finally {
      if (current(epoch, account)) entryPending.value = false;
    }
  }
  function reset() {
    generation++;
    expressionRevision++;
    clearTimers();
    for (const controller of controllers) controller.abort();
    controllers.clear();
    presenceJob = null;
    roomsJob = null;
    expressionsJob = null;
    snapshot.value = null;
    rooms.value = [];
    expressions.value = [];
    connected.value = false;
    destination.value = null;
    queued = null;
    backoff = 500;
    roomsLoading.value =
      expressionsLoading.value =
      expressionsReady.value =
      entryPending.value =
      emotePending.value =
        false;
    entryStatus.value = expressionStatus.value = '';
    presenceStatus.value = '正在進入大廳…';
    roomsStatus.value = '正在載入房間…';
    positionReset.value++;
  }
  function visibility() {
    if (document.hidden) {
      clearTimers();
      queued = null;
      destination.value = null;
      connected.value = false;
      if (entryPending.value) entryStatus.value = '操作結果尚未確認，回到前景後請先查看目前房間。';
      for (const controller of controllers) controller.abort();
    } else {
      positionReset.value++;
      void sync();
      void refreshRooms();
    }
  }
  function refreshProfile() {
    expressionRevision++;
    expressionsJob = null;
    expressionsLoading.value = false;
    expressionsReady.value = false;
    expressions.value = [];
    expressionStatus.value = '';
    void sync();
  }
  watch(
    identity,
    () => {
      reset();
      if (identity.value) {
        void sync();
        void refreshRooms();
      }
    },
    { immediate: true, flush: 'sync' },
  );
  document.addEventListener('visibilitychange', visibility);
  window.addEventListener('online', visibility);
  window.addEventListener('profile-updated', refreshProfile);
  onScopeDispose(() => {
    disposed = true;
    reset();
    document.removeEventListener('visibilitychange', visibility);
    window.removeEventListener('online', visibility);
    window.removeEventListener('profile-updated', refreshProfile);
  });
  const interaction: InteractionSource = {
    snapshot: computed(() =>
      connected.value && snapshot.value
        ? {
            type: 'lobby',
            players: snapshot.value.visitors,
            pingContext: snapshot.value.pingContext,
          }
        : null,
    ),
    identity: computed(() => (identity.value ? identity.value + ':lobby' : '')),
    code: computed(() => '__LOBBY__'),
    request: (action, body, options) => {
      const query = body ? '' : '?' + new URLSearchParams(options?.query || {});
      return request(
        '/api/' + action + query,
        body ? { ...body, ...(action === 'pings' ? { code: '__LOBBY__' } : {}) } : undefined,
        options?.signal,
      );
    },
  };
  return {
    snapshot,
    rooms,
    expressions,
    connected,
    presenceStatus,
    roomsStatus,
    expressionStatus,
    entryStatus,
    roomsLoading,
    expressionsLoading,
    expressionsReady,
    entryPending,
    emotePending,
    positionReset,
    roomRevision,
    destination,
    interaction: markRaw(interaction),
    move,
    sync,
    refreshRooms,
    loadExpressions,
    emote,
    enter,
    resume,
  };
});
