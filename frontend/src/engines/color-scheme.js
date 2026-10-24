let ColorScheme;
/* Load in <head> so a saved appearance is applied before the first paint. */
/* Also the earliest script on every page: a reload anywhere asks for room video consent again
   (see frontend/src/services/media-consent.ts and shared/table-media.js). */
(() => {
  try {
    const navigation = performance.getEntriesByType?.('navigation')[0];
    const reload = navigation ? navigation.type === 'reload' : performance.navigation?.type === 1;
    if (reload) sessionStorage.removeItem('bga.media.consent.v2');
  } catch {}
})();
(() => {
  const storageKey = 'ah-color-scheme',
    listeners = new Set();
  const media =
    typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-color-scheme: dark)')
      : null;
  const valid = (value) => ['auto', 'light', 'dark'].includes(value);
  function read() {
    try {
      const value = localStorage.getItem(storageKey);
      return valid(value) ? value : 'auto';
    } catch {
      return 'auto';
    }
  }
  let preference = read();
  const get = () => ({
    preference,
    scheme: preference === 'auto' ? (media?.matches ? 'dark' : 'light') : preference,
  });
  function notify() {
    const state = get();
    document.documentElement.dataset.colorScheme = state.scheme;
    for (const listener of listeners) listener({ ...state });
  }
  function set(value) {
    if (!valid(value)) return get();
    preference = value;
    try {
      localStorage.setItem(storageKey, value);
    } catch {}
    notify();
    return get();
  }
  function subscribe(listener) {
    listeners.add(listener);
    listener(get());
    return () => listeners.delete(listener);
  }
  media?.addEventListener?.('change', notify);
  window.addEventListener('storage', (event) => {
    if (event.key === storageKey || event.key === null) {
      preference = read();
      notify();
    }
  });
  ColorScheme = {
    get,
    set,
    subscribe,
    toggle: () => set(get().scheme === 'dark' ? 'light' : 'dark'),
  };
  notify();
})();

export default ColorScheme;
