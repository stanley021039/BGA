import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoomStore } from '../stores/room';
import { useSessionStore } from '../stores/session';
import { useRequests } from './requests';
import { gamePath, readSeat, type GameType, type RoomSnapshot } from '../contracts/room';
import { requestJson } from '../services/http';

// The party games retain their existing two-second state protocol, without a second controller.
export function useRoomPage(type: GameType, reader: (value: unknown) => RoomSnapshot) {
  const room = useRoomStore(), session = useSessionStore(), requests = useRequests();
  const match = new RegExp('^/' + gamePath(type) + '/([a-f0-9]{6})/?$','i').exec(location.pathname);
  const entryCode = ref(match?.[1]?.toUpperCase() || ''), entryBusy = ref(false), entryError = ref(''), reading = ref(false);
  const foreground = ref(!document.hidden), connected = computed(() => room.connected && !!room.snapshot && foreground.value);
  let disposed = false, timer: ReturnType<typeof setTimeout> | null = null, job: { controller: AbortController; promise: Promise<boolean> | null } | null = null;
  function stop() { if (timer) clearTimeout(timer); timer = null; job?.controller.abort(); job = null; reading.value = false; }
  function schedule(delay = 2000) { if (timer) clearTimeout(timer); timer = null; if (!disposed && room.seat && !room.terminal && !document.hidden) timer = setTimeout(() => { timer = null; void refresh(); }, delay); }
  async function refresh(): Promise<boolean> {
    if (disposed || !room.seat || room.terminal || document.hidden) return false;
    if (job?.promise) return job.promise;
    const scope = room.scope, next = { controller:new AbortController(), promise:null as Promise<boolean> | null }; job = next; reading.value = true;
    const timeout = setTimeout(() => next.controller.abort(new DOMException('房間狀態讀取逾時，正在重新連接。','TimeoutError')),10000);
    next.promise = (async () => { try {
      const value = await room.request('state',undefined,{ signal:next.controller.signal });
      return !disposed && scope === room.scope && job === next && !next.controller.signal.aborted ? room.accept(value) : false;
    } catch (cause) { if (!disposed && scope === room.scope && job === next && !(cause instanceof DOMException && cause.name === 'AbortError')) room.lostConnection(cause); return false; }
    finally { clearTimeout(timeout); if (job === next) { job = null; reading.value = false; schedule(); } } })();
    return next.promise;
  }
  async function enter() {
    if (entryBusy.value || disposed) return; entryBusy.value = true; entryError.value = '';
    try {
      const seat = readSeat(await requests.run(async signal => {
        const controller = new AbortController(), timeout = setTimeout(() => controller.abort(new DOMException('入座結果尚未確認，請先重新整理確認座位。','TimeoutError')),10000);
        try { return await requestJson('/api/' + (entryCode.value ? 'join':'create'), { method:'POST',body:{ type,...(entryCode.value ? { code:entryCode.value }:{}) },signal:AbortSignal.any([signal,controller.signal]) }); } finally { clearTimeout(timeout); }
      }));
      if (seat.type !== type) { location.assign('/' + gamePath(seat.type) + '/' + seat.code); return; }
      entryCode.value = seat.code; history.replaceState(null,'','/' + gamePath(type) + '/' + seat.code); await room.open(seat.code,type,reader);
    } catch (cause) { if (!disposed && !(cause instanceof DOMException && cause.name === 'AbortError')) entryError.value = cause instanceof Error ? cause.message:'無法入座。'; }
    finally { if (!disposed) entryBusy.value = false; }
  }
  function visibility() { foreground.value = !document.hidden; if (document.hidden) stop(); else if (room.seat) void refresh(); }
  watch(() => [room.scope,room.seat?.code], () => { stop(); if (room.seat) void refresh(); });
  watch(() => room.terminal, value => { if (value) stop(); });
  watch(() => room.busy, (value,previous) => { if (!value && previous) void refresh(); });
  onMounted(() => { document.addEventListener('visibilitychange',visibility); window.addEventListener('online',visibility); if (entryCode.value) void room.open(entryCode.value,type,reader).catch(cause => { if (!disposed) entryError.value = cause instanceof Error ? cause.message:'無法恢復座位。'; }); });
  onBeforeUnmount(() => { disposed = true; stop(); document.removeEventListener('visibilitychange',visibility); window.removeEventListener('online',visibility); });
  return { room, session, entryCode, entryBusy, entryError, connected, reading, enter, refresh };
}
