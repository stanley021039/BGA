import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoomStore } from '../stores/room';
import { useSessionStore } from '../stores/session';
import { useRequests } from './requests';
import { gamePath, readSeat, type GameType, type RoomSnapshot } from '../contracts/room';
import { requestJson } from '../services/http';

// Each game retains its read cadence while sharing one non-overlapping controller.
// Seated pages also receive their view over one event stream (#232); while it
// is open, polling slows to a safety net that only asks whether anything changed.
const STREAM_POLL_MS = 10000,
  STREAM_RETRY_MS = 5000;
export function useRoomPage(
  type: GameType,
  reader: (value: unknown) => RoomSnapshot,
  pollMs = 2000,
) {
  const room = useRoomStore(),
    session = useSessionStore(),
    requests = useRequests();
  const match = new RegExp('^/' + gamePath(type) + '/([a-f0-9]{6})/?$', 'i').exec(
    location.pathname,
  );
  const entryCode = ref(match?.[1]?.toUpperCase() || ''),
    entryBusy = ref(false),
    entryError = ref(''),
    reading = ref(false);
  const foreground = ref(!document.hidden),
    connected = computed(() => room.connected && !!room.snapshot && foreground.value);
  let disposed = false,
    timer: ReturnType<typeof setTimeout> | null = null,
    job: { controller: AbortController; promise: Promise<boolean> | null } | null = null;
  let stream: EventSource | null = null,
    streamLive = false,
    streamTried = 0,
    stateTag = '';
  function announce(live: boolean) {
    if (streamLive === live) return;
    streamLive = live;
    // Widgets that mount later read the flag; those already listening get the event.
    if (live) document.documentElement.dataset.roomStream = 'live';
    else delete document.documentElement.dataset.roomStream;
    window.dispatchEvent(new CustomEvent('bga:room-stream', { detail: { live } }));
  }
  function closeStream() {
    stream?.close();
    stream = null;
    announce(false);
  }
  function accept(value: unknown) {
    const row = value as { unchanged?: unknown; serverNow?: unknown; stateTag?: unknown } | null;
    if (row?.unchanged === true) return room.confirm(row.serverNow);
    const accepted = room.accept(value);
    if (accepted) stateTag = typeof row?.stateTag === 'string' ? row.stateTag : '';
    return accepted;
  }
  function openStream() {
    if (stream || disposed || !room.seat || room.terminal || document.hidden) return;
    if (typeof EventSource !== 'function' || Date.now() - streamTried < STREAM_RETRY_MS) return;
    streamTried = Date.now();
    const scope = room.scope,
      source = new EventSource('/api/room-events?code=' + encodeURIComponent(room.seat.code));
    stream = source;
    source.addEventListener('open', () => {
      if (stream !== source) return;
      announce(true);
      schedule();
    });
    source.addEventListener('error', () => {
      if (stream !== source) return;
      announce(false);
      // A refused stream (room closed, kicked, signed out) does not retry;
      // a normal read then reports why, and polling resumes its own pace.
      if (source.readyState === EventSource.CLOSED) stream = null;
      void refresh();
    });
    source.addEventListener('state', (event) => {
      if (stream !== source || scope !== room.scope || disposed) return;
      try {
        accept(JSON.parse((event as MessageEvent<string>).data));
      } catch (cause) {
        room.lostConnection(cause);
      }
    });
    for (const kind of ['chat', 'invitations'])
      source.addEventListener(kind, () =>
        window.dispatchEvent(new CustomEvent('bga:room-event', { detail: { kind } })),
      );
  }
  function stop() {
    if (timer) clearTimeout(timer);
    timer = null;
    job?.controller.abort();
    job = null;
    reading.value = false;
  }
  function schedule(delay = streamLive ? Math.max(pollMs, STREAM_POLL_MS) : pollMs) {
    if (timer) clearTimeout(timer);
    timer = null;
    if (!disposed && room.seat && !room.terminal && !document.hidden)
      timer = setTimeout(() => {
        timer = null;
        void refresh();
      }, delay);
  }
  async function refresh(): Promise<boolean> {
    if (disposed || !room.seat || room.terminal || document.hidden) return false;
    if (job?.promise) return job.promise;
    const scope = room.scope,
      next = { controller: new AbortController(), promise: null as Promise<boolean> | null };
    job = next;
    reading.value = true;
    const timeout = setTimeout(
      () =>
        next.controller.abort(new DOMException('房間狀態讀取逾時，正在重新連接。', 'TimeoutError')),
      10000,
    );
    next.promise = (async () => {
      try {
        const value = await room.request('state', undefined, {
          signal: next.controller.signal,
          ...(stateTag ? { query: { since: stateTag } } : {}),
        });
        if (disposed || scope !== room.scope || job !== next || next.controller.signal.aborted)
          return false;
        const accepted = accept(value);
        openStream();
        return accepted;
      } catch (cause) {
        if (
          !disposed &&
          scope === room.scope &&
          job === next &&
          !(cause instanceof DOMException && cause.name === 'AbortError')
        )
          room.lostConnection(cause);
        return false;
      } finally {
        clearTimeout(timeout);
        if (job === next) {
          job = null;
          reading.value = false;
          schedule();
        }
      }
    })();
    return next.promise;
  }
  async function enter() {
    if (entryBusy.value || disposed) return;
    entryBusy.value = true;
    entryError.value = '';
    try {
      const seat = readSeat(
        await requests.run(async (signal) => {
          const controller = new AbortController(),
            timeout = setTimeout(
              () =>
                controller.abort(
                  new DOMException('入座結果尚未確認，請先重新整理確認座位。', 'TimeoutError'),
                ),
              10000,
            );
          try {
            return await requestJson('/api/' + (entryCode.value ? 'join' : 'create'), {
              method: 'POST',
              body: { type, ...(entryCode.value ? { code: entryCode.value } : {}) },
              signal: AbortSignal.any([signal, controller.signal]),
            });
          } finally {
            clearTimeout(timeout);
          }
        }),
      );
      if (seat.type !== type) {
        location.assign('/' + gamePath(seat.type) + '/' + seat.code);
        return;
      }
      entryCode.value = seat.code;
      history.replaceState(null, '', '/' + gamePath(type) + '/' + seat.code);
      await room.open(seat.code, type, reader);
    } catch (cause) {
      if (!disposed && !(cause instanceof DOMException && cause.name === 'AbortError'))
        entryError.value = cause instanceof Error ? cause.message : '無法入座。';
    } finally {
      if (!disposed) entryBusy.value = false;
    }
  }
  function visibility() {
    foreground.value = !document.hidden;
    if (document.hidden) {
      stop();
      closeStream();
    } else if (room.seat) {
      void refresh();
      streamTried = 0;
      openStream();
    }
  }
  watch(
    () => [room.scope, room.seat?.code],
    () => {
      stop();
      closeStream();
      stateTag = '';
      streamTried = 0;
      if (room.seat) {
        void refresh();
        openStream();
      }
    },
  );
  watch(
    () => room.terminal,
    (value) => {
      if (value) {
        stop();
        closeStream();
      }
    },
  );
  watch(
    () => room.busy,
    (value, previous) => {
      if (!value && previous) void refresh();
    },
  );
  onMounted(() => {
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('online', visibility);
    if (entryCode.value)
      void room.open(entryCode.value, type, reader).catch((cause) => {
        if (!disposed) entryError.value = cause instanceof Error ? cause.message : '無法恢復座位。';
      });
  });
  onBeforeUnmount(() => {
    disposed = true;
    stop();
    closeStream();
    document.removeEventListener('visibilitychange', visibility);
    window.removeEventListener('online', visibility);
  });
  return { room, session, entryCode, entryBusy, entryError, connected, reading, enter, refresh };
}
