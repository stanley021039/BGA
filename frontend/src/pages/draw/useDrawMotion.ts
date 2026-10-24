import MotionPolicy from '../../engines/motion-policy.js';
import { nextTick, onScopeDispose, ref, shallowRef, watch, type Ref } from 'vue';
import type { DrawSnapshot } from '../../contracts/drawing';
import { useRoomStore } from '../../stores/room';

export function useDrawMotion(root: Ref<HTMLElement | null>, connected: Ref<boolean>) {
  const room = useRoomStore(),
    badges = shallowRef<Record<string, { key: string; points: number }>>({}),
    locked = ref('');
  let gate = MotionPolicy?.createGate(),
    baseline = true,
    generation = 0,
    disposed = false,
    lockTimer: ReturnType<typeof setTimeout> | null = null;
  let previousSeconds: number | null = null,
    timerEpoch = '';
  const timers = new Map<string, ReturnType<typeof setTimeout>>(),
    animations = new Set<Animation>();
  const allowed = () => !!MotionPolicy?.allowsMotion();
  function clear() {
    generation++;
    baseline = true;
    locked.value = '';
    badges.value = {};
    previousSeconds = null;
    timerEpoch = '';
    if (lockTimer) clearTimeout(lockTimer);
    lockTimer = null;
    for (const timer of timers.values()) clearTimeout(timer);
    timers.clear();
    for (const animation of animations) animation.cancel();
    animations.clear();
  }
  function animate(node: Element | null, frames: Keyframe[], options: KeyframeAnimationOptions) {
    const animation = MotionPolicy?.animate(node, frames, options);
    if (!animation) return;
    animations.add(animation);
    void animation.finished.catch(() => {}).then(() => animations.delete(animation));
  }
  async function update(value: DrawSnapshot | null, previous: DrawSnapshot | null) {
    if (!value || disposed) return;
    const live = gate?.update(value, { connected: connected.value && !baseline }) || false;
    baseline = false;
    if (value.phase !== 'drawing') {
      locked.value = '';
      if (lockTimer) clearTimeout(lockTimer);
      lockTimer = null;
    }
    if (previous?.canvasEpoch !== value.canvasEpoch) {
      generation++;
      for (const animation of animations) animation.cancel();
      animations.clear();
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
      badges.value = {};
      locked.value = '';
      if (lockTimer) clearTimeout(lockTimer);
      lockTimer = null;
    }
    const phase =
      gate?.take('phase:' + value.canvasEpoch + ':' + value.phase, live) &&
      !!previous &&
      previous.phase !== value.phase;
    const fresh = value.guesses
      .filter((guess) => guess.correct)
      .slice(-3)
      .filter((guess) => {
        const take = gate?.take('correct:' + value.canvasEpoch + ':' + guess.id, live);
        return (
          take &&
          allowed() &&
          previous?.canvasEpoch === value.canvasEpoch &&
          previous.phase === 'drawing' &&
          ['drawing', 'reveal'].includes(value.phase) &&
          !previous.guesses.some((old) => old.correct && old.id === guess.id) &&
          value.serverNow - guess.at >= 0 &&
          value.serverNow - guess.at < 5000
        );
      });
    if (!allowed()) return;
    for (const guess of fresh) {
      const key = value.canvasEpoch + ':' + guess.id;
      if (timers.has(guess.id)) clearTimeout(timers.get(guess.id));
      badges.value = { ...badges.value, [guess.id]: { key, points: guess.points } };
      timers.set(
        guess.id,
        setTimeout(() => {
          timers.delete(guess.id);
          if (badges.value[guess.id]?.key === key) {
            const next = { ...badges.value };
            delete next[guess.id];
            badges.value = next;
          }
        }, 1700),
      );
    }
    if (
      phase &&
      previous?.phase === 'choosing' &&
      value.phase === 'drawing' &&
      value.presenterId === value.me &&
      value.question
    ) {
      locked.value = value.question.title;
      if (lockTimer) clearTimeout(lockTimer);
      lockTimer = setTimeout(() => {
        locked.value = '';
        lockTimer = null;
      }, 1200);
    }
    const token = generation,
      scope = room.scope,
      epoch = value.canvasEpoch,
      currentPhase = value.phase;
    await nextTick();
    if (
      disposed ||
      token !== generation ||
      scope !== room.scope ||
      room.snapshot?.canvasEpoch !== epoch ||
      room.snapshot.phase !== currentPhase ||
      !connected.value ||
      !allowed()
    )
      return;
    if (phase)
      animate(
        root.value?.querySelector('.vue-draw-scene') || null,
        [{ opacity: 0 }, { opacity: 1 }],
        { duration: 150, easing: 'ease-out' },
      );
    for (const guess of fresh) {
      const badge = [
        ...(root.value?.querySelectorAll<HTMLElement>('[data-correct-badge]') || []),
      ].find((node) => node.dataset.correctBadge === guess.id);
      animate(
        badge || null,
        [
          { opacity: 0, transform: 'translateY(8px) scale(.8)' },
          { opacity: 1, transform: 'translateY(0) scale(1)' },
          { opacity: 1, transform: 'translateY(-2px)' },
          { opacity: 0, transform: 'translateY(-12px)' },
        ],
        { duration: 1700, easing: 'ease-out', fill: 'forwards' },
      );
    }
    const lastGuess = value.guesses.at(-1);
    if (
      lastGuess &&
      previous &&
      previous.canvasEpoch === epoch &&
      !previous.guesses.some((guess) => JSON.stringify(guess) === JSON.stringify(lastGuess)) &&
      gate?.take('feed:' + epoch + ':' + JSON.stringify(lastGuess), live)
    )
      animate(
        root.value?.querySelector('.vue-draw-guess-feed > p:last-child') || null,
        [
          { opacity: 0, transform: 'translateY(6px)' },
          { opacity: 1, transform: 'translateY(0)' },
        ],
        { duration: 180, easing: 'ease-out' },
      );
  }
  function tick(state: DrawSnapshot, seconds: number) {
    if (state.phase !== 'drawing') {
      previousSeconds = null;
      timerEpoch = '';
      return;
    }
    const crossed =
      timerEpoch === state.canvasEpoch &&
      previousSeconds !== null &&
      previousSeconds > 10 &&
      seconds <= 10 &&
      seconds > 0;
    timerEpoch = state.canvasEpoch;
    previousSeconds = seconds;
    if (
      crossed &&
      !baseline &&
      connected.value &&
      Date.now() - room.lastReceivedAt <= 2500 &&
      allowed() &&
      gate?.take('timeout:' + state.canvasEpoch)
    )
      animate(
        root.value?.querySelector('.vue-drawing-frame') || null,
        [{ borderColor: '#a6b8a5' }, { borderColor: '#b34b50' }, { borderColor: '#a6b8a5' }],
        { duration: 530, easing: 'ease-out' },
      );
  }
  watch(() => room.snapshot as DrawSnapshot | null, update, { flush: 'sync' });
  watch(
    () => room.scope,
    () => {
      clear();
      gate?.dispose();
      gate = MotionPolicy?.createGate();
    },
  );
  watch(connected, (value) => {
    if (!value) clear();
  });
  const visibility = () => clear();
  document.addEventListener('visibilitychange', visibility);
  const unbind = MotionPolicy?.subscribe(() => {
    if (!allowed()) clear();
  });
  onScopeDispose(() => {
    disposed = true;
    clear();
    gate?.dispose();
    unbind?.();
    document.removeEventListener('visibilitychange', visibility);
  });
  return { badges, locked, tick };
}
