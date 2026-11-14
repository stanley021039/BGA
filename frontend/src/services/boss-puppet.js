import { motionAllowed, watchMotionCancellation } from './motion-lifetime.js';
import abilities from '../../../public/shared/boss-abilities.json' with { type: 'json' };
const owners = new Set();
export function bossMotionProfile(id) {
  if (['cthulhu', 'mutalith', 'gyo'].includes(id))
    return { gait: 'crawl', period: 2200, sway: 3.5, lift: 2 };
  if (['greeza', 'prismatic-void'].includes(id))
    return { gait: 'float', period: 2800, sway: 2, lift: 7 };
  if (id === 'steel-behemoth') return { gait: 'machine', period: 1600, sway: 0.7, lift: 1.5 };
  if (['arkveld', 'hyper-zetton'].includes(id))
    return { gait: 'stalk', period: 1050, sway: 2.5, lift: 4 };
  return { gait: 'heavy', period: 1450, sway: 1.3, lift: 3 };
}
// Two lobby bosses, three gait tracks plus one cast and one hit each; no JS frame loop.
export function createBossPuppet(node, id) {
  if (!node?.animate || owners.size >= 2 || !motionAllowed()) return null;
  owners.add(node);
  const profile = bossMotionProfile(id),
    tracks = new Set();
  let gait = '',
    castKey = '',
    attack = null,
    hit = null,
    arrival = null,
    arrivalKey = 0,
    previousHealth,
    live = true;
  const parts = ['head', 'torso', 'lower'].map((part) =>
    node.querySelector('[data-boss-part="' + part + '"]'),
  );
  function animate(target, frames, options, set = tracks) {
    if (!target?.animate) return null;
    const a = target.animate(frames, options);
    if (set) set.add(a);
    return a;
  }
  function clearGait() {
    for (const a of tracks) a.cancel();
    tracks.clear();
  }
  function stop() {
    if (!live) return;
    live = false;
    clearGait();
    attack?.cancel();
    hit?.cancel();
    arrival?.cancel();
    owners.delete(node);
    release();
    node.removeAttribute('data-animated');
  }
  let release = () => {};
  release = watchMotionCancellation(stop);
  if (!live) {
    release();
    return null;
  }
  node.setAttribute('data-animated', '');
  function update(state, now) {
    if (!live) return;
    if (!state.connected || !state.health || state.paralysed) {
      stop();
      return;
    }
    const next = state.moving ? 'walk' : 'idle';
    if (state.arrivalAt && arrivalKey !== state.arrivalAt && now - state.arrivalAt < 1100) {
      arrivalKey = state.arrivalAt;
      arrival = animate(
        node,
        [
          { transform: 'translateY(-75vh) scale(.8,1.15)', offset: 0 },
          { transform: 'translateY(0) scale(1.18,.78)', offset: 700 / 1100 },
          { transform: 'translateY(-12px) scale(.96,1.05)', offset: 0.83 },
          { transform: 'translateY(0) scale(1,1)', offset: 1 },
        ],
        { duration: 1100, easing: 'cubic-bezier(.4,0,1,1)' },
        null,
      );
      if (arrival) arrival.currentTime = Math.max(0, now - state.arrivalAt);
    }
    if (next !== gait) {
      gait = next;
      clearGait();
      const motion = state.moving ? 1 : 0.35,
        period = state.moving ? profile.period : profile.period * 1.8;
      parts.forEach((part, i) => {
        const sign = i === 1 ? -1 : 1,
          sway = profile.sway * motion * sign,
          lift = profile.lift * motion * (i === 2 ? 0.4 : 1);
        animate(
          part,
          [
            { transform: 'translate(0,0) rotate(0deg) scale(1,1)' },
            {
              transform:
                'translate(' +
                sway +
                'px,' +
                -lift +
                'px) rotate(' +
                sway * 0.7 +
                'deg) scale(1.025,1.015)',
              offset: 0.5,
            },
            { transform: 'translate(0,0) rotate(0deg) scale(1,1)' },
          ],
          {
            duration: period,
            iterations: Infinity,
            easing: 'ease-in-out',
            delay: (-period * i) / 3,
          },
        );
      });
    }
    const intent = state.intent,
      spec = abilities.find((a) => a.id === intent?.effect);
    if (spec && intent.until > now && intent.until !== castKey) {
      castKey = intent.until;
      attack?.cancel();
      const duration = spec.windup + spec.duration,
        at = spec.windup / duration;
      const force = (spec.slot === 'r' ? 1.6 : 1) * (state.facing === 'left' ? -1 : 1);
      attack = animate(
        node.querySelector('[data-boss-action]'),
        [
          { transform: 'translate(0,0) rotate(0deg) scale(1,1)', offset: 0 },
          {
            transform:
              'translate(' + -4 * force + 'px,4px) rotate(' + -5 * force + 'deg) scale(1.04,.94)',
            offset: at * 0.7,
          },
          {
            transform:
              'translate(' + -6 * force + 'px,3px) rotate(' + -7 * force + 'deg) scale(1.06,.92)',
            offset: at * 0.98,
          },
          {
            transform:
              'translate(' + 12 * force + 'px,-3px) rotate(' + 7 * force + 'deg) scale(1.08,1.04)',
            offset: at + (1 - at) * 0.12,
          },
          {
            transform: 'translate(' + -3 * force + 'px,2px) rotate(-2deg) scale(.98,1.02)',
            offset: at + (1 - at) * 0.5,
          },
          { transform: 'translate(0,0) rotate(0deg) scale(1,1)', offset: 1 },
        ],
        { duration, easing: 'ease-out' },
        null,
      );
      if (attack) attack.currentTime = Math.max(0, now - (intent.until - spec.windup));
    }
    if (previousHealth !== undefined && state.health < previousHealth) {
      hit?.cancel();
      hit = animate(
        node,
        [
          { translate: '0px 0px' },
          { translate: '-5px -2px', offset: 0.3 },
          { translate: '3px 0px', offset: 0.6 },
          { translate: '0px 0px' },
        ],
        { duration: 280, easing: 'ease-out' },
        null,
      );
    }
    previousHealth = state.health;
  }
  return { update, dispose: stop };
}
