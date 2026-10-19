import { computed, onScopeDispose, reactive, ref, watch } from 'vue';
import { defineStore } from 'pinia';
import { useRoomStore } from './room';
import { useQueuedSave } from '../composables/queued-save';
import { giftRankKeys, type GiftRank, type GiftSnapshot } from '../contracts/gift';
import type { GameSoundOwner } from '../contracts/sounds';
export const useGiftStore = defineStore('gift', () => {
  const room = useRoomStore(),
    state = computed(() =>
      room.snapshot?.type === 'gift' ? (room.snapshot as GiftSnapshot) : null,
    ),
    setup = computed(() => !!state.value && ['waiting', 'finished'].includes(state.value.phase)),
    settingsEditable = computed(() => room.host && setup.value && !room.terminal);
  const settingsDraft = reactive({ target: 15, customPercent: null as number | null }),
    canonical = ref(''),
    settingsKey = () => JSON.stringify(settingsDraft),
    settingsDirty = computed(() => !!canonical.value && settingsKey() !== canonical.value);
  const settings = useQueuedSave<{ target: number; customPercent: number | null }>({
    allowed: () => settingsEditable.value,
    blocked: () => room.busy,
    save: (value) => room.command('settings', value),
    failure: () => room.message,
  });
  watch(
    [
      () => state.value?.target,
      () => state.value?.customPercent,
      settingsEditable,
      () => room.scope,
    ],
    () => {
      const s = state.value;
      if (!s) return;
      const adopt =
        !canonical.value ||
        !settingsEditable.value ||
        (!settings.pending.value && !settingsDirty.value);
      canonical.value = JSON.stringify({ target: s.target, customPercent: s.customPercent });
      if (adopt) {
        settingsDraft.target = s.target;
        settingsDraft.customPercent = s.customPercent;
      }
      if (!settingsEditable.value) settings.reset();
    },
    { immediate: true },
  );
  function queueSettings() {
    if (!settingsEditable.value) return;
    if (
      !Number.isInteger(settingsDraft.target) ||
      settingsDraft.target < 8 ||
      settingsDraft.target > 30
    ) {
      settings.invalidate('目標分數需為 8–30 的整數。');
      return;
    }
    settings.enqueue({ ...settingsDraft });
  }
  async function start() {
    if (!settingsEditable.value || (state.value?.players.length || 0) < 3) return;
    if (settingsDirty.value && !settings.pending.value) queueSettings();
    if ((await settings.flush()) && !settings.error.value) await room.command('start', {});
  }
  const assignments = ref<Record<string, string>>({}),
    likes = ref<string[]>([]),
    panel = ref<'give' | 'wish'>('give'),
    recipient = ref(''),
    resultRecipient = ref(''),
    notice = ref(''),
    uncertain = ref(false),
    refreshing = ref(false);
  const recipients = computed(
      () => state.value?.players.filter((p) => p.id !== state.value?.me) || [],
    ),
    chosen = computed(() => state.value?.ownAssignments || assignments.value),
    ranking = computed(() =>
      state.value?.ownRanking ? giftRankKeys.map((k) => state.value!.ownRanking![k]) : likes.value,
    ),
    canEdit = computed(
      () =>
        state.value?.phase === 'choosing' &&
        room.connected &&
        !room.busy &&
        !uncertain.value &&
        !document.hidden,
    ),
    canGive = computed(
      () =>
        canEdit.value &&
        !state.value?.ownAssignments &&
        recipients.value.every((p) => assignments.value[p.id]) &&
        new Set(Object.values(assignments.value)).size === recipients.value.length,
    ),
    canWish = computed(() => canEdit.value && !state.value?.ownRanking && likes.value.length === 4);
  watch(
    [() => room.scope, () => state.value?.round, () => state.value?.phase === 'choosing'],
    () => {
      assignments.value = {};
      likes.value = [];
      recipient.value = recipients.value[0]?.id || '';
      resultRecipient.value = state.value?.me || '';
      notice.value = '';
      uncertain.value = false;
    },
    { immediate: true },
  );
  watch(
    [
      () => state.value?.players.map((p) => p.id).join(','),
      () => state.value?.gifts.map((g) => g.id).join(','),
    ],
    () => {
      const gifts = new Set(state.value?.gifts.map((g) => g.id)),
        people = new Set(recipients.value.map((p) => p.id));
      assignments.value = Object.fromEntries(
        Object.entries(assignments.value).filter(([p, g]) => people.has(p) && gifts.has(g)),
      );
      likes.value = likes.value.filter((id) => gifts.has(id));
      if (!people.has(recipient.value)) recipient.value = recipients.value[0]?.id || '';
      if (!state.value?.players.some((p) => p.id === resultRecipient.value))
        resultRecipient.value = state.value?.players[0]?.id || '';
    },
  );
  function chooseGift(id: string) {
    if (
      !canEdit.value ||
      state.value?.ownAssignments ||
      !recipients.value.some((p) => p.id === recipient.value)
    )
      return;
    const next = { ...assignments.value };
    if (next[recipient.value] === id) delete next[recipient.value];
    else {
      for (const p of Object.keys(next)) if (next[p] === id) delete next[p];
      next[recipient.value] = id;
    }
    assignments.value = next;
    notice.value = '';
  }
  function chooseWish(id: string) {
    if (!canEdit.value || state.value?.ownRanking) return;
    const next = likes.value.slice(),
      index = next.indexOf(id);
    if (index >= 0) next.splice(index, 1);
    else if (next.length < 4) next.push(id);
    else {
      notice.value = '已選四件；先取消一件，再挑新的。';
      return;
    }
    likes.value = next;
    notice.value = '';
  }
  // This engine has no receipts or round token. Never automatically retry a
  // mutation: read authoritative state before allowing another explicit action.
  async function action(action: 'give' | 'wish' | 'accept' | 'next') {
    const s = state.value;
    if (!s || room.busy || !room.connected || uncertain.value || document.hidden) return false;
    if (
      (action === 'give' && !canGive.value) ||
      (action === 'wish' && !canWish.value) ||
      (action === 'accept' && (s.phase !== 'delivering' || s.delivery?.recipientId !== s.me)) ||
      (action === 'next' && (s.phase !== 'reveal' || !room.host))
    )
      return false;
    const payload =
      action === 'give'
        ? { assignments: { ...assignments.value } }
        : action === 'wish'
          ? { ranking: Object.fromEntries(giftRankKeys.map((key, i) => [key, likes.value[i]])) }
          : action === 'accept'
            ? { recipientId: s.delivery!.recipientId }
            : {};
    const scope = room.scope,
      ok = await room.command('action', { action, ...payload });
    if (scope !== room.scope) return false;
    if (!ok) {
      uncertain.value = true;
      notice.value = '操作未確認，已保留你的選擇；先更新房間確認是否已鎖定，再決定下一步。';
    } else {
      notice.value =
        action === 'give'
          ? '送禮已鎖定。'
          : action === 'wish'
            ? '心願已鎖定。'
            : action === 'accept'
              ? '已確認收禮。'
              : '下一輪已開始。';
      if (['give', 'wish'].includes(action))
        sounds?.play('confirm', `gift-confirm:${scope}:${s.round}:${action}`, {
          live: !document.hidden && room.connected,
        });
    }
    return ok;
  }
  async function refresh() {
    if (refreshing.value || room.busy) return;
    const scope = room.scope;
    refreshing.value = true;
    try {
      const value = await room.request('state');
      if (scope === room.scope && room.accept(value)) {
        uncertain.value = false;
        room.failed = false;
        room.message = '';
        notice.value = '已更新，請依目前鎖定狀態決定下一步。';
      }
    } catch (cause) {
      if (scope === room.scope)
        notice.value = cause instanceof Error ? cause.message : '無法更新房間。';
    } finally {
      if (scope === room.scope) refreshing.value = false;
    }
  }
  const sounds: GameSoundOwner | undefined = window.GameSounds?.create();
  let previous: GiftSnapshot | null = null;
  watch(state, (s) => {
    if (!s) return;
    const live = sounds?.update(s, { connected: room.connected && !document.hidden });
    if (
      previous &&
      live &&
      previous.round === s.round &&
      previous.phase === 'delivering' &&
      ['reveal', 'finished'].includes(s.phase)
    )
      sounds?.play('reveal', 'gift-result:' + s.round + ':' + s.version, { live: true });
    previous = s;
  });
  function visibility() {
    if (document.hidden) sounds?.disconnect();
  }
  document.addEventListener('visibilitychange', visibility);
  onScopeDispose(() => {
    sounds?.destroy();
    document.removeEventListener('visibilitychange', visibility);
  });
  return {
    state,
    setup,
    settingsEditable,
    settingsDraft,
    queueSettings,
    start,
    settingsPending: settings.pending,
    settingsError: settings.error,
    settingsSaved: settings.saved,
    assignments,
    likes,
    panel,
    recipient,
    resultRecipient,
    recipients,
    chosen,
    ranking,
    canEdit,
    canGive,
    canWish,
    chooseGift,
    chooseWish,
    action,
    notice,
    uncertain,
    refreshing,
    refresh,
  };
});
