import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue';
import { defineStore } from 'pinia';
import { useMinimalCountdownSounds } from '../composables/minimal-countdown-sounds';
import { useRoomStore } from './room';
import { usePartyActionsStore } from './party-actions';
import { readMinimalShapes, type MinimalShape, type MinimalSnapshot } from '../contracts/minimal';
interface DraftAttempt {
  context: string;
  revision: number;
  payload: { action: 'draft'; roundId: string; requestId: string; shapes: MinimalShape[] };
}
export const useMinimalStore = defineStore('minimal', () => {
  const room = useRoomStore(),
    actions = usePartyActionsStore(),
    state = computed(() =>
      room.snapshot?.type === 'minimal' ? (room.snapshot as MinimalSnapshot) : null,
    );
  const shapes = shallowRef<MinimalShape[]>([]),
    guess = ref(''),
    saving = ref(false),
    finishing = ref(false),
    activeStroke = ref(false),
    notice = ref(''),
    storageNotice = ref(''),
    now = ref(Date.now()),
    foreground = ref(!document.hidden);
  useMinimalCountdownSounds(room, state, now);
  const context = computed(() =>
    state.value?.roundId && room.seat && !room.terminal
      ? `${room.scope}:${room.code}:${state.value.me}:${state.value.roundId}`
      : '',
  );
  const cacheKey = computed(() =>
    state.value?.roundId ? `minimal:${room.code}:${state.value.me}:${state.value.roundId}` : '',
  );
  const expired = computed(
    () => !!state.value?.deadline && now.value - room.clockOffset >= state.value.deadline,
  );
  const drawingAllowed = computed(
    () =>
      !!context.value &&
      room.connected &&
      state.value?.phase === 'drawing' &&
      state.value.me !== state.value.guesserId &&
      !state.value.submitted &&
      !expired.value &&
      foreground.value,
  );
  const editable = computed(
    () =>
      drawingAllowed.value && !finishing.value && !actions.pending && (!room.busy || saving.value),
  );
  const dirty = computed(
    () => JSON.stringify(shapes.value) !== JSON.stringify(state.value?.myShapes || []),
  );
  const target = computed(() =>
    state.value?.phase === 'guessing'
      ? `${state.value.roundId}:${state.value.attempts.length}:${state.value.currentDrawing?.name}:${state.value.currentDrawing?.count}`
      : '',
  );
  let disposed = false,
    revision = 0,
    savedKey = '',
    automatic = false,
    timer: ReturnType<typeof setTimeout> | null = null,
    clock: ReturnType<typeof setInterval> | null = null;
  let job: {
      controller: AbortController;
      attempt: DraftAttempt;
      promise: Promise<boolean> | null;
    } | null = null,
    retry: DraftAttempt | null = null;
  function clearTimer() {
    if (timer) clearTimeout(timer);
    timer = null;
  }
  function save() {
    if (!savedKey) return;
    try {
      sessionStorage.setItem(savedKey, JSON.stringify({ shapes: shapes.value, text: guess.value }));
    } catch {
      storageNotice.value = '無法在此分頁保存草稿；請留意伺服器同步筆數。';
    }
  }
  function forget() {
    if (savedKey)
      try {
        sessionStorage.removeItem(savedKey);
      } catch {}
    savedKey = '';
  }
  function reset() {
    clearTimer();
    if (job) {
      job.controller.abort();
      if (saving.value) room.busy = false;
    }
    job = null;
    shapes.value = [];
    guess.value = '';
    saving.value = finishing.value = activeStroke.value = false;
    notice.value = storageNotice.value = '';
    retry = null;
    automatic = false;
    revision++;
    savedKey = '';
  }
  function initialize() {
    reset();
    const current = state.value;
    if (!current || !context.value) return;
    savedKey = cacheKey.value;
    shapes.value = structuredClone(current.myShapes);
    if (['drawing', 'guessing'].includes(current.phase) && !current.submitted) {
      try {
        const stored = JSON.parse(sessionStorage.getItem(savedKey) || 'null');
        if (stored) {
          if (current.phase === 'drawing' && current.me !== current.guesserId)
            shapes.value = readMinimalShapes(stored.shapes || []);
          if (
            typeof stored.text === 'string' &&
            stored.text.length <= 80 &&
            !/[\u0000-\u001f\u007f]/.test(stored.text)
          )
            guess.value = stored.text;
        }
      } catch {
        storageNotice.value = '無法讀取本地草稿，已使用伺服器接受的圖形。';
        shapes.value = structuredClone(current.myShapes);
      }
    } else forget();
  }
  function schedule() {
    clearTimer();
    if (!disposed && automatic && dirty.value && drawingAllowed.value && !finishing.value)
      timer = setTimeout(() => {
        timer = null;
        void sync();
      }, 200);
  }
  async function sync(): Promise<boolean> {
    clearTimer();
    if (disposed || !drawingAllowed.value || finishing.value) return false;
    if (job?.promise) return job.promise;
    if (!dirty.value) {
      notice.value = '草稿已同步。';
      return true;
    }
    if (room.busy || actions.pending) return false;
    const current = state.value!,
      attempt =
        retry && retry.context === context.value && retry.revision === revision
          ? retry
          : {
              context: context.value,
              revision,
              payload: {
                action: 'draft' as const,
                roundId: current.roundId!,
                requestId: crypto.randomUUID(),
                shapes: structuredClone(shapes.value),
              },
            };
    const next = {
      controller: new AbortController(),
      attempt,
      promise: null as Promise<boolean> | null,
    };
    job = next;
    saving.value = true;
    room.busy = true;
    notice.value = '正在同步私人草稿…';
    const timeout = setTimeout(
      () =>
        next.controller.abort(
          new DOMException(
            '草稿結果尚未確認；只會保留伺服器接受的圖形，可手動重試。',
            'TimeoutError',
          ),
        ),
      10000,
    );
    next.promise = (async () => {
      try {
        const value = await room.request('action', attempt.payload, {
          signal: next.controller.signal,
        });
        if (disposed || job !== next || attempt.context !== context.value) return false;
        room.accept(value);
        retry = null;
        notice.value = attempt.revision === revision ? '草稿已同步。' : '還有新圖形尚未同步。';
        return true;
      } catch (cause) {
        if (
          !disposed &&
          job === next &&
          attempt.context === context.value &&
          !(cause instanceof DOMException && cause.name === 'AbortError')
        ) {
          retry = attempt;
          if (attempt.revision === revision) automatic = false;
          notice.value = cause instanceof Error ? cause.message : '草稿同步失敗。';
        }
        return false;
      } finally {
        clearTimeout(timeout);
        if (job === next) {
          job = null;
          saving.value = false;
          room.busy = false;
          if (automatic && dirty.value && attempt.revision !== revision) schedule();
        }
      }
    })();
    return next.promise;
  }
  function change(values: MinimalShape[]) {
    if (!editable.value) return;
    shapes.value = readMinimalShapes(values);
    revision++;
    retry = null;
    automatic = true;
    notice.value = '有新圖形尚未同步。';
    save();
    schedule();
  }
  function append(shape: MinimalShape) {
    if (shapes.value.length < 40) change([...shapes.value, shape]);
    else notice.value = '已達 40 筆上限，可復原或清除。';
  }
  function undo() {
    if (shapes.value.length) change(shapes.value.slice(0, -1));
  }
  function clear() {
    change([]);
  }
  async function submit() {
    if (!drawingAllowed.value || finishing.value || actions.pending || (room.busy && !saving.value))
      return false;
    const key = context.value,
      values = structuredClone(shapes.value);
    finishing.value = true;
    automatic = false;
    clearTimer();
    activeStroke.value = false;
    const pending = job;
    if (pending) {
      pending.controller.abort();
      await pending.promise;
    }
    try {
      if (disposed || key !== context.value || !drawingAllowed.value) return false;
      return await actions.command('submit', { shapes: values });
    } finally {
      if (key === context.value) finishing.value = false;
    }
  }
  function saveGuess(value: string) {
    let text = '';
    for (const glyph of value) {
      if (text.length + glyph.length > 80) break;
      text += glyph;
    }
    guess.value = text;
    save();
  }
  async function answer() {
    if (
      room.busy ||
      actions.pending ||
      !room.connected ||
      state.value?.phase !== 'guessing' ||
      state.value.me !== state.value.guesserId ||
      !guess.value.trim()
    )
      return false;
    const key = target.value,
      value = guess.value.trim();
    const ok = await actions.command('guess', { text: value });
    if (ok && key !== target.value) {
      guess.value = '';
      save();
    }
    return ok;
  }
  watch(context, initialize, { immediate: true, flush: 'sync' });
  watch(
    target,
    (value, previous) => {
      actions.setTarget(value);
      if (previous && value !== previous) {
        guess.value = '';
        save();
      }
    },
    { immediate: true, flush: 'sync' },
  );
  watch(
    () => [state.value?.phase, state.value?.submitted],
    () => {
      if (state.value?.phase !== 'drawing' || state.value?.submitted) {
        clearTimer();
        automatic = false;
        activeStroke.value = false;
        if (state.value?.phase !== 'guessing') forget();
      }
    },
  );
  watch(
    () => state.value?.myShapes,
    (values, previous) => {
      if (!values || !state.value) return;
      if (
        !saving.value &&
        !activeStroke.value &&
        JSON.stringify(shapes.value) === JSON.stringify(previous || [])
      )
        shapes.value = structuredClone(values);
    },
  );
  watch(
    () => room.busy,
    (value) => {
      if (!value && automatic && dirty.value) schedule();
    },
  );
  function updateClock() {
    now.value = Date.now();
    if (expired.value) {
      clearTimer();
      automatic = false;
      activeStroke.value = false;
      if (clock) clearInterval(clock);
      clock = null;
    }
  }
  function clockMode() {
    if (clock) clearInterval(clock);
    clock = null;
    updateClock();
    if (state.value?.deadline && !expired.value && !document.hidden)
      clock = setInterval(updateClock, 250);
  }
  watch(() => state.value?.deadline, clockMode, { immediate: true });
  function visibility() {
    foreground.value = !document.hidden;
    if (document.hidden) {
      save();
      clearTimer();
      automatic = false;
      activeStroke.value = false;
      job?.controller.abort(
        new DOMException('背景連線已暫停；回到前景後請先確認同步筆數。', 'TimeoutError'),
      );
    }
    clockMode();
  }
  document.addEventListener('visibilitychange', visibility);
  onScopeDispose(() => {
    save();
    disposed = true;
    reset();
    if (clock) clearInterval(clock);
    document.removeEventListener('visibilitychange', visibility);
    actions.setTarget('');
  });
  return {
    state,
    shapes,
    guess,
    saving,
    finishing,
    activeStroke,
    notice,
    storageNotice,
    now,
    expired,
    drawingAllowed,
    editable,
    dirty,
    target,
    append,
    undo,
    clear,
    sync,
    submit,
    saveGuess,
    answer,
  };
});
