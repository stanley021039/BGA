import { computed, onScopeDispose, ref, shallowRef } from 'vue';
import { defineStore } from 'pinia';
import { ApiError, requestJson } from '../services/http';
import {
  gamePath,
  gameTypes,
  isRoomHost,
  canManageSettings,
  canStartGame,
  readRoomSnapshot,
  readSeat,
  sameRoom,
  sessionKey,
  staleSnapshot,
} from '../contracts/room';
import type { GameType, RoomSeat, RoomSnapshot } from '../contracts/room';

type Terminal = 'kicked' | 'not-seated' | 'closed' | 'replaced' | null;
interface RequestOptions {
  signal?: AbortSignal;
  query?: Record<string, string | number | boolean>;
  affectsConnection?: boolean;
}
// A document has one room owner. Game domains keep their own detailed contracts.
export const useRoomStore = defineStore('room', () => {
  const code = ref(''),
    type = ref<GameType>('poker'),
    seat = shallowRef<RoomSeat | null>(null),
    snapshot = shallowRef<RoomSnapshot | null>(null);
  const connecting = ref(false),
    disconnected = ref(false),
    error = ref(''),
    terminal = ref<Terminal>(null),
    busy = ref(false),
    scope = ref(0);
  const message = ref(''),
    failed = ref(false),
    clockOffset = ref(0),
    lastReceivedAt = ref(0);
  const requests = new Set<AbortController>();
  let disposed = false,
    recovery: Promise<boolean> | null = null;
  let readSnapshot: (value: unknown) => RoomSnapshot = readRoomSnapshot;
  let retry: { timer: ReturnType<typeof setTimeout>; resolve: () => void } | null = null;
  const host = computed(() => isRoomHost(snapshot.value));
  const settingsManager = computed(
    () => !!seat.value && !terminal.value && canManageSettings(snapshot.value),
  );
  const gameManager = computed(
    () => !!seat.value && !terminal.value && canStartGame(snapshot.value),
  );
  const connected = computed(() => !!seat.value && !disconnected.value && !terminal.value);
  function forget() {
    for (const game of gameTypes) {
      const key = sessionKey(game);
      try {
        localStorage.removeItem(key + ':' + code.value);
        if (JSON.parse(localStorage.getItem(key) || 'null')?.code === code.value)
          localStorage.removeItem(key);
      } catch {
        /* Cached seats are hints; cookie authentication remains authoritative. */
      }
    }
  }
  function persist(value: RoomSeat) {
    try {
      const key = sessionKey(value.type),
        encoded = JSON.stringify(value);
      localStorage.setItem(key, encoded);
      localStorage.setItem(key + ':' + value.code, encoded);
    } catch {
      /* Private browsing must not prevent playing. */
    }
  }
  function cancelReads() {
    for (const controller of requests) controller.abort();
    requests.clear();
    if (retry) {
      clearTimeout(retry.timer);
      retry.resolve();
      retry = null;
    }
  }
  function terminalError(cause: ApiError) {
    if (cause.status === 401) {
      location.replace(
        '/login?next=' + encodeURIComponent('/' + gamePath(type.value) + '/' + code.value),
      );
      return;
    }
    const kind =
      cause.code === 'KICKED'
        ? 'kicked'
        : cause.code === 'NOT_SEATED'
          ? 'not-seated'
          : cause.code === 'ROOM_NOT_FOUND'
            ? 'closed'
            : null;
    if (!kind) return;
    terminal.value = kind;
    seat.value = null;
    error.value = cause.message;
    disconnected.value = true;
    forget();
    cancelReads();
  }
  async function request(
    route: string,
    data?: Record<string, unknown>,
    options: RequestOptions = {},
  ): Promise<unknown> {
    if (disposed || terminal.value) throw new DOMException('Room unavailable', 'AbortError');
    if (!/^[a-z][a-z0-9-]*(?:\/[a-z][a-z0-9-]*)*$/.test(route)) throw Error('房間操作路徑不正確');
    const epoch = scope.value,
      roomCode = code.value,
      controller = new AbortController();
    requests.add(controller);
    const cancel = () => controller.abort(options.signal?.reason);
    options.signal?.addEventListener('abort', cancel, { once: true });
    try {
      options.signal?.throwIfAborted();
      const post = data !== undefined;
      const query = new URLSearchParams(
        Object.entries(options.query || {}).map(([key, value]) => [key, String(value)]),
      );
      if (!post) query.set('code', roomCode);
      else query.delete('code');
      const result = await requestJson(
        '/api/' + route + (query.size ? '?' + query.toString() : ''),
        {
          method: post ? 'POST' : 'GET',
          ...(post ? { body: { ...data, code: roomCode } } : {}),
          signal: controller.signal,
        },
      );
      controller.signal.throwIfAborted();
      if (disposed || epoch !== scope.value) throw new DOMException('Room changed', 'AbortError');
      return result;
    } catch (cause) {
      if (
        !disposed &&
        epoch === scope.value &&
        !controller.signal.aborted &&
        cause instanceof ApiError
      ) {
        if (
          options.affectsConnection !== false &&
          (!cause.status || cause.status >= 500 || cause.code === 'INVALID_RESPONSE')
        )
          disconnected.value = true;
        terminalError(cause);
      }
      throw cause;
    } finally {
      requests.delete(controller);
      options.signal?.removeEventListener('abort', cancel);
    }
  }
  function accept(value: unknown): boolean {
    if (disposed || terminal.value || !seat.value) return false;
    const next = readSnapshot(value),
      previous = snapshot.value;
    if (next.code !== code.value || next.type !== type.value) throw Error('收到其他房間的狀態');
    if (previous && !sameRoom(next, previous)) {
      // A replaced room/seat cannot silently consume the old page's drafts.
      invalidateIdentity('房間或座位已更新，請重新連線。');
      return false;
    }
    if (staleSnapshot(next, previous)) return false;
    snapshot.value = next;
    clockOffset.value = Date.now() - next.serverNow;
    lastReceivedAt.value = Date.now();
    disconnected.value = false;
    error.value = '';
    return true;
  }
  async function restore(): Promise<boolean> {
    if (recovery) return recovery;
    const epoch = scope.value;
    const current = () => !disposed && scope.value === epoch && !terminal.value;
    recovery = (async () => {
      connecting.value = true;
      while (current()) {
        const controller = new AbortController();
        const timeout = setTimeout(
          () => controller.abort(new DOMException('恢復座位逾時，正在重試。', 'TimeoutError')),
          10000,
        );
        try {
          const result = readSeat(await request('reconnect', {}, { signal: controller.signal }));
          if (!current()) return false;
          if (result.type !== type.value) {
            location.replace('/' + gamePath(result.type) + '/' + result.code);
            return false;
          }
          if (result.code !== code.value) throw Error('重連座位與目前房間不一致');
          seat.value = result;
          persist(result);
          disconnected.value = false;
          error.value = '';
          return true;
        } catch (cause) {
          if (!current() || (cause instanceof DOMException && cause.name === 'AbortError'))
            return false;
          disconnected.value = true;
          error.value = cause instanceof Error ? cause.message : '連線中斷，正在重試…';
          await new Promise<void>((resolve) => {
            retry = {
              resolve,
              timer: setTimeout(() => {
                retry = null;
                resolve();
              }, 3000),
            };
          });
        } finally {
          clearTimeout(timeout);
        }
      }
      return false;
    })().finally(() => {
      if (scope.value === epoch) {
        connecting.value = false;
        recovery = null;
      }
    });
    return recovery;
  }
  function open(
    roomCode: string,
    game: GameType,
    reader: (value: unknown) => RoomSnapshot = readRoomSnapshot,
  ): Promise<boolean> {
    if (!/^[a-f0-9]{6}$/i.test(roomCode)) return Promise.reject(Error('房間代碼需為六位英數字'));
    scope.value++;
    cancelReads();
    recovery = null;
    readSnapshot = reader;
    code.value = roomCode.toUpperCase();
    type.value = game;
    seat.value = null;
    snapshot.value = null;
    terminal.value = null;
    message.value = error.value = '';
    failed.value = busy.value = false;
    disconnected.value = false;
    return restore();
  }
  async function command(route: string, data: Record<string, unknown> = {}): Promise<boolean> {
    if (busy.value || !seat.value || terminal.value) return false;
    if (route === 'start' && !gameManager.value) return false;
    if (route === 'settings' && !settingsManager.value) return false;
    const epoch = scope.value;
    const timeout = new AbortController();
    const timer = setTimeout(
      () =>
        timeout.abort(
          new DOMException('送出結果尚未確認，請查看最新房間狀態後再操作。', 'TimeoutError'),
        ),
      10000,
    );
    busy.value = true;
    message.value = '正在送出…';
    failed.value = false;
    try {
      const result = await request(route, data, { signal: timeout.signal });
      if (epoch !== scope.value || disposed) return false;
      const row = result && typeof result === 'object' ? (result as Record<string, unknown>) : null;
      if (row?.phase && Array.isArray(row.players)) {
        accept(result);
        if (terminal.value) {
          failed.value = true;
          message.value = error.value;
          return false;
        }
      }
      message.value = '';
      return true;
    } catch (cause) {
      if (
        epoch === scope.value &&
        !disposed &&
        !(cause instanceof DOMException && cause.name === 'AbortError')
      ) {
        failed.value = true;
        message.value = cause instanceof Error ? cause.message : '送出失敗，請重試';
      }
      return false;
    } finally {
      clearTimeout(timer);
      if (epoch === scope.value && !disposed) busy.value = false;
    }
  }
  // An "unchanged" poll reply carries no snapshot but still proves the link.
  function confirm(serverNow: unknown) {
    if (disposed || terminal.value || !seat.value) return false;
    if (typeof serverNow !== 'number' || !Number.isFinite(serverNow)) return false;
    clockOffset.value = Date.now() - serverNow;
    lastReceivedAt.value = Date.now();
    disconnected.value = false;
    error.value = '';
    return true;
  }
  function lostConnection(cause?: unknown) {
    disconnected.value = true;
    if (cause instanceof Error) error.value = cause.message;
  }
  function invalidateIdentity(reason: string) {
    if (disposed || terminal.value) return;
    error.value = reason;
    disconnected.value = true;
    terminal.value = 'replaced';
    seat.value = null;
    cancelReads();
  }
  const reconnect = () => open(code.value, type.value, readSnapshot);
  function dispose() {
    disposed = true;
    scope.value++;
    cancelReads();
    recovery = null;
    seat.value = null;
  }
  onScopeDispose(dispose);
  return {
    code,
    type,
    seat,
    snapshot,
    connecting,
    disconnected,
    connected,
    terminal,
    error,
    busy,
    scope,
    host,
    settingsManager,
    gameManager,
    message,
    failed,
    clockOffset,
    lastReceivedAt,
    open,
    restore,
    reconnect,
    request,
    accept,
    confirm,
    command,
    lostConnection,
    invalidateIdentity,
    forget,
    dispose,
  };
});
