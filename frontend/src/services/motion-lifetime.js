// One cancellation contract for procedural and imported cosmetic effects.
// HTTP caching does not bound animation work: every owner must release its job.
export function motionAllowed() {
  const root = typeof window === 'undefined' ? globalThis : window;
  return (
    !root.document?.hidden &&
    !root.matchMedia?.('(prefers-reduced-motion: reduce)').matches &&
    root.MotionPolicy?.allowsMotion?.() !== false
  );
}

export function watchMotionCancellation(cancel) {
  const root = typeof window === 'undefined' ? globalThis : window;
  const doc = root.document;
  const media = root.matchMedia?.('(prefers-reduced-motion: reduce)');
  let live = true,
    unsubscribe = () => {};
  function release() {
    if (!live) return;
    live = false;
    doc?.removeEventListener?.('visibilitychange', check);
    root.removeEventListener?.('pagehide', blocked);
    media?.removeEventListener?.('change', check);
    unsubscribe();
  }
  function blocked() {
    if (!live) return;
    release();
    cancel();
  }
  function check() {
    if (!motionAllowed()) blocked();
  }
  doc?.addEventListener?.('visibilitychange', check);
  root.addEventListener?.('pagehide', blocked);
  media?.addEventListener?.('change', check);
  unsubscribe = root.MotionPolicy?.subscribe?.(check) || (() => {});
  // subscribe calls back synchronously, including an already blocked policy.
  if (!live) unsubscribe();
  check();
  return release;
}

const contexts = new Set();
export function acquireEffectContext(canvas) {
  if (contexts.size >= 2) return null;
  const root = typeof window === 'undefined' ? globalThis : window;
  const shared = root.GameFxLayer;
  if (shared && !shared.acquireContext(canvas)) return null;
  contexts.add(canvas);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    contexts.delete(canvas);
    shared?.releaseContext(canvas);
  };
}
