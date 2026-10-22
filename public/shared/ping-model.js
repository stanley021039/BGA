(function (root) {
  'use strict';
  const types = {
    ping: { label: '這裡', icon: 'ping' },
    attention: { label: '注意', icon: 'ping-attention' },
    question: { label: '疑問', icon: 'ping-question' },
    help: { label: '幫忙', icon: 'ping-help' },
    look: { label: '看這裡', icon: 'ping-look' },
  };
  const voiceCues = [
    'amazing',
    'bad',
    'card-check',
    'sleep',
    'look',
    'legacy',
    'no-bluff',
    'cry',
    'coward',
    'goodnight',
    'senior',
    'practice',
    'huh',
    'what',
  ].map((name) => 'ping-voice-' + name);
  function pick(dx, dy, threshold = 24) {
    if (Math.hypot(dx, dy) < threshold) return 'ping';
    return Math.abs(dx) > Math.abs(dy)
      ? dx > 0
        ? 'look'
        : 'question'
      : dy > 0
        ? 'help'
        : 'attention';
  }
  function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
  }
  function point(rect, x, y) {
    return {
      x: clamp((x - rect.left) / rect.width, 0, 1),
      y: clamp((y - rect.top) / rect.height, 0, 1),
    };
  }
  function place(rect, target, width, height) {
    const x = rect.left + rect.width * target.x,
      y = rect.top + rect.height * target.y;
    return {
      x: clamp(x, 32, width - 32),
      y: clamp(y, 48, height - 48),
      edge: x < 16 || x > width - 16 || y < 16 || y > height - 16,
      dx: x - width / 2,
      dy: y - height / 2,
    };
  }
  // Account settings will provide server-authorized references; no arbitrary remote URLs.
  function preferences(input) {
    const result = {},
      uuid = '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}';
    for (const type of Object.keys(types)) {
      const value = input?.[type],
        item = {};
      if (
        typeof value?.imageUrl === 'string' &&
        new RegExp('^/assets/artworks/' + uuid + '$', 'i').test(value.imageUrl)
      )
        item.imageUrl = value.imageUrl;
      if (
        typeof value?.sound?.effect === 'string' &&
        (Object.keys(types).some((t) => value.sound.effect === 'ping-' + t) ||
          voiceCues.includes(value.sound.effect))
      )
        item.sound = { effect: value.sound.effect };
      else if (
        typeof value?.sound?.url === 'string' &&
        new RegExp(
          '^/assets/characters/sounds/' +
            uuid +
            '/(?:happy|sad|surprised|thinking|angry|emote-' +
            uuid +
            ')(?:\\?v=[a-f0-9]{64})?$',
          'i',
        ).test(value.sound.url) &&
        Number.isInteger(value.sound.durationMs) &&
        value.sound.durationMs > 0 &&
        value.sound.durationMs <= 10000
      )
        item.sound = { url: value.sound.url, durationMs: value.sound.durationMs };
      if (!Object.hasOwn(value || {}, 'sound')) item.sound = { effect: 'ping-' + type };
      result[type] = item;
    }
    return result;
  }
  const api = { types, pick, point, place, preferences };
  if (typeof module === 'object' && module.exports) module.exports = api;
  // Also expose the browser leaf when a bundler wraps this UMD module as CommonJS.
  if (typeof window === 'object') window.PingModel = api;
  else if (typeof module !== 'object' || !module.exports) root.PingModel = api;
})(typeof window === 'object' ? window : globalThis);
