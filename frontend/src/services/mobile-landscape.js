// Browser rotation requires user activation. Keep one owner per page, with a
// manual retry when a browser declines fullscreen or orientation locking.
export function installMobileLandscape(win, doc, changed) {
  const coarse = win.matchMedia('(any-pointer: coarse)');
  const portrait = win.matchMedia('(orientation: portrait)');
  const orientation = win.screen.orientation;
  let stopped = false,
    attempted = false,
    pending = false;
  let ownFullscreen = false,
    ownLock = false;
  function update() {
    if (!stopped) changed(coarse.matches && portrait.matches && !doc.hidden);
  }
  async function request() {
    if (stopped || pending || !coarse.matches || doc.hidden) return;
    attempted = true;
    pending = true;
    try {
      try {
        if (!doc.fullscreenElement && doc.documentElement.requestFullscreen) {
          await doc.documentElement.requestFullscreen();
          ownFullscreen = true;
        }
      } catch {
        /* Orientation may still be available without fullscreen. */
      }
      if (!stopped && orientation?.lock) {
        try {
          await orientation.lock('landscape');
          ownLock = true;
        } catch {
          /* Leave the rotate hint visible on unsupported browsers. */
        }
      }
    } finally {
      pending = false;
      if (stopped) release();
      else update();
    }
  }
  function release() {
    if (ownLock) orientation?.unlock?.();
    ownLock = false;
    if (ownFullscreen && doc.fullscreenElement === doc.documentElement)
      void doc.exitFullscreen?.().catch(() => {});
    ownFullscreen = false;
  }
  function gesture(event) {
    if (attempted || !event.isTrusted || doc.hidden) return;
    if (event.target?.closest?.('input,textarea,select,[contenteditable],dialog,[inert]')) return;
    void request();
  }
  coarse.addEventListener('change', update);
  portrait.addEventListener('change', update);
  doc.addEventListener('visibilitychange', update);
  doc.addEventListener('pointerup', gesture, true);
  doc.addEventListener('click', gesture, true);
  update();
  return {
    request,
    stop() {
      stopped = true;
      coarse.removeEventListener('change', update);
      portrait.removeEventListener('change', update);
      doc.removeEventListener('visibilitychange', update);
      doc.removeEventListener('pointerup', gesture, true);
      doc.removeEventListener('click', gesture, true);
      release();
    },
  };
}
