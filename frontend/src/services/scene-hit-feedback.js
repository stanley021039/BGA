import GameSounds from '../engines/game-sounds.js';
import { motionAllowed, watchMotionCancellation } from './motion-lifetime.js';

// Presentation only: consume settled receipts, never infer damage from animation.
export function createSceneHitFeedback({
  root,
  now = () => performance.now(),
  sounds = GameSounds.create({ maxGapMs: 15000 }),
}) {
  const seen = new Map(),
    reactions = new Map(),
    bursts = new Set(),
    shakes = new Set();
  const lastReact = new Map();
  const bossDamage = new Map();
  let bossFloor = -Infinity;
  function rememberBoss(event, hit) {
    if (event.at <= bossFloor) return false;
    const key = `${event.id}:${hit.toId}`;
    const previous = bossDamage.get(key)?.damage || 0;
    bossDamage.set(key, { damage: Math.max(previous, hit.damage || 0), at: event.at });
    while (bossDamage.size > 512) {
      const oldest = bossDamage.keys().next().value;
      bossFloor = Math.max(bossFloor, bossDamage.get(oldest).at);
      bossDamage.delete(oldest);
    }
    return hit.damage > previous;
  }
  let identity = '',
    initialized = false,
    latest = 0,
    floor = -Infinity;
  let lastSound = -Infinity,
    lastShake = -Infinity,
    destroyed = false,
    releaseMotion;

  function stopVisuals() {
    const release = releaseMotion;
    releaseMotion = undefined;
    release?.();
    for (const stop of [...reactions.values(), ...bursts, ...shakes]) stop();
    reactions.clear();
    bursts.clear();
    shakes.clear();
  }
  function reset() {
    stopVisuals();
    sounds.reset();
    seen.clear();
    bossDamage.clear();
    bossFloor = -Infinity;
    lastReact.clear();
    initialized = false;
    latest = 0;
    floor = -Infinity;
    lastSound = lastShake = -Infinity;
  }
  function animate(node, frames, duration, pool, remove) {
    if (!node?.animate) {
      remove?.();
      return () => {};
    }
    const animation = node.animate(frames, { duration, easing: 'ease-out' });
    let live = true;
    function stop() {
      if (!live) return;
      live = false;
      pool.delete(stop);
      animation.onfinish = animation.oncancel = null;
      animation.cancel();
      remove?.();
      if (!reactions.size && !bursts.size && !shakes.size) {
        releaseMotion?.();
        releaseMotion = undefined;
      }
    }
    pool.add(stop);
    stop.node = node;
    animation.onfinish = animation.oncancel = stop;
    return stop;
  }
  function react(avatar, hit, tier) {
    if (!avatar || reactions.size >= 6 || bursts.size >= 6) return;
    const portrait = avatar.querySelector('.scene-avatar-portrait');
    const dir = hit.fromX > hit.toX ? -1 : 1;
    if (portrait?.animate && !hit.blocked) {
      reactions.get(portrait)?.();
      const pool = new Set();
      const stop = animate(
        portrait,
        [
          { translate: '0px 0px', scale: '1 1' },
          {
            translate: `${dir * (tier === 2 ? 3 : 1.5)}px 0px`,
            scale: tier === 2 ? '1.05 .95' : '1.025 .975',
            offset: 0.17,
          },
          { translate: `${-dir * 0.5}px 0px`, scale: '0.99 1.01', offset: 0.55 },
          { translate: '0px 0px', scale: '1 1' },
        ],
        tier === 2 ? 190 : 150,
        pool,
        () => {
          if (reactions.get(portrait) === stop) reactions.delete(portrait);
        },
      );
      reactions.set(portrait, stop);
    }
    const burst = document.createElement('div');
    burst.className = 'scene-hit-burst';
    burst.dataset.tier = hit.blocked ? 'guard' : String(tier);
    burst.setAttribute('aria-hidden', 'true');
    burst.innerHTML =
      '<svg viewBox="0 0 80 80"><circle cx="40" cy="40" r="23"/><path d="m40 7 5 24 22 9-22 5-5 28-6-27-27-6 27-7Z"/><path d="m13 13 12 12m30 30 12 12m0-54L55 25M25 55 13 67"/></svg>';
    const box = avatar.getBoundingClientRect(),
      art = portrait?.getBoundingClientRect();
    const scale = box.width / (avatar.offsetWidth || box.width || 1) || 1;
    burst.style.left =
      (art?.width ? (art.left + art.width / 2 - box.left) / scale : avatar.offsetWidth / 2) + 'px';
    burst.style.top = (art?.height ? (art.top + art.height / 2 - box.top) / scale : -24) + 'px';
    avatar.appendChild(burst);
    animate(
      burst,
      [
        { opacity: 0, scale: '.35' },
        { opacity: 0.9, scale: '1', offset: 0.18 },
        { opacity: 0, scale: hit.blocked ? '1.1' : '1.35' },
      ],
      tier === 2 ? 230 : 170,
      bursts,
      () => burst.remove(),
    );
  }
  function shake(stage, tier, time) {
    if (time - lastShake < 220 || shakes.size) return;
    lastShake = time;
    const amount = tier === 2 ? 2 : tier === 1 ? 1.2 : 0.6;
    // Keep the static background and HUD fixed; only the combat visual layers move.
    for (const node of stage.querySelectorAll('.lobby-visitors, .lobby-attack-layer')) {
      if (shakes.size >= 2) break;
      animate(
        node,
        [
          { translate: '0px 0px' },
          { translate: `${amount}px -.5px`, offset: 0.14 },
          { translate: `${-amount * 0.65}px .4px`, offset: 0.4 },
          { translate: `${amount * 0.25}px 0px`, offset: 0.68 },
          { translate: '0px 0px' },
        ],
        170,
        shakes,
      );
    }
  }
  function update(snapshot, { connected = true, motion = true, scope = 'lobby' } = {}) {
    if (destroyed) return;
    if (!snapshot || !connected || document.hidden) {
      reset();
      return;
    }
    const context = `${scope}:${snapshot.selfId}:${snapshot.arena?.match?.id || ''}`;
    if (context !== identity) {
      reset();
      identity = context;
    }
    if (initialized && snapshot.serverNow < latest) return;
    for (const [node, stop] of reactions) if (!node.isConnected) stop();
    for (const stop of [...bursts, ...shakes]) if (!stop.node.isConnected) stop();
    sounds.update({ code: context, version: snapshot.serverNow }, { connected });
    const baseline = !initialized;
    initialized = true;
    latest = snapshot.serverNow;
    if (baseline) {
      floor = latest;
      for (const event of snapshot.attacks || [])
        if (event.effect?.startsWith('boss_'))
          for (const hit of event.hits || []) rememberBoss(event, hit);
      return;
    }
    const time = now(),
      stage = root();
    const fresh = [];
    for (const event of snapshot.attacks || []) {
      if (event.cancelled) continue;
      const hits = event.hits ?? [
        {
          toId: event.toId,
          toX: event.toX,
          toY: event.toY,
          damage: event.damage,
          critical: event.critical,
        },
      ];
      for (const hit of hits) {
        if (hit.pending || hit.missed || (!hit.blocked && !(hit.damage > 0))) continue;
        const boss = event.effect?.startsWith('boss_') && hit.phase === undefined;
        // Boss receipts accumulate damage per victim after a windup, without phase timestamps.
        // Observe only a new increase on a live stream; baseline totals never replay.
        if (boss && (!rememberBoss(event, hit) || latest > (event.until || event.at + 4400) + 750))
          continue;
        const at = boss ? latest : event.at + (hit.delayMs || 0);
        const key = boss
          ? `${event.id}:${hit.toId}:boss:${hit.damage}`
          : `${event.id}:${hit.reflectionIndex ?? hit.toId + ':' + (hit.phase || 'legacy')}`;
        if (at <= floor || at > latest || seen.has(key)) continue;
        seen.set(key, at);
        while (seen.size > 512) {
          const oldest = seen.keys().next().value;
          floor = Math.max(floor, seen.get(oldest));
          seen.delete(oldest);
        }
        // The shared stream coalesces updates for 400ms and sweeps every 250ms.
        if (latest - at > 750) continue;
        fresh.push({
          ...hit,
          fromX: event.fromX,
          fromId: event.fromId,
          key,
          tier: hit.blocked ? 0 : event.slot === 'r' ? 2 : hit.critical ? 1 : 0,
        });
      }
    }
    fresh.sort((a, b) => b.tier - a.tier);
    let local;
    const actors = new Map(
      [...(stage?.querySelectorAll('[data-ping-player]') || [])].map((node) => [
        node.dataset.pingPlayer,
        node,
      ]),
    );
    for (const hit of fresh) {
      if (!local && (hit.fromId === snapshot.selfId || hit.toId === snapshot.selfId)) local = hit;
      if (time - (lastReact.get(hit.toId) ?? -Infinity) < 110) continue;
      lastReact.set(hit.toId, time);
      while (lastReact.size > 128) lastReact.delete(lastReact.keys().next().value);
      if (motion && motionAllowed()) react(actors.get(hit.toId), hit, hit.tier);
    }
    if (local) {
      if (time - lastSound >= 250) {
        lastSound = time;
        const clip = sounds.play(
          local.blocked
            ? 'combat-block'
            : local.tier === 2
              ? 'combat-heavy'
              : local.tier === 1
                ? 'combat-critical'
                : 'combat-hit',
          local.key,
        );
        if (clip && local.tier === 1 && !local.blocked) clip.playbackRate = 0.92;
      }
      if (!local.blocked && stage && motion && motionAllowed()) shake(stage, local.tier, time);
    }
    if (!motion) stopVisuals();
    if ((reactions.size || bursts.size || shakes.size) && !releaseMotion) {
      releaseMotion = watchMotionCancellation(stopVisuals);
      if (!reactions.size && !bursts.size && !shakes.size) {
        releaseMotion();
        releaseMotion = undefined;
      }
    }
  }
  const hide = () => {
    if (document.hidden) reset();
  };
  const leave = () => reset();
  document.addEventListener('visibilitychange', hide);
  window.addEventListener('pagehide', leave);
  return {
    update,
    stopVisuals,
    reset,
    size: () => ({
      seen: seen.size,
      bossReceipts: bossDamage.size,
      reactions: reactions.size,
      bursts: bursts.size,
      shakes: shakes.size,
    }),
    destroy() {
      if (destroyed) return;
      reset();
      sounds.destroy();
      destroyed = true;
      document.removeEventListener('visibilitychange', hide);
      window.removeEventListener('pagehide', leave);
    },
  };
}
