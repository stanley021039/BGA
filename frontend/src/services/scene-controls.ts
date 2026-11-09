import { computed, onScopeDispose, reactive, ref, watch } from 'vue';
import type { LobbySnapshot } from '../contracts/lobby';
import combatRules from '../../../public/shared/scene-rules.json';

export type SceneAction = 'q' | 'e' | 'r' | 'c' | 'up' | 'down' | 'left' | 'right';
export type SceneDirection = readonly [number, number];
export const sceneDirections = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
} as const;
export function sceneInputBlocked() {
  const active = document.activeElement;
  return (
    document.hidden ||
    !!document.querySelector('dialog[open], :popover-open, .vue-room-drawer-backdrop') ||
    (active instanceof Element &&
      !!active.closest(
        'input,textarea,select,[contenteditable]:not([contenteditable="false"]),[inert]',
      ))
  );
}

// Keyboard and touch share locks. A stale response cannot affect a new room.
export function useSceneControls(options: {
  context: () => string;
  enabled: () => boolean;
  snapshot: () => LobbySnapshot | null;
  teleportCost?: number;
  send: (action: SceneAction, direction?: SceneDirection) => Promise<boolean>;
}) {
  const pending = reactive<Record<string, boolean>>({});
  const until = reactive<Record<string, number>>({});
  const now = ref(Date.now());
  let generation = 0,
    disposed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const group = (action: SceneAction) => (action in sceneDirections ? 'move' : action);
  function tick() {
    clearTimeout(timer);
    timer = undefined;
    now.value = Date.now();
    if (!disposed && !document.hidden && Object.values(until).some((value) => value > now.value))
      timer = setTimeout(tick, 100);
  }
  function seconds(action: SceneAction) {
    return Math.max(0, Math.ceil(((until[group(action)] || 0) - now.value) / 1000));
  }
  const knockedOut = computed(() => {
    const snapshot = options.snapshot();
    const own = snapshot?.visitors.find((v) => v.id === snapshot.selfId);
    return !!own && own.health === 0;
  });
  const own = computed(() => {
    const snapshot = options.snapshot();
    return snapshot?.visitors.find((v) => v.id === snapshot.selfId);
  });
  const energy = computed(() => own.value?.energy ?? 0);
  const energyMaximum = computed(() => own.value?.energyMaximum ?? combatRules.energy.maximum);
  function disabled(action: SceneAction) {
    return (
      !options.enabled() ||
      knockedOut.value ||
      !!pending[group(action)] ||
      seconds(action) > 0 ||
      (until.flight || 0) > now.value ||
      (!(action in sceneDirections) && (until.seal || 0) > now.value) ||
      (action === 'c' &&
        ((until.teleportBlocked || 0) > now.value || energy.value < (options.teleportCost ?? 0))) ||
      (action === 'r' && energy.value < energyMaximum.value)
    );
  }
  async function run(action: SceneAction, direction?: SceneDirection) {
    tick();
    if (disposed || sceneInputBlocked() || disabled(action)) return false;
    const epoch = generation,
      key = group(action);
    pending[key] = true;
    try {
      const ok = await options.send(action, direction);
      if (ok && epoch === generation && !disposed) {
        until[key] = Math.max(
          until[key] || 0,
          Date.now() + (key === 'move' ? 200 : key === 'c' ? 1000 : combatRules.attackCooldownMs),
        );
        tick();
      }
      return ok;
    } finally {
      if (epoch === generation && !disposed) pending[key] = false;
    }
  }
  watch(
    options.context,
    () => {
      generation++;
      for (const key of Object.keys(pending)) delete pending[key];
      for (const key of Object.keys(until)) delete until[key];
      tick();
    },
    { flush: 'sync' },
  );
  watch(
    options.snapshot,
    (snapshot) => {
      if (!snapshot) return;
      const own = snapshot.visitors.find((v) => v.id === snapshot.selfId);
      until.flight = Date.now() + Math.max(0, (own?.heroFlightUntil || 0) - snapshot.serverNow);
      until.seal = Date.now() + Math.max(0, (own?.sealedUntil || 0) - snapshot.serverNow);
      until.teleportBlocked =
        Date.now() + Math.max(0, (own?.teleportBlockedUntil || 0) - snapshot.serverNow);
      // Server timestamps also cover actions from another tab or keyboard.
      for (const event of snapshot.attacks) {
        if (event.fromId !== snapshot.selfId) continue;
        const remaining = Math.max(
          0,
          Math.min(
            combatRules.attackCooldownMs,
            event.at + combatRules.attackCooldownMs - snapshot.serverNow,
          ),
        );
        if (remaining) until[event.slot] = Math.max(until[event.slot] || 0, Date.now() + remaining);
      }
      tick();
    },
    { immediate: true },
  );
  document.addEventListener('visibilitychange', tick);
  onScopeDispose(() => {
    disposed = true;
    generation++;
    clearTimeout(timer);
    document.removeEventListener('visibilitychange', tick);
  });
  return { run, pending, seconds, disabled, knockedOut, energy, energyMaximum };
}
