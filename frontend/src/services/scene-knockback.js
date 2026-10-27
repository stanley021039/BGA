import { motionAllowed, watchMotionCancellation } from './motion-lifetime.js';
const active = new Set();
export function playKnockback(node, visitor) {
  const hit = visitor.knockback;
  if (!hit || !node?.animate || !motionAllowed() || active.size >= 6) return () => {};
  const rect = node.closest('.lobby-backdrop')?.getBoundingClientRect();
  if (!rect?.width || !rect.height) return () => {};
  const dx = ((hit.fromX - visitor.x) * rect.width) / 100;
  const dy = ((hit.fromY - visitor.y) * rect.height) / 100;
  const animation = node.animate(
    [
      { translate: `${dx}px ${dy}px`, rotate: '0deg' },
      { translate: `${dx * 0.4}px ${dy * 0.4 - 38}px`, rotate: '16deg', offset: 0.5 },
      { translate: '0px 0px', rotate: '0deg' },
    ],
    { duration: 450, easing: 'ease-out' },
  );
  let live = true,
    release = () => {};
  function stop() {
    if (!live) return;
    live = false;
    active.delete(animation);
    release();
    animation.onfinish = animation.oncancel = null;
    animation.cancel();
  }
  active.add(animation);
  animation.onfinish = animation.oncancel = stop;
  release = watchMotionCancellation(stop);
  if (!live) release();
  return stop;
}
