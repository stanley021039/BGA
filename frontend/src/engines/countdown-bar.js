let CountdownBar;
(function () {
  'use strict';
  // Prefer the compositor; older browsers retain a frame-based fallback. Both move
  // in STEP_MS steps: a smooth bar redraws the page at the display rate (144/s)
  // for the whole countdown, while four steps a second look the same.
  const STEP_MS = 250;
  function create(node, { now = () => Date.now(), reducedMotion = () => false } = {}) {
    let animation = null,
      current = null,
      frame = null;
    function reset() {
      animation?.cancel();
      animation = null;
      if (frame !== null) clearTimeout(frame);
      frame = null;
      current = null;
    }
    function paintFallback() {
      frame = null;
      if (!current) return;
      const remaining = Math.max(0, current.end - now()),
        fraction = Math.max(0, Math.min(1, remaining / current.duration));
      node.style.transform = 'scaleX(' + fraction + ')';
      if (remaining) frame = setTimeout(paintFallback, Math.min(STEP_MS, remaining));
    }
    function sync({ key, deadline, duration, offset = 0, visible = true }) {
      const end = deadline + offset,
        remaining = Math.max(0, end - now()),
        fraction = Math.max(0, Math.min(1, remaining / duration)),
        reduce = reducedMotion();
      if (!visible || !Number.isFinite(end) || !Number.isFinite(duration) || duration <= 0) {
        reset();
        node.style.transform = 'scaleX(0)';
        return;
      }
      const clockDrift =
        animation && typeof animation.currentTime === 'number'
          ? Math.abs(now() - current.started - animation.currentTime)
          : 0;
      const running =
        (animation && animation.playState !== 'idle' && animation.playState !== 'paused') ||
        frame !== null;
      if (
        running &&
        current?.key === key &&
        current.duration === duration &&
        current.reduce === reduce &&
        Math.abs(current.end - end) < 40 &&
        clockDrift < 100
      )
        return;
      reset();
      node.style.transform = 'scaleX(' + fraction + ')';
      current = { key, end, duration, reduce, started: now() };
      if (remaining && !reduce) {
        if (typeof node.animate === 'function')
          animation = node.animate(
            [{ transform: 'scaleX(' + fraction + ')' }, { transform: 'scaleX(0)' }],
            {
              duration: remaining,
              easing: 'steps(' + Math.max(1, Math.ceil(remaining / STEP_MS)) + ',end)',
              fill: 'forwards',
            },
          );
        else frame = setTimeout(paintFallback, Math.min(STEP_MS, remaining));
      }
    }
    return { sync, reset };
  }
  CountdownBar = { create };
})();

export default CountdownBar;
