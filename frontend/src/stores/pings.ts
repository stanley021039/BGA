import AudioSettings from '../engines/audio-settings.js';
import PingModel from '../engines/ping-model.js';
import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue';
import { defineStore } from 'pinia';
import { useInteractionSource } from '../services/interaction-source';
import { useSessionStore } from './session';
import { requestJson } from '../services/http';
import { readSettings } from '../contracts/profile';
import { readPingContext, readPingReceipt } from '../contracts/pings';
import type { PingEvent, PingTarget, PingType } from '../contracts/pings';
import { record } from '../services/validation';

export const usePingsStore = defineStore('room-pings', () => {
  const room = useInteractionSource(),
    session = useSessionStore(),
    model = PingModel;
  if (!model) throw Error('標記工具無法載入。');
  const context = computed(() => {
    try {
      return readPingContext(room.snapshot.value?.pingContext);
    } catch {
      return null;
    }
  });
  const identity = computed(() =>
    room.identity.value && context.value
      ? `${room.identity.value}:${context.value.roomInstanceId}`
      : '',
  );
  const connected = ref(false),
    enabled = ref(true),
    notice = ref(''),
    failed = ref(false),
    marks = shallowRef<PingEvent[]>([]),
    preferences = shallowRef(model.preferences());
  const seen = new Set<string>(),
    requests = new Set<AbortController>();
  let source: EventSource | null = null,
    generation = 0,
    preferenceGeneration = 0,
    offset = 0,
    disposed = false,
    expiry: ReturnType<typeof setTimeout> | null = null,
    noticeTimer: ReturnType<typeof setTimeout> | null = null;
  function feedback(value: string, error = false) {
    notice.value = value;
    failed.value = error;
    if (noticeTimer) clearTimeout(noticeTimer);
    noticeTimer = value
      ? setTimeout(() => {
          notice.value = '';
          noticeTimer = null;
        }, 3500)
      : null;
  }
  function clear() {
    marks.value = [];
    if (expiry) clearTimeout(expiry);
    expiry = null;
  }
  function expire() {
    if (expiry) clearTimeout(expiry);
    const now = Date.now() - offset;
    marks.value = marks.value.filter((mark) => mark.expiresAt > now);
    if (marks.value.length)
      expiry = setTimeout(
        expire,
        Math.max(1, Math.min(...marks.value.map((mark) => mark.expiresAt)) - now),
      );
    else expiry = null;
  }
  function receive(value: unknown) {
    const receipt = readPingReceipt(value),
      event = receipt.event;
    if (
      !identity.value ||
      event.roomInstanceId !== context.value?.roomInstanceId ||
      seen.has(event.id)
    )
      return;
    seen.add(event.id);
    while (seen.size > 256) seen.delete(seen.values().next().value!);
    if (
      !enabled.value ||
      document.hidden ||
      event.expiresAt <= receipt.serverNow ||
      receipt.serverNow - event.at > 5000 ||
      receipt.serverNow < event.at - 1000
    )
      return;
    offset = Date.now() - receipt.serverNow;
    marks.value = [...marks.value, event].slice(-8);
    expire();
    feedback(event.name + '：' + model!.types[event.type].label);
    const sound = preferences.value[event.type].sound;
    if (sound && 'effect' in sound) AudioSettings?.playEffect?.(sound.effect);
    else if (sound) AudioSettings?.playExpression(sound);
  }
  function disconnect() {
    generation++;
    source?.close();
    source = null;
    connected.value = false;
    for (const controller of requests) controller.abort();
    requests.clear();
    clear();
  }
  function connect() {
    if (disposed || !identity.value || !context.value || source || document.hidden) return;
    const epoch = generation,
      id = context.value.roomInstanceId,
      stream = new EventSource('/api/pings/events?code=' + encodeURIComponent(room.code.value));
    source = stream;
    stream.addEventListener('ready', (event) => {
      if (source !== stream || epoch !== generation) return;
      try {
        const data = record(JSON.parse((event as MessageEvent).data));
        if (data.roomInstanceId !== id) {
          disconnect();
          feedback('標記房間已更新，等待房間重新同步。', true);
          return;
        }
        if (typeof data.serverNow !== 'number' || !Number.isFinite(data.serverNow))
          throw Error('標記時間資料不正確。');
        offset = Date.now() - data.serverNow;
        connected.value = true;
      } catch {
        connected.value = false;
        feedback('標記連線資料暫時無法讀取。', true);
      }
    });
    stream.addEventListener('ping', (event) => {
      if (source === stream && epoch === generation && connected.value)
        try {
          receive(JSON.parse((event as MessageEvent).data));
        } catch {
          feedback('這筆標記暫時無法顯示。', true);
        }
    });
    stream.onerror = () => {
      if (source === stream) {
        connected.value = false;
        clear();
      }
    };
  }
  async function send(type: PingType, target: PingTarget) {
    const current = context.value,
      epoch = generation,
      id = identity.value;
    if (!current || !id || disposed || document.hidden) return false;
    const controller = new AbortController();
    requests.add(controller);
    const timer = setTimeout(
      () => controller.abort(new DOMException('標記傳送結果尚未確認。', 'TimeoutError')),
      10000,
    );
    try {
      const value = await room.request(
        'pings',
        {
          type,
          target,
          requestId: crypto.randomUUID(),
          roomInstanceId: current.roomInstanceId,
          scene: current.scene,
        },
        { signal: controller.signal, affectsConnection: false },
      );
      if (
        disposed ||
        epoch !== generation ||
        id !== identity.value ||
        current.scene !== context.value?.scene
      )
        return false;
      receive(value);
      return true;
    } catch (cause) {
      if (
        !disposed &&
        epoch === generation &&
        id === identity.value &&
        current.scene === context.value?.scene &&
        !(cause instanceof DOMException && cause.name === 'AbortError')
      )
        feedback(cause instanceof Error ? cause.message : '標記傳送失敗。', true);
      return false;
    } finally {
      clearTimeout(timer);
      requests.delete(controller);
    }
  }
  function setPreferences(value?: unknown) {
    preferences.value = model!.preferences(value);
  }
  async function loadPreferences() {
    const account = session.user?.id,
      revision = ++preferenceGeneration;
    setPreferences();
    if (!account) return;
    try {
      const value = readSettings(await requestJson('/api/profile/settings'));
      if (!disposed && revision === preferenceGeneration && account === session.user?.id)
        setPreferences(value.pings);
    } catch {
      if (!disposed && revision === preferenceGeneration && account === session.user?.id)
        feedback('個人標記外觀暫時無法載入，已使用預設設定。', true);
    }
  }
  watch(
    () => session.user?.id,
    () => {
      void loadPreferences();
    },
    { immediate: true },
  );
  const profileUpdated = () => {
    void loadPreferences();
  };
  window.addEventListener('profile-updated', profileUpdated);
  const bridge = {
    setPreferences,
    disconnect,
    stop() {
      disconnect();
      setPreferences();
    },
  };
  window.RoomPings = bridge;
  watch(
    identity,
    () => {
      disconnect();
      seen.clear();
      feedback('');
      if (identity.value) connect();
    },
    { immediate: true, flush: 'sync' },
  );
  watch(
    () => context.value?.scene,
    () => {
      for (const controller of requests) controller.abort();
      requests.clear();
    },
  );
  watch(enabled, (value) => {
    if (!value) clear();
  });
  function visibility() {
    if (document.hidden) disconnect();
    else connect();
  }
  document.addEventListener('visibilitychange', visibility);
  onScopeDispose(() => {
    disposed = true;
    preferenceGeneration++;
    window.removeEventListener('profile-updated', profileUpdated);
    disconnect();
    if (noticeTimer) clearTimeout(noticeTimer);
    document.removeEventListener('visibilitychange', visibility);
    if (window.RoomPings === bridge) delete window.RoomPings;
  });
  return {
    context,
    identity,
    surface: room.snapshot,
    connected,
    enabled,
    notice,
    failed,
    marks,
    preferences,
    types: model.types,
    model,
    send,
    feedback,
    clear,
    setPreferences,
  };
});
