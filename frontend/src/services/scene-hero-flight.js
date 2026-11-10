import { heroFlightLift, heroFlightArc } from './hero-flight-path.js';
import { motionAllowed, watchMotionCancellation } from './motion-lifetime.js';
const active = new Set();
// Move the actual character, including its name, on the same 2100ms server path.
// Web Animations shares the browser timeline; no second animation loop is needed.
export function playHeroFlight(node, event) {
  if (!node?.animate || !motionAllowed() || event.cancelled || active.size >= 6) return () => {};
  const rect = node.closest('.lobby-backdrop')?.getBoundingClientRect();
  if (!rect?.width || !rect.height) return () => {};
  const age = Math.max(0, event.ageMs || 0);
  if (age >= 2100) return () => {};
  const dx = ((event.toX - event.fromX) * rect.width) / 100;
  const dy = ((event.toY - event.fromY) * rect.height) / 100;
  const fromY = (event.fromY * rect.height) / 100 - 42;
  const arc = heroFlightLift(rect.height, fromY, fromY + dy);
  const path = [0, 0.12, 0.25, 0.43, 0.58, 0.74, 0.88, 1].map((p) => ({
    translate: `${dx * p}px ${dy * p - heroFlightArc(p) * arc}px`,
    offset: (600 + p * 1500) / 2100,
  }));
  const animation = node.animate([{ translate: '0px 0px', offset: 0 }, ...path], {
    duration: 2100,
    easing: 'linear',
  });
  animation.currentTime = age;
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
