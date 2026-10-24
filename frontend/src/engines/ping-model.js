let PingModel;
(function (root) {
  'use strict';
  const types = {
    ping: { label: '這裡', icon: 'ping' },
    attention: { label: '注意', icon: 'ping-attention' },
    question: { label: '疑問', icon: 'ping-question' },
    help: { label: '幫忙', icon: 'ping-help' },
    look: { label: '看這裡', icon: 'ping-look' },
    angry: { label: '生氣', icon: 'ping-angry' },
    sleep: { label: '睡覺', icon: 'ping-sleep' },
    speechless: { label: '無言', icon: 'ping-speechless' },
    surprised: { label: '驚訝', icon: 'ping-surprised' },
    admire: { label: '崇拜', icon: 'ping-admire' },
  };
  const colors = Object.freeze({
    ping: '#86ddff',
    attention: '#ff8068',
    question: '#f5ce64',
    help: '#6dd8ef',
    look: '#9ed6ff',
    angry: '#ff526e',
    sleep: '#ba91ff',
    speechless: '#c0c9d6',
    surprised: '#ffae4b',
    admire: '#ff8cda',
  });
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
  const defaults = ['ping', 'attention', 'question', 'help', 'look'];
  function wheel(input) {
    const items = Object.keys(types).filter(
      (type) =>
        Number.isInteger(input?.[type]?.wheelSlot) &&
        input[type].wheelSlot >= 0 &&
        input[type].wheelSlot < 5,
    );
    return items.length === 5 && new Set(items.map((type) => input[type].wheelSlot)).size === 5
      ? items.sort((a, b) => input[a].wheelSlot - input[b].wheelSlot)
      : defaults.slice();
  }
  function pick(dx, dy, threshold = 24, input) {
    const selected = wheel(input);
    if (Math.hypot(dx, dy) < threshold) return selected[0];
    const direction =
      Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'look' : 'question') : dy > 0 ? 'help' : 'attention';
    return selected[defaults.indexOf(direction)];
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
      if (Object.hasOwn(types, value?.iconType)) item.iconType = value.iconType;
      if (Number.isInteger(value?.wheelSlot) && value.wheelSlot >= 0 && value.wheelSlot < 5)
        item.wheelSlot = value.wheelSlot;
      if (
        typeof value?.imageUrl === 'string' &&
        new RegExp('^/assets/artworks/' + uuid + '$', 'i').test(value.imageUrl)
      )
        item.imageUrl = value.imageUrl;
      if (
        typeof value?.sound?.effect === 'string' &&
        (defaults.some((t) => value.sound.effect === 'ping-' + t) ||
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
      if (!Object.hasOwn(value || {}, 'sound'))
        item.sound = { effect: 'ping-' + (defaults.includes(type) ? type : 'ping') };
      result[type] = item;
    }
    return result;
  }
  const api = { types, colors, pick, wheel, point, place, preferences };

  // Also expose the browser leaf when a bundler wraps this UMD module as CommonJS.
  PingModel = api;
})(typeof window === 'object' ? window : globalThis);

export default PingModel;
