import { computed, onScopeDispose, reactive, ref, shallowRef, watch } from 'vue';
import { defineStore } from 'pinia';
import { useRoomStore } from './room';
import { ApiError } from '../services/http';
import type { TrpgSnapshot, TrpgStance } from '../contracts/trpg';
interface Attempt {
  scope: number;
  context: string;
  revision: number;
  target: string;
  payload: Record<string, unknown>;
}
export const useTrpgStore = defineStore('trpg', () => {
  const room = useRoomStore(),
    state = computed(() =>
      room.snapshot?.type === 'trpg' ? (room.snapshot as TrpgSnapshot) : null,
    ),
    me = computed(() => state.value?.players.find((p) => p.id === state.value?.me)),
    leader = computed(() => state.value?.players.find((p) => p.id === state.value?.leaderId)),
    isLeader = computed(() => !!state.value && state.value.me === state.value.leaderId),
    setup = computed(() => !!state.value && ['waiting', 'finished'].includes(state.value.phase));
  const context = computed(() =>
      state.value && room.seat && !room.terminal
        ? `${room.scope}:${state.value.sceneId || 'waiting'}:${state.value.phase}:${state.value.leaderId || ''}`
        : '',
    ),
    draft = reactive({ approach: '', stance: 'assist' as TrpgStance, note: '' }),
    role = ref(''),
    pending = ref(false),
    failed = ref(false),
    foreground = ref(!document.hidden),
    notice = ref(''),
    retry = shallowRef<Attempt | null>(null);
  const currentApproach = computed(() =>
      state.value?.approaches.find((a) => a.id === draft.approach),
    ),
    planValue = () => ({
      stance: draft.stance,
      approach: isLeader.value ? draft.approach : null,
      note: draft.note.trim(),
      skipped: false,
    });
  const dirty = computed(
      () =>
        !state.value?.myPlan || JSON.stringify(planValue()) !== JSON.stringify(state.value.myPlan),
    ),
    editable = computed(
      () =>
        state.value?.phase === 'planning' &&
        room.connected &&
        !room.busy &&
        !pending.value &&
        foreground.value,
    ),
    roleEditable = computed(() => setup.value && room.connected && !room.busy && !pending.value);
  let revision = 0,
    disposed = false,
    adopting = false,
    controller: AbortController | null = null;
  function targetValid(attempt: Attempt) {
    if (attempt.payload.action !== 'skip') return true;
    return mayRest(attempt.target);
  }
  const canRetry = computed(
    () =>
      !!retry.value &&
      retry.value.scope === room.scope &&
      retry.value.context === context.value &&
      retry.value.revision === revision &&
      !pending.value &&
      !room.busy &&
      room.connected &&
      foreground.value &&
      !room.terminal &&
      targetValid(retry.value),
  );
  function clear() {
    controller?.abort();
    controller = null;
    if (pending.value) room.busy = false;
    pending.value = false;
    retry.value = null;
    notice.value = '';
    failed.value = false;
  }
  function initialize() {
    clear();
    adopting = true;
    const s = state.value;
    draft.approach =
      s?.myPlan?.approach || s?.approaches.find((a) => a.cost <= s.supplies)?.id || '';
    draft.stance = s?.myPlan?.stance || (me.value?.focus ? 'assist' : 'recover');
    draft.note = s?.myPlan?.note || '';
    adopting = false;
    revision++;
  }
  watch(context, initialize, { immediate: true, flush: 'sync' });
  watch(
    [() => draft.approach, () => draft.stance, () => draft.note],
    () => {
      if (!adopting) {
        revision++;
        retry.value = null;
        failed.value = false;
        notice.value = dirty.value
          ? '行動有變更，請送出更新後再檢定。'
          : '行動與已送出的內容一致。';
      }
    },
    { flush: 'sync' },
  );
  watch(
    [() => me.value?.role, () => room.scope],
    () => {
      role.value = me.value?.role || '';
    },
    { immediate: true },
  );
  function mayRest(id: string) {
    const s = state.value,
      p = s?.players.find((p) => p.id === id);
    return (
      !!s &&
      room.host &&
      s.phase === 'planning' &&
      !!p &&
      !p.bot &&
      p.offline &&
      !p.ready &&
      id !== s.leaderId &&
      id !== s.me
    );
  }
  function mayRemoveLeader(id: string) {
    const s = state.value,
      p = s?.players.find((p) => p.id === id);
    return (
      !!s &&
      room.host &&
      s.phase === 'planning' &&
      id === s.leaderId &&
      id !== s.me &&
      !!p &&
      !p.bot &&
      p.offline &&
      !p.ready
    );
  }
  async function execute(attempt: Attempt): Promise<boolean> {
    if (
      disposed ||
      pending.value ||
      room.busy ||
      !room.connected ||
      !context.value ||
      attempt.scope !== room.scope ||
      attempt.context !== context.value ||
      attempt.revision !== revision ||
      !targetValid(attempt)
    )
      return false;
    const request = new AbortController();
    controller = request;
    pending.value = true;
    room.busy = true;
    notice.value = '正在送出…';
    failed.value = false;
    retry.value = null;
    const timer = setTimeout(
      () =>
        request.abort(
          new DOMException('操作結果尚未確認，更新房間後可重試同一操作。', 'TimeoutError'),
        ),
      10000,
    );
    try {
      const value = await room.request('action', attempt.payload, { signal: request.signal });
      if (
        disposed ||
        controller !== request ||
        attempt.scope !== room.scope ||
        attempt.context !== context.value
      )
        return false;
      room.accept(value);
      if (room.terminal) return false;
      if (attempt.payload.action === 'plan' && state.value?.myPlan) {
        adopting = true;
        draft.note = state.value.myPlan.note;
        draft.stance = state.value.myPlan.stance;
        if (state.value.myPlan.approach) draft.approach = state.value.myPlan.approach;
        adopting = false;
      }
      notice.value = '';
      return true;
    } catch (cause) {
      if (
        !disposed &&
        controller === request &&
        attempt.scope === room.scope &&
        attempt.context === context.value &&
        !(cause instanceof DOMException && cause.name === 'AbortError')
      ) {
        failed.value = true;
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
  function command(
    action: 'plan' | 'resolve' | 'next' | 'skip',
    data: Record<string, unknown> = {},
    target = '',
  ) {
    const s = state.value;
    if (!s?.sceneId || !room.connected) return Promise.resolve(false);
    return execute({
      scope: room.scope,
      context: context.value,
      revision,
      target,
      payload: structuredClone({
        ...data,
        action,
        sceneId: s.sceneId,
        requestId: crypto.randomUUID(),
      }),
    });
  }
  function plan() {
    if (
      !editable.value ||
      (isLeader.value &&
        (!currentApproach.value || currentApproach.value.cost > (state.value?.supplies || 0))) ||
      (!isLeader.value && draft.stance === 'assist' && !me.value?.focus)
    )
      return Promise.resolve(false);
    return command('plan', {
      stance: draft.stance,
      note: draft.note,
      ...(isLeader.value ? { approach: draft.approach } : {}),
    });
  }
  function resolve() {
    return !dirty.value && state.value?.canResolve ? command('resolve') : Promise.resolve(false);
  }
  function next() {
    return isLeader.value && state.value?.phase === 'reveal'
      ? command('next')
      : Promise.resolve(false);
  }
  function rest(id: string) {
    return mayRest(id)
      ? command('skip', { playerId: id, confirmed: true }, id)
      : Promise.resolve(false);
  }
  async function removeLeader(id: string) {
    if (!mayRemoveLeader(id) || room.busy) return false;
    return room.command('kick', { playerId: id, confirmed: true });
  }
  async function chooseRole() {
    if (!roleEditable.value || !role.value || !Object.hasOwn(state.value?.roles || {}, role.value))
      return false;
    retry.value = null;
    return room.command('action', { action: 'role', role: role.value });
  }
  async function start() {
    if (!room.gameManager || !setup.value || !room.connected || room.busy) return false;
    if (role.value !== me.value?.role && !(await chooseRole())) return false;
    return room.command('start', {});
  }
  function changeNote(value: string) {
    draft.note = [...value.replace(/[\u0000-\u001f\u007f]/g, '')].slice(0, 160).join('');
  }
  function retrySame() {
    return retry.value && canRetry.value ? execute(retry.value) : Promise.resolve(false);
  }
  function visibility() {
    foreground.value = !document.hidden;
    if (document.hidden)
      controller?.abort(new DOMException('背景操作已暫停，回到前景後請確認結果。', 'TimeoutError'));
  }
  document.addEventListener('visibilitychange', visibility);
  watch(
    () => room.terminal,
    (value) => {
      if (value) clear();
    },
  );
  onScopeDispose(() => {
    disposed = true;
    clear();
    document.removeEventListener('visibilitychange', visibility);
  });
  return {
    state,
    me,
    leader,
    isLeader,
    setup,
    draft,
    role,
    pending,
    failed,
    notice,
    dirty,
    editable,
    roleEditable,
    currentApproach,
    canRetry,
    plan,
    resolve,
    next,
    rest,
    mayRest,
    mayRemoveLeader,
    removeLeader,
    chooseRole,
    start,
    changeNote,
    retrySame,
  };
});
