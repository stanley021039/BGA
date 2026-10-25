import AudioSettings from '../engines/audio-settings.js';
import { defineStore } from 'pinia';
import { computed, onScopeDispose, reactive, ref, shallowRef, watch } from 'vue';
import { useRoomStore } from './room';
import { useQueuedSave } from '../composables/queued-save';
import { useResource } from '../composables/resource';
import { ApiError } from '../services/http';
import { readMajorityLibrary, questionDraft } from '../contracts/majority';
import type { MajoritySnapshot, MajorityOptions, MajorityKind } from '../contracts/majority';
export const useMajorityStore = defineStore('majority', () => {
  const room = useRoomStore(),
    state = computed(() => room.snapshot as MajoritySnapshot | null),
    setup = computed(() => !!state.value && ['waiting', 'finished'].includes(state.value.phase)),
    editable = computed(() => room.host && setup.value && !room.terminal);
  const settings = reactive<MajorityOptions>({
      mode: 'majority',
      rounds: 10,
      customPercent: null,
      cruelRules: 'teams',
      cruelScoring: 'majority',
      theme: 'all',
      bracketSize: 16,
    }),
    canonical = ref('');
  const settingsKey = (o: MajorityOptions) =>
      JSON.stringify(
        ['music', 'scenario'].includes(o.mode)
          ? { mode: o.mode, theme: o.theme, bracketSize: o.bracketSize }
          : o.mode === 'cruel'
            ? { ...o, rounds: 10 }
            : { mode: 'majority', rounds: o.rounds, customPercent: o.customPercent },
      ),
    dirty = computed(() => !!canonical.value && settingsKey(settings) !== canonical.value);
  const save = useQueuedSave<MajorityOptions>({
    allowed: () => editable.value,
    blocked: () => room.busy,
    save: (value) => room.command('settings', { ...value }),
    failure: () => room.message,
  });
  watch(
    [() => JSON.stringify(state.value?.options), editable, () => room.scope],
    () => {
      const o = state.value?.options;
      if (!o) return;
      const adopt = !canonical.value || !editable.value || (!save.pending.value && !dirty.value);
      canonical.value = settingsKey(o);
      if (adopt) Object.assign(settings, o);
      if (!editable.value) save.reset();
    },
    { immediate: true },
  );
  function queue() {
    if (!editable.value) return;
    if (['music', 'scenario'].includes(settings.mode)) {
      if (state.value?.options.mode !== settings.mode)
        settings.theme = settings.mode === 'music' ? 'all' : 'work';
      settings.rounds = (settings.bracketSize || 16) - 1;
      save.enqueue({ ...settings });
      return;
    }
    if (settings.mode === 'cruel') settings.rounds = 10;
    if (!Number.isInteger(settings.rounds) || settings.rounds < 3 || settings.rounds > 30) {
      save.invalidate('題數請輸入 3 至 30 的整數。');
      return;
    }
    save.enqueue({ ...settings });
  }
  const canStart = computed(() => {
    const s = state.value;
    if (!s) return false;
    const n = s.players.length;
    return settings.mode === 'cruel'
      ? settings.cruelRules === 'teams'
        ? [4, 6, 8].includes(n)
        : n >= 1 && n <= 12
      : n >= 3 && n <= 12;
  });
  async function start() {
    if (!editable.value || !canStart.value) return;
    if (dirty.value && !save.pending.value) queue();
    if ((await save.flush()) && !save.error.value) await room.command('start', {});
  }
  const source = ref<'bank' | 'custom'>('bank'),
    topic = ref('food'),
    kind = ref<MajorityKind>('two'),
    choice = ref<number | null>(null),
    draft = ref('');
  const custom = reactive({
      type: 'two' as MajorityKind,
      topic: 'daily',
      prompt: '',
      options: ['', '', ''],
    }),
    prepared = reactive({
      type: 'two' as MajorityKind,
      topic: 'daily',
      prompt: '',
      options: ['', '', ''],
    });
  const mergeFrom = ref(''),
    mergeTo = ref(''),
    pending = ref(false),
    message = ref(''),
    failed = ref(false),
    uncertain = ref(false);
  const context = computed(() => {
    const s = state.value;
    return s
      ? `${room.scope}:${s.round}:${s.phase}:${s.presenterId}:${JSON.stringify(s.question)}`
      : '';
  });
  const canAsk = computed(
    () =>
      state.value?.phase === 'choosing' &&
      state.value.presenterId === state.value.me &&
      !state.value.cruel &&
      !state.value.players.find((p) => p.id === state.value?.me)?.waitingForNextRound,
  );
  const participant = computed(() => !!state.value?.participantIds.includes(state.value.me));
  const clock = ref(Date.now()),
    server = ref(Date.now()),
    offset = computed(() => clock.value - server.value),
    expired = computed(() => !!state.value?.deadline && server.value >= state.value.deadline);
  let timer: ReturnType<typeof setInterval> | undefined,
    anchor = Date.now(),
    at = performance.now(),
    disposed = false,
    controller: AbortController | undefined,
    turn = '';
  function tick() {
    clock.value = Date.now();
    server.value = anchor + performance.now() - at;
  }
  function stopClock() {
    clearInterval(timer);
    timer = undefined;
  }
  watch(
    state,
    (s) => {
      if (!s) return;
      anchor = s.serverNow;
      at = performance.now();
      tick();
      stopClock();
      if (s.phase === 'answering' && !document.hidden) timer = setInterval(tick, 250);
      const next = `${room.scope}:${s.round}:${s.question ? JSON.stringify(s.question) : 'choosing'}`;
      if (next !== turn) {
        turn = next;
        choice.value = null;
        draft.value = '';
        message.value = '';
        failed.value = false;
        uncertain.value = false;
      }
      if (!s.groups.some((g) => g.id === mergeFrom.value)) mergeFrom.value = s.groups[0]?.id || '';
      if (!s.groups.some((g) => g.id === mergeTo.value))
        mergeTo.value = s.groups.find((g) => g.id !== mergeFrom.value)?.id || '';
    },
    { immediate: true },
  );
  async function refresh() {
    if (pending.value || !room.seat || room.terminal) return false;
    const epoch = room.scope,
      request = new AbortController();
    controller = request;
    pending.value = true;
    room.busy = true;
    message.value = '正在更新房間狀態…';
    const timeout = setTimeout(
      () => request.abort(new DOMException('更新逾時，請稍後再試。', 'TimeoutError')),
      10000,
    );
    try {
      const value = await room.request('state', undefined, { signal: request.signal });
      room.accept(value);
      if (disposed || epoch !== room.scope || room.terminal) return false;
      uncertain.value = false;
      message.value = '房間狀態已更新，請確認目前進度再操作。';
      failed.value = false;
      return true;
    } catch (error) {
      if (!disposed && epoch === room.scope) {
        message.value = error instanceof Error ? error.message : '無法更新房間';
        failed.value = true;
      }
      return false;
    } finally {
      clearTimeout(timeout);
      if (controller === request) {
        controller = undefined;
        pending.value = false;
        if (epoch === room.scope) room.busy = false;
      }
    }
  }

  // Majority has no request-id receipt support. Never automatically replay a write.
  async function act(
    action: string,
    data: Record<string, unknown> = {},
    expected = context.value,
  ): Promise<boolean> {
    if (
      disposed ||
      pending.value ||
      room.busy ||
      !room.seat ||
      room.terminal ||
      uncertain.value ||
      expected !== context.value
    )
      return false;
    const s = state.value;
    if (!s) return false;
    if (
      ['answer', 'withdraw', 'replace'].includes(action) &&
      (!participant.value || s.phase !== 'answering' || expired.value)
    )
      return false;
    const epoch = room.scope,
      request = new AbortController();
    controller = request;
    pending.value = true;
    room.busy = true;
    failed.value = false;
    message.value = '正在送出…';
    const timeout = setTimeout(
      () => request.abort(new DOMException('送出結果尚未確認，請先更新房間狀態。', 'TimeoutError')),
      10000,
    );
    try {
      const payload = structuredClone({
        ...data,
        action,
        ...((s.cruel || s.tournament) && ['answer', 'withdraw', 'replace'].includes(action)
          ? { questionId: s.question?.id }
          : {}),
      });
      const value = await room.request('action', payload, { signal: request.signal });
      if (disposed || epoch !== room.scope) return false;
      room.accept(value);
      if (room.terminal) return false;
      message.value =
        (
          {
            answer: '答案已鎖定。',
            withdraw: '已收回答案。',
            enqueue: '已加入預備題目。',
            unqueue: '已移除預備題目。',
            merge: '答案組已合併，尚未計分。',
            resetGroups: '已還原原始分組。',
            score: '已確認計分。',
          } as Record<string, string>
        )[action] || '操作已完成。';
      if (action === 'answer' && room.connected && !document.hidden) {
        AudioSettings?.stopEffect(sound);
        sound = AudioSettings?.playEffect?.('confirm');
      }
      return true;
    } catch (error) {
      if (!disposed && epoch === room.scope) {
        failed.value = true;
        message.value = error instanceof Error ? error.message : '操作失敗';
        uncertain.value = !(error instanceof ApiError) || error.status === 0 || error.status >= 500;
      }
      return false;
    } finally {
      clearTimeout(timeout);
      if (controller === request) {
        controller = undefined;
        pending.value = false;
        if (epoch === room.scope) room.busy = false;
      }
    }
  }
  async function answer() {
    const s = state.value;
    if (!s || s.ownAnswer !== null) return false;
    let answer: string | number;
    if (s.question?.type === 'blank') {
      answer = draft.value.trim();
      if (!answer || answer.length > 60) {
        message.value = '答案需為 1 至 60 字';
        failed.value = true;
        return false;
      }
    } else {
      if (choice.value === null) return false;
      answer = choice.value;
    }
    return act('answer', { answer });
  }
  async function askCustom(prepare = false, intent: 'ask' | 'enqueue' = 'ask') {
    try {
      const value = prepare ? prepared : custom;
      return await act(intent, questionDraft(value));
    } catch (error) {
      failed.value = true;
      message.value = error instanceof Error ? error.message : '請檢查題目內容';
      return false;
    }
  }
  function changeTopic() {
    if (topic.value === 'cruel') kind.value = 'two';
  }
  const library = useResource(async (request) =>
      readMajorityLibrary(await request('/api/community/questions')),
    ),
    search = ref(''),
    pack = ref(''),
    libraryTopic = ref(''),
    libraryKind = ref(''),
    limit = ref(20),
    favoriteIds = ref<string[]>([]);
  function favorites() {
    try {
      const v: unknown = JSON.parse(localStorage.getItem('ah-question-favorites') || '[]');
      favoriteIds.value = Array.isArray(v)
        ? v.filter((x): x is string => typeof x === 'string')
        : [];
    } catch {
      favoriteIds.value = [];
    }
  }
  async function loadLibrary() {
    favorites();
    const loaded = await library.load();
    if (loaded && !library.data.value?.topics.some((t) => t.id === prepared.topic))
      prepared.topic = library.data.value?.topics.find((t) => t.id !== 'cruel')?.id || 'daily';
    return loaded;
  }
  const filtered = computed(() =>
    (library.data.value?.questions || []).filter(
      (q) =>
        (!pack.value ||
          (pack.value === 'favorites'
            ? favoriteIds.value.includes(q.id || '')
            : q.pack === pack.value)) &&
        (!libraryTopic.value || q.topic === libraryTopic.value) &&
        (!libraryKind.value || q.type === libraryKind.value) &&
        JSON.stringify([q.prompt, q.options, q.pack])
          .toLowerCase()
          .includes(search.value.trim().toLowerCase()),
    ),
  );
  const packs = computed(() => [
    ...new Set((library.data.value?.questions || []).map((q) => q.pack)),
  ]);
  watch([search, pack, libraryTopic, libraryKind], () => {
    limit.value = 20;
  });
  async function randomQuestion(intent: 'ask' | 'enqueue') {
    if (!filtered.value.length) return false;
    const q = filtered.value[Math.floor(Math.random() * filtered.value.length)];
    return act(intent, { questionId: q.id });
  }
  const reactions = shallowRef<{ id: number; player: string; emoji: string; until: number }[]>([]),
    seen = new Set<number>();
  let reactionTimer: ReturnType<typeof setTimeout> | undefined,
    reactionContext = '',
    baseline = true,
    sound: HTMLAudioElement | undefined;
  function clearLive() {
    clearTimeout(reactionTimer);
    reactionTimer = undefined;
    reactions.value = [];
    AudioSettings?.stopEffect(sound);
    sound = undefined;
  }
  function expire() {
    reactions.value = reactions.value.filter((r) => r.until > Date.now());
    if (reactions.value.length)
      reactionTimer = setTimeout(
        expire,
        Math.max(1, Math.min(...reactions.value.map((r) => r.until)) - Date.now()),
      );
  }
  watch(state, (s) => {
    if (!s) return;
    const key = room.scope + ':' + s.code;
    if (key !== reactionContext) {
      reactionContext = key;
      seen.clear();
      baseline = true;
    }
    if (!room.connected || document.hidden) {
      baseline = true;
      clearLive();
      return;
    }
    for (const r of s.reactions) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      if (!baseline && s.serverNow - r.at < 3500 && s.serverNow >= r.at - 1000)
        reactions.value = [...reactions.value, { ...r, until: Date.now() + 4000 }].slice(-12);
    }
    baseline = false;
    clearTimeout(reactionTimer);
    expire();
    while (seen.size > 256) seen.delete(seen.values().next().value!);
  });
  watch(
    () => room.connected,
    (value) => {
      if (!value) {
        baseline = true;
        clearLive();
      }
    },
  );
  function visibility() {
    if (document.hidden) {
      stopClock();
      clearLive();
      baseline = true;
    } else {
      tick();
      if (state.value?.phase === 'answering') {
        stopClock();
        timer = setInterval(tick, 250);
      }
    }
  }
  function storage(event: StorageEvent) {
    if (event.key === 'ah-question-favorites') favorites();
  }
  document.addEventListener('visibilitychange', visibility);
  window.addEventListener('storage', storage);
  watch(
    () => room.scope,
    () => {
      controller?.abort();
      pending.value = false;
      uncertain.value = false;
      canonical.value = '';
      choice.value = null;
      draft.value = '';
    },
    { flush: 'sync' },
  );
  onScopeDispose(() => {
    disposed = true;
    controller?.abort();
    stopClock();
    clearLive();
    document.removeEventListener('visibilitychange', visibility);
    window.removeEventListener('storage', storage);
  });
  return {
    state,
    setup,
    editable,
    settings,
    dirty,
    queue,
    start,
    canStart,
    settingsPending: save.pending,
    settingsError: save.error,
    settingsSaved: save.saved,
    source,
    topic,
    kind,
    choice,
    draft,
    custom,
    prepared,
    mergeFrom,
    mergeTo,
    pending,
    message,
    failed,
    uncertain,
    context,
    canAsk,
    participant,
    clock,
    offset,
    expired,
    act,
    answer,
    askCustom,
    changeTopic,
    refresh,
    library: library.data,
    libraryLoading: library.loading,
    libraryError: library.error,
    loadLibrary,
    search,
    pack,
    libraryTopic,
    libraryKind,
    limit,
    filtered,
    packs,
    randomQuestion,
    reactions,
  };
});
