import type { QuacksSnapshot } from '../../contracts/quacks';

type Point = { x: number; y: number };

// The former quacks-stitch.js presentation only: no commands, timers or room state ownership.
export function createQuacksMotion(
  host: () => HTMLElement | null,
  sound: (cue: string, key: string) => void,
) {
  const animations = new Set<Animation>(),
    nodes = new Set<HTMLElement>(),
    bursts = new Set<string>();
  let previous: QuacksSnapshot | null = null,
    current: QuacksSnapshot | null = null;
  let generation = 0,
    disposed = false,
    latestLive = false;
  const allowed = () => !disposed && !document.hidden && !!window.MotionPolicy?.allowsMotion();
  function visible(node: Element | null) {
    if (!node?.isConnected) return null;
    const box = node.getBoundingClientRect();
    if (
      box.width <= 0 ||
      box.height <= 0 ||
      box.bottom <= 0 ||
      box.right <= 0 ||
      box.top >= innerHeight ||
      box.left >= innerWidth
    )
      return null;
    return box;
  }
  function point(node: Element | null): Point | null {
    const box = visible(node);
    return box ? { x: box.left + box.width / 2, y: box.top + box.height / 2 } : null;
  }
  const find = (selector: string) => document.querySelector(selector);
  const pot = (id: string) => find(`[data-quacks-pot="${CSS.escape(id)}"]`);
  const slot = (id: string, position?: number) =>
    position === undefined
      ? null
      : pot(id)?.querySelector(`.pot-space[data-position="${position}"]`) || null;
  function clearVisuals() {
    generation++;
    for (const animation of animations) animation.cancel();
    animations.clear();
    for (const node of nodes) node.remove();
    nodes.clear();
  }
  function clear() {
    clearVisuals();
    previous = current = null;
    latestLive = false;
    bursts.clear();
  }
  function sprite(kind: string, x: number, y: number) {
    if (!allowed() || !host()) return null;
    const node = document.createElement('div');
    node.className = `vue-quacks-motion-${kind}`;
    node.style.left = `${x}px`;
    node.style.top = `${y}px`;
    node.setAttribute('aria-hidden', 'true');
    nodes.add(node);
    host()!.append(node);
    return node;
  }
  function animate(
    node: Element | null,
    frames: Keyframe[],
    options: KeyframeAnimationOptions,
    remove = true,
  ) {
    if (!node || !allowed()) {
      if (remove && node instanceof HTMLElement) {
        nodes.delete(node);
        node.remove();
      }
      return null;
    }
    const animation = window.MotionPolicy?.animate(node, frames, options);
    if (!animation) {
      if (remove && node instanceof HTMLElement) {
        nodes.delete(node);
        node.remove();
      }
      return null;
    }
    animations.add(animation);
    const finish = () => {
      animations.delete(animation);
      if (remove && node instanceof HTMLElement) {
        nodes.delete(node);
        node.remove();
      }
    };
    void animation.finished.then(finish, finish);
    return animation;
  }
  function ripple(at: Point) {
    for (let i = 0; i < 2; i++)
      animate(
        sprite('ripple', at.x - 12, at.y - 7),
        [
          { transform: 'scale(.2)', opacity: 0.8 },
          { transform: 'scale(4)', opacity: 0 },
        ],
        { duration: 750, delay: i * 90, easing: 'ease-out' },
      );
  }
  function flight(
    child: SVGElement | undefined,
    from: Point | null,
    to: Point | null,
    ripplePotId?: string,
  ) {
    if (!child || !from || !to || !allowed()) return;
    const node = sprite('sprite', 0, 0);
    if (!node) return;
    node.append(child);
    const epoch = generation;
    const animation = animate(
      node,
      [
        {
          transform: `translate(${from.x - 22}px,${from.y - 22}px) rotate(-15deg) scale(.9)`,
          opacity: 0.7,
        },
        {
          transform: `translate(${(from.x + to.x) / 2 - 22}px,${Math.min(from.y, to.y) - 82}px) rotate(20deg) scale(1.2)`,
          opacity: 1,
          offset: 0.45,
        },
        { transform: `translate(${to.x - 22}px,${to.y - 22}px) rotate(0) scale(.6)`, opacity: 1 },
      ],
      { duration: 650, easing: 'cubic-bezier(.2,.7,.35,1)' },
    );
    if (animation && ripplePotId)
      void animation.finished.then(
        () => {
          if (epoch === generation && allowed() && pot(ripplePotId)) ripple(to);
        },
        () => {},
      );
  }
  function ring(id: string) {
    const box = visible(pot(id));
    if (!box) return;
    const node = sprite('ring', box.left + box.width * 0.18, box.top + box.height * 0.18);
    if (!node) return;
    node.style.width = `${box.width * 0.64}px`;
    node.style.height = `${box.height * 0.64}px`;
    animate(
      node,
      [
        { transform: 'rotate(-25deg) scale(.7)', opacity: 0 },
        { transform: 'rotate(0) scale(1)', opacity: 1 },
        { transform: 'rotate(35deg) scale(1.2)', opacity: 0 },
      ],
      { duration: 1100 },
    );
  }
  function update(state: QuacksSnapshot, live: boolean) {
    const before = previous;
    const same =
      before?.code === state.code && before.roundId === state.roundId && before.me === state.me;
    if (!same || !live || state.interrupted) clearVisuals();
    previous = current = state;
    latestLive = !!before && same && live && !state.interrupted;
    if (!same) bursts.clear();
    if (!latestLive || !before) return;
    const own = state.recipes.find((p) => p.id === state.me),
      old = before.recipes.find((p) => p.id === state.me);
    if (!own || !old || own.hidden || old.hidden) return;
    const art = window.QuacksArt,
      key = `${state.code}:${state.roundId}:${state.version}`;
    const soundOnce = (cue: string) => sound(cue, `${cue}:${key}`);
    if (
      !own.exploded &&
      own.white !== null &&
      own.threshold !== null &&
      old.white !== null &&
      own.white >= own.threshold - 1 &&
      old.white < own.threshold - 1
    )
      soundOnce('quacks-danger');
    const bag = point(find(`[data-quacks-bag="${CSS.escape(own.id)}"]`));
    const added = (own.pot || []).filter(
      (c) => !(old.pot || []).some((p) => p.id === c.id && p.position === c.position),
    );
    if (
      state.phase === 'brewing' &&
      state.stage === 'drawing' &&
      !state.mine?.pending &&
      !state.mine?.waitingEffect &&
      !state.mine?.reserve.length &&
      pot(own.id)
    )
      for (const chip of added.slice(-3))
        flight(
          art?.token(chip, { size: 44, decorative: true }),
          bag,
          point(slot(own.id, chip.position)),
          own.id,
        );
    if (before.mine?.potion && !state.mine?.potion) {
      const removed = (old.pot || []).find((c) => !(own.pot || []).some((p) => p.id === c.id));
      if (removed)
        flight(
          art?.token(removed, { size: 44, decorative: true }),
          point(slot(own.id, removed.position)),
          point(find('[data-quacks-potion]')),
        );
    }
    const mine = state.mine,
      prior = before.mine;
    if (mine && prior) {
      const extra = mine.extraBought.length > prior.extraBought.length;
      if (mine.bought.length > prior.bought.length || extra) {
        soundOnce('quacks-buy');
        const bought = (extra ? mine.extraBought : mine.bought).at(-1);
        if (bought)
          flight(
            art?.token(bought, { size: 44, decorative: true }),
            point(find('[data-quacks-purchase]')),
            bag,
          );
      }
    }
    if (own.rubies > old.rubies) {
      soundOnce('quacks-ruby');
      flight(
        art?.resource('ruby', { size: 44, decorative: true }),
        point(pot(own.id)),
        point(find(`[data-quacks-ruby="${CSS.escape(own.id)}"]`)) || bag,
      );
    }
    for (const color of ['gold', 'copper', 'silver'] as const)
      if (old.coins?.[color] && !own.coins?.[color]) {
        soundOnce('quacks-witch');
        ring(own.id);
      }
    for (const player of state.recipes) {
      const priorPlayer = before.recipes.find((p) => p.id === player.id);
      if (!priorPlayer || player.score <= priorPlayer.score) continue;
      const box = visible(find(`[data-quacks-player="${CSS.escape(player.id)}"]`));
      if (!box) continue;
      const node = sprite('score', box.right - 42, box.top + 5);
      if (!node) continue;
      node.textContent = `+${player.score - priorPlayer.score}`;
      animate(
        node,
        [
          { transform: 'translateY(8px)', opacity: 0 },
          { transform: 'translateY(-4px)', opacity: 1 },
          { transform: 'translateY(-24px)', opacity: 0 },
        ],
        { duration: 950 },
      );
    }
  }
  function burst(events: { id: string; playerId: string }[]) {
    if (!current || !latestLive || !allowed()) return;
    const own = current.recipes.find((p) => p.id === current!.me),
      target = own && pot(own.id);
    if (!own || !target) return;
    const event = events.find((e) => e.playerId === own.id && e.id === own.explosionId);
    if (!event || bursts.has(event.id)) return;
    bursts.add(event.id);
    const at = point(slot(own.id, own.position ?? undefined)) || point(target);
    if (!at) return;
    for (let i = 0; i < 10; i++) {
      const angle = (i * Math.PI * 2) / 10;
      animate(
        sprite('puff', at.x - 27, at.y - 27),
        [
          { transform: 'translate(0,0) scale(.2)', opacity: 0.9 },
          {
            transform: `translate(${Math.cos(angle) * 110}px,${Math.sin(angle) * 85 - 25}px) scale(2.6)`,
            opacity: 0,
          },
        ],
        { duration: 950, delay: i * 12, easing: 'ease-out' },
      );
    }
    animate(
      target.querySelector('.vue-quacks-pot-art'),
      [
        { transform: 'translateX(0)' },
        { transform: 'translateX(-5px)' },
        { transform: 'translateX(5px)' },
        { transform: 'translateX(-3px)' },
        { transform: 'translateX(0)' },
      ],
      { duration: 390 },
      false,
    );
  }
  window.addEventListener('resize', clearVisuals);
  window.addEventListener('scroll', clearVisuals, true);
  const unsubscribe = window.MotionPolicy?.subscribe(() => {
    if (!allowed()) clearVisuals();
  });
  return {
    update,
    burst,
    clear,
    cancelVisuals: clearVisuals,
    destroy() {
      disposed = true;
      clear();
      unsubscribe?.();
      window.removeEventListener('resize', clearVisuals);
      window.removeEventListener('scroll', clearVisuals, true);
    },
  };
}
