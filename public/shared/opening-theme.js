/* Website opening themes are distinct from character entrance effects. */
(() => {
  'use strict';
  const key = 'bga-website-opening';
  const themes = {
    default: {
      id: 'default',
      image: '/assets/auth/login-864.webp',
      sound: 'entry-intro',
      duration: 3000,
      label: '歡迎來到 Ave Mujica 的世界',
    },
    'home-family': {
      id: 'home-family',
      image: '/assets/auth/home-family.jpg',
      sound: 'entry-home-family',
      duration: 8500,
      label: '我們這一家',
    },
    'soul-world': {
      id: 'soul-world',
      image: '/assets/auth/soul-world.webp',
      sound: 'entrance-soul-world',
      duration: 3800,
      label: '歡迎來到我的屍魂界',
    },
  };
  function get() {
    try {
      const id = localStorage.getItem(key);
      return Object.hasOwn(themes, id) ? id : 'default';
    } catch {
      return 'default';
    }
  }
  function remember(id) {
    if (!Object.hasOwn(themes, id)) return;
    try {
      localStorage.setItem(key, id);
    } catch {
      /* Storage is optional. */
    }
    document.documentElement.dataset.entryOpening = id;
  }
  async function resolve() {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    try {
      const response = await fetch('/api/profile/opening', {
        signal: controller.signal,
        credentials: 'same-origin',
        cache: 'no-store',
      });
      if (!response.ok) {
        remember('default');
        return themes.default;
      }
      const data = await response.json(),
        id = Object.hasOwn(themes, data.theme) ? data.theme : 'default';
      remember(id);
      return themes[id];
    } catch {
      remember('default');
      return themes.default;
    } finally {
      clearTimeout(timer);
    }
  }
  window.EntryOpening = { get, remember, resolve };
  document.documentElement.dataset.entryOpening = get();
})();
