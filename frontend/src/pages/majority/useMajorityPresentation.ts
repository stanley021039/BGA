import { computed, nextTick, onMounted, onScopeDispose, ref, watch, type Ref } from 'vue';
import { useRoomStore } from '../../stores/room';
import { useMajorityStore } from '../../stores/majority';
import { useAchievementsStore } from '../../stores/achievements';
export function useMajorityPresentation(root: Ref<HTMLElement | null>) {
  const room = useRoomStore(),
    game = useMajorityStore(),
    achievements = useAchievementsStore(),
    focusId = ref(''),
    achievementNotice = ref(''),
    animations = new Set<Animation>();
  let gate = window.MotionPolicy?.createGate(),
    focusTimer: ReturnType<typeof setTimeout> | undefined,
    disposed = false,
    generation = 0,
    baseline = true,
    clip: HTMLAudioElement | undefined,
    known: Set<string> | null = null;
  const focus = computed(() => game.state?.groups.find((g) => g.id === focusId.value));
  function stop() {
    generation++;
    clearTimeout(focusTimer);
    focusTimer = undefined;
    focusId.value = '';
    for (const animation of animations) animation.cancel();
    animations.clear();
    window.AudioSettings?.stopEffect(clip);
    clip = undefined;
  }
  function replay() {
    stop();
    if (
      !window.MotionPolicy?.allowsMotion() ||
      document.hidden ||
      !room.connected ||
      game.state?.cruel ||
      game.state?.phase !== 'reveal'
    )
      return;
    const groups = [...(game.state.groups || [])].sort((a, b) => b.count - a.count).slice(0, 3);
    let step = 0;
    const show = () => {
      focusId.value = groups[step++]?.id || '';
      if (focusId.value) focusTimer = setTimeout(show, 650);
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
  onMounted(() => {
    void checkAchievements();
  });
  watch(
    () => game.state,
    async (s, old) => {
      if (!s) return;
      const fresh = gate?.update(s, { connected: room.connected && !baseline && !document.hidden });
      baseline = false;
      if (s.round !== old?.round) {
        stop();
        achievementNotice.value = '';
      }
      if (!fresh || old?.round !== s.round || old?.phase === s.phase) return;
      const changing = ['review', 'reveal'].includes(s.phase);
      if (!changing) return;
      const token = generation,
        scope = room.scope;
      await nextTick();
      if (
        disposed ||
        token !== generation ||
        scope !== room.scope ||
        game.state?.phase !== s.phase ||
        !room.connected ||
        document.hidden
      )
        return;
      if (s.phase === 'reveal') {
        if (!s.cruel) replay();
        window.AudioSettings?.stopEffect(clip);
        clip = window.AudioSettings?.playEffect?.('majority-settlement');
        void checkAchievements();
      }
      if (!window.MotionPolicy?.allowsMotion()) return;
      const stage = root.value;
      if (!stage) return;
      const rect = stage.getBoundingClientRect();
      for (const [i, chip] of [...stage.querySelectorAll<HTMLElement>('[data-member]')].entries()) {
        const target = chip.getBoundingClientRect(),
          seat = document.querySelector<HTMLElement>(
            `.vue-room-player[data-player-id="${CSS.escape(chip.dataset.member || '')}"]`,
          ),
          from = seat?.getBoundingClientRect();
        const x = from ? from.left + from.width / 2 : rect.left + rect.width / 2,
          y = from ? from.top + from.height / 2 : rect.top;
        const animation = window.MotionPolicy?.animate(
          chip,
          [
            {
              opacity: 0.2,
              transform: `translate(${x - target.left - target.width / 2}px,${y - target.top - target.height / 2}px) scale(.78)`,
            },
            { opacity: 1, transform: 'translate(0,0) scale(1)' },
          ],
          {
            duration: 420,
            delay: Math.min(i * 35, 280),
            easing: 'cubic-bezier(.2,.8,.2,1)',
            fill: 'backwards',
          },
        );
        if (animation) {
          animations.add(animation);
          void animation.finished.catch(() => {}).then(() => animations.delete(animation));
        }
      }
    },
    { flush: 'post' },
  );
  watch(
    () => room.connected,
    (v) => {
      if (!v) {
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
      gate = window.MotionPolicy?.createGate();
    },
  );
  const visibility = () => {
      baseline = true;
      stop();
    },
    unsubscribe = window.MotionPolicy?.subscribe(() => {
      if (!window.MotionPolicy?.allowsMotion()) stop();
    });
  document.addEventListener('visibilitychange', visibility);
  onScopeDispose(() => {
    disposed = true;
    stop();
    gate?.dispose();
    unsubscribe?.();
    document.removeEventListener('visibilitychange', visibility);
  });
  return { focus, focusId, replay, stop, achievementNotice };
}
