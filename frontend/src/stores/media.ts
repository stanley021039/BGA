import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue';
import { defineStore } from 'pinia';
import { useRoomStore } from './room';
import { ApiError } from '../services/http';
import { record } from '../services/validation';
import { readMusicLibrary } from '../contracts/libraries';
import type { Track } from '../contracts/libraries';
import { mediaCurrentKey, mediaMarkerKey, mediaPlaybackKey, mediaPosition, readMediaMarker, readMediaSnapshot } from '../contracts/media';
import type { MediaAction, MediaMarker, MediaOrderIntent, MediaSnapshot } from '../contracts/media';

// Sole owner of shared media state. Window geometry, consent and native playback are personal.
export const useMediaStore = defineStore('room-media', () => {
  const room = useRoomStore(), snapshot = shallowRef<MediaSnapshot | null>(null), marker = shallowRef<MediaMarker | null>(null);
  const busy = ref(false), loading = ref(false), message = ref(''), failed = ref(false), tracks = shallowRef<Track[]>([]), libraryLoading = ref(false), libraryError = ref('');
  const receivedAt = ref(0), serverAt = ref(0), receipt = ref(0);
  const enabled = computed(() => !!room.seat && !!room.snapshot && !room.terminal);
  const context = computed(() => enabled.value ? `${room.scope}:${room.code}:${room.snapshot!.me}` : '');
  const canControl = computed(() => enabled.value && !!snapshot.value?.canControl && (room.snapshot?.permissions ? record(room.snapshot.permissions).canManageMedia === true : true));
  const canManageQueue = computed(() => canControl.value && !!snapshot.value?.canManageQueue);
  let generation = 0, sequence = 0, accepted = 0, disposed = false, librarySequence = 0;
  let read: { controller: AbortController; promise: Promise<boolean>; key: string } | null = null, pendingForce = false;
  let retry: { key: string; attempts: number; after: number; permanent: boolean } | null = null;
  let retryCommand: { shape: string; body: Record<string, unknown> } | null = null;
  const requests = new Set<AbortController>(), automaticSeen = new Set<string>();
  const automaticPending: { action: 'duration' | 'ended'; extra: Record<string, unknown>; generation: number; key: string; playback: string }[] = [];
  function feedback(text: string, error = false) { message.value = text; failed.value = error; }
  function current(epoch: number) { return !disposed && epoch === generation && !!context.value; }
  function serverNow() { return serverAt.value + Math.max(0, performance.now() - receivedAt.value); }
  function position() { return mediaPosition(snapshot.value, serverNow()); }
  function accept(value: unknown, tag: { epoch: number; sequence: number; sent: number }) {
    if (!current(tag.epoch)) return false;
    const next = readMediaSnapshot(value), before = snapshot.value;
    if (next.myPlayerId !== room.snapshot?.me) { room.invalidateIdentity('媒體座位已更新，請重新連線。'); return false; }
    if (marker.value && (next.roomInstanceId !== marker.value.roomInstanceId || next.revision < marker.value.revision)) return false;
    if (before && (before.roomInstanceId !== next.roomInstanceId || next.revision < before.revision || next.revision === before.revision && tag.sequence < accepted)) return false;
    const previousKey = mediaCurrentKey(before);
    accepted = tag.sequence; receivedAt.value = performance.now(); serverAt.value = next.serverNowMs + Math.max(0, receivedAt.value - tag.sent) / 2;
    snapshot.value = next; marker.value = { roomInstanceId: next.roomInstanceId, revision: next.revision, hasCurrent: !!next.current }; receipt.value++;
    if (previousKey !== mediaCurrentKey(next)) automaticPending.length = 0;
    return true;
  }
  function cancelSnapshot() { read?.controller.abort(); read = null; loading.value = false; pendingForce = false; retry = null; }
  async function load(force = false): Promise<boolean> {
    if (!enabled.value || disposed) return false;
    if (read) { if (force) pendingForce = true; return read.promise; }
    const key = mediaMarkerKey(marker.value);
    if (!force && snapshot.value && mediaMarkerKey(snapshot.value) === key) return false;
    if (!force && retry?.key === key && (retry.permanent || retry.attempts >= 3 || performance.now() < retry.after)) return false;
    if (force || retry?.key !== key) retry = { key, attempts: 0, after: 0, permanent: false };
    const budget = retry!; budget.attempts++;
    const tag = { epoch: generation, sequence: ++sequence, sent: performance.now() }, controller = new AbortController(); requests.add(controller);
    const job = { key, controller, promise: Promise.resolve(false) }; read = job; loading.value = true;
    const timer = setTimeout(() => controller.abort(new DOMException('媒體暫時無法連線，請重新開啟重試。', 'TimeoutError')), 10000);
    job.promise = (async () => {
      try {
        const result = await room.request('room-media', undefined, { signal: controller.signal });
        if (read !== job || !current(tag.epoch)) return false;
        if (accept(result, tag)) { if (retry === budget) retry = null; return true; }
        if (mediaMarkerKey(snapshot.value) === mediaMarkerKey(marker.value)) return false;
        throw Error('媒體回覆尚未追上最新狀態，等待重新同步。');
      } catch (cause) {
        if (read === job && current(tag.epoch) && !(cause instanceof DOMException && cause.name === 'AbortError') && !(snapshot.value && tag.sequence < accepted && mediaMarkerKey(snapshot.value) === mediaMarkerKey(marker.value))) {
          budget.permanent = cause instanceof ApiError && cause.status >= 400 && cause.status < 500 && ![408, 429].includes(cause.status);
          budget.after = performance.now() + ([1000, 4000][budget.attempts - 1] || 0); feedback(cause instanceof Error ? cause.message : '無法取得媒體狀態。', true);
        }
        return false;
      } finally {
        clearTimeout(timer); requests.delete(controller);
        if (read === job) { read = null; loading.value = false; const forceNext = pendingForce; pendingForce = false;
          if (current(tag.epoch) && (forceNext || key !== mediaMarkerKey(marker.value) && mediaMarkerKey(snapshot.value) !== mediaMarkerKey(marker.value))) void load(forceNext);
        }
      }
    })();
    return job.promise;
  }
  async function library() {
    if (!enabled.value) return false;
    const epoch = generation, request = ++librarySequence, controller = new AbortController(); requests.add(controller); libraryLoading.value = true; libraryError.value = '';
    const timer = setTimeout(() => controller.abort(new DOMException('音樂庫載入逾時，請重試。', 'TimeoutError')), 10000);
    try { const value = readMusicLibrary(await room.request('music', undefined, { signal: controller.signal })); if (!current(epoch) || request !== librarySequence) return false; tracks.value = value.tracks; return true; }
    catch (cause) { if (current(epoch) && request === librarySequence && !(cause instanceof DOMException && cause.name === 'AbortError')) libraryError.value = cause instanceof Error ? cause.message : '音樂庫載入失敗。'; return false; }
    finally { clearTimeout(timer); requests.delete(controller); if (current(epoch) && request === librarySequence) libraryLoading.value = false; }
  }
  async function command(action: MediaAction, extra: Record<string, unknown> = {}, automatic = false): Promise<boolean> {
    const state = snapshot.value;
    if (!enabled.value || !state || busy.value || action !== 'enqueue' && !canControl.value) return false;
    const shape = JSON.stringify([action, extra, state.roomInstanceId, state.playbackSessionId, state.revision]);
    let body: Record<string, unknown>;
    try { body = retryCommand?.shape === shape ? retryCommand.body : { ...extra, action, requestId: crypto.randomUUID(), roomInstanceId: state.roomInstanceId, playbackSessionId: state.playbackSessionId, expectedRevision: state.revision }; }
    catch { feedback('此瀏覽器無法安全建立操作識別碼，請使用支援安全連線的瀏覽器。', true); return false; }
    const tag = { epoch: generation, sequence: ++sequence, sent: performance.now() }, controller = new AbortController(); requests.add(controller); busy.value = true;
    if (!automatic) feedback('正在送出…');
    const timer = setTimeout(() => controller.abort(new DOMException('未收到媒體操作結果。', 'TimeoutError')), 10000);
    try {
      const value = await room.request('room-media', body, { signal: controller.signal });
      if (!current(tag.epoch)) return false;
      retryCommand = null;
      if (!accept(value, tag)) { feedback('媒體狀態已更新，請確認最新內容。', true); return false; }
      if (!automatic) feedback(action === 'enqueue' ? '已加入播放清單。' : '全桌媒體已更新。'); return true;
    } catch (cause) {
      if (!current(tag.epoch) || cause instanceof DOMException && cause.name === 'AbortError') return false;
      if (cause instanceof ApiError && cause.status >= 400) {
        retryCommand = null; const state = cause.payload && typeof cause.payload === 'object' && !Array.isArray(cause.payload) ? record(cause.payload).state : undefined;
        if (state) try { accept(state, tag); } catch { /* Retain the last validated snapshot. */ }
        feedback(cause.status === 409 ? '清單或播放狀態已更新，請確認後重新操作。' : cause.message, true);
      } else { if (!automatic) retryCommand = { shape, body }; feedback('未收到操作結果；再按同一操作可安全重試，或重新開啟媒體查看最新狀態。', true); }
      return false;
    } finally { clearTimeout(timer); requests.delete(controller); if (current(tag.epoch)) { busy.value = false; flushAutomatic(); } }
  }
  function report(action: 'duration' | 'ended', extra: Record<string, unknown>) {
    const state = snapshot.value;
    if (!canControl.value || !state?.current || extra.itemId !== state.current.id || action === 'duration' && state.current.durationSec || action === 'ended' && (state.playback.state !== 'playing' || !state.current.durationSec || position() < state.current.durationSec - 2)) return;
    const key = `${mediaCurrentKey(state)}:${state.revision}:${action}`; if (automaticSeen.has(key)) return;
    automaticSeen.add(key); while (automaticSeen.size > 256) automaticSeen.delete(automaticSeen.values().next().value!);
    if (busy.value) { automaticPending.push({ action, extra, generation, key: mediaCurrentKey(state), playback: mediaPlaybackKey(state) }); if (automaticPending.length > 8) automaticPending.shift(); }
    else void command(action, extra, true);
  }
  function flushAutomatic() {
    while (!busy.value && automaticPending.length) { const item = automaticPending.shift()!;
      if (item.generation !== generation || item.key !== mediaCurrentKey(snapshot.value) || item.action === 'ended' && item.playback !== mediaPlaybackKey(snapshot.value)) continue;
      // Recheck permissions, duration and shared time before a queued report.
      const state = snapshot.value;
      if (!canControl.value || !state?.current || item.action === 'duration' && state.current.durationSec || item.action === 'ended' && (state.playback.state !== 'playing' || !state.current.durationSec || position() < state.current.durationSec - 2)) continue;
      void command(item.action, item.extra, true); break;
    }
  }
  function orderIntent(itemId: string): MediaOrderIntent | null { const state = snapshot.value; return canManageQueue.value && state?.queue.some(item => item.id === itemId) ? { scope: room.scope, itemId, roomInstanceId: state.roomInstanceId, session: state.playbackSessionId, revision: state.revision, orderIds: state.queue.map(item => item.id) } : null; }
  function validOrder(intent: MediaOrderIntent | null) { const state = snapshot.value; return !!intent && canManageQueue.value && !busy.value && intent.scope === room.scope && intent.roomInstanceId === state?.roomInstanceId && intent.session === state?.playbackSessionId && intent.revision === state?.revision && JSON.stringify(intent.orderIds) === JSON.stringify(state?.queue.map(item => item.id)); }
  async function reorder(intent: MediaOrderIntent, targetId: string) {
    if (!validOrder(intent)) { feedback('清單已更新，請確認後重新拖曳。', true); return false; }
    const orderIds = [...intent.orderIds], from = orderIds.indexOf(intent.itemId), to = orderIds.indexOf(targetId);
    if (from < 0 || to < 0 || from === to) return false; orderIds.splice(from, 1); orderIds.splice(to, 0, intent.itemId);
    return command('reorder', { orderIds });
  }
  function reset() { generation++; cancelSnapshot(); for (const controller of requests) controller.abort(); requests.clear(); librarySequence++; busy.value = libraryLoading.value = false; snapshot.value = marker.value = null; tracks.value = []; libraryError.value = ''; feedback(''); retryCommand = null; automaticSeen.clear(); automaticPending.length = 0; accepted = 0; }
  function sync() {
    if (!enabled.value || disposed) return;
    try { const incoming = readMediaMarker(room.snapshot?.media); if (incoming && (!marker.value || incoming.revision >= marker.value.revision)) marker.value = incoming; void load(); }
    catch (cause) { feedback(cause instanceof Error ? cause.message : '媒體狀態不正確。', true); }
  }
  watch(context, () => { reset(); sync(); }, { flush: 'sync', immediate: true });
  watch(() => room.snapshot, sync);
  onScopeDispose(() => { disposed = true; reset(); });
  return { snapshot, marker, busy, loading, message, failed, enabled, context, canControl, canManageQueue, tracks, libraryLoading, libraryError,
    connected: computed(() => room.connected), receivedAt, serverAt, receipt, position, serverNow, load, library, command, report, cancelSnapshot, orderIntent, validOrder, reorder };
});
