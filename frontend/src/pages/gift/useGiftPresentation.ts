import MotionPolicy from '../../engines/motion-policy.js';
import { computed, nextTick, onMounted, onScopeDispose, ref, watch, type Ref } from 'vue';
import { useGiftStore } from '../../stores/gift';
import { useRoomStore } from '../../stores/room';
import { useAchievementsStore } from '../../stores/achievements';
export function useGiftPresentation(root: Ref<HTMLElement | null>) {
  const gift = useGiftStore(),
    room = useRoomStore(),
    achievements = useAchievementsStore(),
    focusIndex = ref(-1),
    achievementNotice = ref(''),
    focus = computed(() => gift.state?.result?.entries[focusIndex.value]);
  let gate = MotionPolicy?.createGate(),
    disposed = false,
    baseline = true,
    generation = 0,
    timer: ReturnType<typeof setTimeout> | undefined,
    known: Set<string> | null = null;
  const animations = new Set<Animation>();
  function stop() {
    generation++;
    clearTimeout(timer);
    timer = undefined;
    focusIndex.value = -1;
    for (const a of animations) a.cancel();
    animations.clear();
  }
  function replay() {
    stop();
    const s = gift.state;
    if (
      !s?.result ||
      !['reveal', 'finished'].includes(s.phase) ||
      !room.connected ||
      document.hidden ||
      !MotionPolicy?.allowsMotion()
    )
      return;
    const count = s.result.entries.length,
      indexes = [...new Set([0, Math.floor((count - 1) / 2), count - 1])].filter(
        (i) => i >= 0 && i < count,
      );
    let step = 0;
    const show = () => {
      focusIndex.value = indexes[step++] ?? -1;
      if (focusIndex.value >= 0) timer = setTimeout(show, 1400);
    };
    show();
  }
  async function checkAchievements() {
    await achievements.load();
    if (disposed || !achievements.loaded) return;
    const unlocked = achievements.items.filter((a) => a.unlockedAt);
    if (known) {
      const earned = unlocked.filter((a) => !known!.has(a.id));
      if (earned.length)
        achievementNotice.value = '解鎖成就：' + earned.map((a) => a.title).join('、');
    }
    known = new Set(unlocked.map((a) => a.id));
  }
  onMounted(() => void checkAchievements());
  watch(
    () => gift.state,
    async (s, old) => {
      if (!s) return;
      const live = gate?.update(s, { connected: room.connected && !document.hidden && !baseline });
      baseline = false;
      const phaseChanged = s.phase !== old?.phase,
        deliveryChanged = s.delivery?.recipientId !== old?.delivery?.recipientId;
      if (s.round !== old?.round || phaseChanged || deliveryChanged) {
        stop();
        if (s.round !== old?.round) achievementNotice.value = '';
      }
      if (!live || s.round !== old?.round) return;
      const revealed = old?.phase === 'delivering' && ['reveal', 'finished'].includes(s.phase);
      if (!revealed && !(s.phase === 'delivering' && deliveryChanged)) return;
      const scope = room.scope,
        token = generation;
      await nextTick();
      if (
        disposed ||
        scope !== room.scope ||
        token !== generation ||
        !room.connected ||
        document.hidden
      )
        return;
      if (revealed) {
        replay();
        void checkAchievements();
      }
      if (!MotionPolicy?.allowsMotion()) return;
      for (const [i, node] of [
        ...(root.value?.querySelectorAll<HTMLElement>(
          '.vue-gift-delivery-grid article,.vue-gift-score-grid article',
        ) || []),
      ].entries()) {
        const a = MotionPolicy.animate(
          node,
          [
            { opacity: 0.3, transform: 'translateY(-16px)' },
            { opacity: 1, transform: 'translateY(0)' },
          ],
          { duration: 420, delay: Math.min(i * 50, 250), easing: 'ease-out' },
        );
        if (a) {
          animations.add(a);
          void a.finished.catch(() => {}).then(() => animations.delete(a));
        }
      }
    },
    { flush: 'post' },
  );
  watch(
    () => room.connected,
    (value) => {
      if (!value) {
        baseline = true;
        stop();
      }
    },
  );
  watch(
    () => room.scope,
    () => {
      baseline = true;
      stop();
      gate?.dispose();
      gate = MotionPolicy?.createGate();
    },
  );
  function visibility() {
    baseline = true;
    stop();
  }
  const unsubscribe = MotionPolicy?.subscribe(() => {
    if (!MotionPolicy?.allowsMotion()) stop();
  });
  document.addEventListener('visibilitychange', visibility);
  onScopeDispose(() => {
    disposed = true;
    stop();
    gate?.dispose();
    unsubscribe?.();
    document.removeEventListener('visibilitychange', visibility);
  });
  return { focus, replay, stop, achievementNotice };
}
