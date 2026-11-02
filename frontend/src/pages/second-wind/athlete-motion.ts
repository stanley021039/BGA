import MotionPolicy from '../../engines/motion-policy.js';
import { motionAllowed, watchMotionCancellation } from '../../services/motion-lifetime.js';
import { trackPoint } from './track-layout';
import type { AthleteGame } from '../../contracts/second-wind';
import type {} from '../../stores/preferences';

type Event = AthleteGame['events'][number];
export interface MotionStep {
  position: number;
  direction: number;
  warp?: boolean;
  trip?: boolean;
}
export interface AthletePath {
  id: string;
  racer: string;
  playerId: string;
  steps: MotionStep[];
}
export interface AthleteDice {
  id: number;
  playerId: string;
  value: number;
  reroll: boolean;
}
export interface AthleteCue {
  ticket: number;
  dice: AthleteDice[];
  paths: AthletePath[];
  game: AthleteGame;
}
const die = (e: Event): e is Event & { value: number; playerId: string } =>
  ['rolloff-die', 'die', 'reroll'].includes(e.type) &&
  Number.isInteger(e.value) &&
  (e.value || 0) >= 1 &&
  (e.value || 0) <= 6 &&
  typeof e.playerId === 'string';
const position = (n: unknown): n is number =>
  Number.isInteger(n) && (n as number) >= 0 && (n as number) <= 30;

// Bounded presentation only: authority, choices and scores never wait for these paths.
export function planAthletePaths(
  events: Event[],
  game: AthleteGame,
  previous?: AthleteGame,
): AthletePath[] {
  const paths = new Map<string, AthletePath>();
  for (const e of events.slice(-100)) {
    if (
      !e.racer ||
      !e.playerId ||
      !['move', 'warp', 'trip'].includes(e.type) ||
      (e.race !== undefined && e.race !== game.race)
    )
      continue;
    const racer = game.racers?.find((r) => r.id === e.racer);
    if (!racer || !game.players.includes(e.playerId)) continue;
    if (!paths.has(e.racer) && paths.size >= 6) continue;
    const path = paths.get(e.racer) || {
      id: String(e.id),
      racer: e.racer,
      playerId: e.playerId,
      steps: [],
    };
    const direction = e.direction === -1 ? -1 : 1;
    if (e.type === 'trip')
      path.steps.push({
        position: position(e.from) ? e.from : racer.position,
        direction,
        trip: true,
      });
    else if (position(e.from) && position(e.to)) {
      if (!path.steps.length) path.steps.push({ position: e.from, direction });
      if (e.type === 'warp') path.steps.push({ position: e.to, direction, warp: true });
      else {
        const sign = Math.sign(e.to - e.from);
        for (let p = e.from + sign; sign && (sign > 0 ? p <= e.to : p >= e.to); p += sign)
          path.steps.push({ position: p, direction });
      }
    }
    if (path.steps.length > 128) path.steps = path.steps.slice(-128);
    if (path.steps.length) paths.set(e.racer, path);
  }
  // Some authoritative effects (displacement, finale reset, direction change)
  // publish only their effect event. Fill their unrepresented position changes
  // from the preceding live projection; never infer a walk through warp cells.
  if (previous && previous.race === game.race && events.length) {
    for (const racer of game.racers || []) {
      if (paths.has(racer.id) || paths.size >= 6) continue;
      const before = previous.racers?.find((r) => r.id === racer.id);
      if (
        !before ||
        !position(before.position) ||
        !position(racer.position) ||
        (before.position === racer.position && previous.direction === game.direction)
      )
        continue;
      const displaced = events.some((e) => e.type === 'displace' && e.racer === racer.id);
      const steps: MotionStep[] = [
        { position: before.position, direction: previous.direction || 1 },
      ];
      if (displaced && previous.direction === game.direction) {
        const sign = Math.sign(racer.position - before.position);
        for (
          let p = before.position + sign;
          sign && (sign > 0 ? p <= racer.position : p >= racer.position);
          p += sign
        )
          steps.push({ position: p, direction: game.direction || 1 });
      } else steps.push({ position: racer.position, direction: game.direction || 1, warp: true });
      paths.set(racer.id, {
        id: 'projection-' + events.at(-1)!.id + '-' + racer.id,
        racer: racer.id,
        playerId: racer.playerId,
        steps,
      });
    }
  }
  return [...paths.values()];
}
export function athletePathFrames(
  path: AthletePath,
  target: { position: number; direction: number },
  width: number,
  height: number,
): Keyframe[] {
  const end = trackPoint(target.position, target.direction);
  const dx = Number.parseFloat(end.left),
    dy = Number.parseFloat(end.top);
  const frames: Keyframe[] = [];
  for (const step of path.steps) {
    const p = trackPoint(step.position, step.direction);
    const transform = `translate(${((Number.parseFloat(p.left) - dx) * width) / 100}px, ${((Number.parseFloat(p.top) - dy) * height) / 100}px)`;
    if (step.warp && frames.length) {
      const previous = frames.at(-1)!;
      frames.push({ ...previous, opacity: 0, easing: 'step-end' });
      frames.push({ transform, opacity: 0, easing: 'step-end' });
    }
    if (step.trip) frames.push({ transform: transform + ' rotate(75deg)', opacity: 1 });
    frames.push({ transform, opacity: 1 });
  }
  frames.push({ transform: 'translate(0px, 0px)', opacity: 1 });
  return frames;
}

export function createAthleteMotion(onDone: (id: string) => void, onStop: () => void = () => {}) {
  const gate = MotionPolicy?.createGate();
  const animations = new Set<Animation>();
  let release = () => {},
    scope = '',
    baseline = true,
    disposed = false,
    ticket = 0,
    lastId = 0,
    lastRevision = -1;
  let previous: AthleteGame | undefined;
  function stop(reset = false) {
    ticket++;
    release();
    release = () => {};
    for (const animation of animations) animation.cancel();
    animations.clear();
    onStop();
    if (reset) baseline = true;
  }
  const pagehide = () => stop(true);
  if (typeof window !== 'undefined') window.addEventListener('pagehide', pagehide);
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', pagehide);
  function observe(
    nextScope: string,
    game: AthleteGame,
    connected: boolean,
    serverNow = Date.now(),
  ): { dice: AthleteDice[]; cue: AthleteCue | null } {
    const prior = previous;
    previous = game;
    const dice = game.events
      .filter(die)
      .slice(-6)
      .map((e) => ({
        id: e.id,
        playerId: e.playerId,
        value: e.value,
        reroll: e.type === 'reroll',
      }));
    if (disposed) return { dice, cue: null };
    if (nextScope !== scope) {
      stop(true);
      scope = nextScope;
      lastId = 0;
      lastRevision = -1;
    }
    if (!connected) stop(true);
    const events = game.events.filter((e) => e.id > lastId);
    const gap = lastId > 0 && !!events.length && events[0]!.id > lastId + 1;
    const recent = (e: Event) =>
      typeof e.at === 'number' && e.at >= serverNow - 3000 && e.at <= serverNow + 1000;
    // Waiting for a human can exceed the generic five-second gate. A fresh
    // server timestamp distinguishes that from delayed catch-up events.
    const freshAfterIdle =
      connected &&
      !baseline &&
      !gap &&
      game.revision >= lastRevision &&
      events.length > 0 &&
      events.every(recent);
    const live =
      gate?.update({ code: scope, version: game.revision } as never, {
        connected: connected && !baseline && !gap,
      }) ||
      false ||
      freshAfterIdle;
    baseline = !connected;
    for (const e of game.events) gate?.take(String(e.id), live);
    lastId = Math.max(lastId, ...game.events.map((e) => e.id));
    lastRevision = Math.max(lastRevision, game.revision);
    const freshEvents = events.filter((e) => e.at === undefined || recent(e));
    if (!live || !motionAllowed() || !freshEvents.length) return { dice, cue: null };
    stop();
    return {
      dice,
      cue: {
        ticket,
        dice: freshEvents
          .filter(die)
          .slice(-6)
          .map((e) => ({
            id: e.id,
            playerId: e.playerId,
            value: e.value,
            reroll: e.type === 'reroll',
          })),
        paths: planAthletePaths(freshEvents, game, prior),
        game,
      },
    };
  }
  function play(root: HTMLElement | null, cue: AthleteCue) {
    if (disposed || cue.ticket !== ticket) return;
    if (!root || !motionAllowed()) {
      onStop();
      return;
    }
    release = watchMotionCancellation(() => stop(true));
    if (!motionAllowed()) return;
    const own = (
      node: Element | null,
      frames: Keyframe[],
      duration: number,
      id?: string,
      delay = 0,
    ) => {
      if (!node || animations.size >= 12) {
        if (id) onDone(id);
        return;
      }
      const animation = MotionPolicy?.animate(node, frames, { duration, delay, easing: 'linear' });
      if (!animation) {
        if (id) onDone(id);
        return;
      }
      animations.add(animation);
      void animation.finished
        .catch(() => {})
        .then(() => {
          animations.delete(animation);
          animation.cancel();
          if (cue.ticket === ticket) {
            if (id) onDone(id);
            if (!animations.size) {
              release();
              release = () => {};
            }
          }
        });
    };
    for (const d of cue.dice) {
      const node = [...root.querySelectorAll('[data-athlete-die]')].find(
        (n) => n.getAttribute('data-athlete-die') === String(d.id),
      );
      own(
        node || null,
        [
          { transform: 'rotate(-300deg) scale(.7)' },
          { transform: 'rotate(25deg) scale(1.15)' },
          { transform: 'rotate(0deg) scale(1)' },
        ],
        650,
      );
    }
    const track = root.querySelector<HTMLElement>('.athlete-track');
    if (track) {
      const size = track.getBoundingClientRect();
      for (const path of cue.paths) {
        const racer = cue.game.racers?.find((r) => r.id === path.racer);
        if (!racer) {
          onDone(path.id);
          continue;
        }
        const actual = [...track.querySelectorAll<HTMLElement>('[data-athlete-racer]')].find(
          (n) => n.getAttribute('data-athlete-racer') === path.racer,
        );
        const ghost = [...track.querySelectorAll<HTMLElement>('[data-athlete-ghost]')].find(
          (n) => n.getAttribute('data-athlete-ghost') === path.id,
        );
        if (ghost) ghost.hidden = !!actual;
        const node = actual || ghost || null;
        const frames = athletePathFrames(
          path,
          { position: racer.position, direction: cue.game.direction || 1 },
          size.width,
          size.height,
        );
        own(
          node,
          frames,
          Math.min(2200, Math.max(240, frames.length * 75)),
          path.id,
          cue.dice.length ? 650 : 0,
        );
      }
    } else for (const path of cue.paths) onDone(path.id);
    if (!animations.size) {
      release();
      release = () => {};
    }
  }
  return {
    observe,
    play,
    stop,
    dispose() {
      disposed = true;
      stop();
      gate?.dispose();
      if (typeof window !== 'undefined') window.removeEventListener('pagehide', pagehide);
      if (typeof document !== 'undefined')
        document.removeEventListener('visibilitychange', pagehide);
    },
    active: () => animations.size,
  };
}
