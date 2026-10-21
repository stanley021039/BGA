'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  vm = require('node:vm'),
  { randomUUID } = require('node:crypto');
const { MusicQuizRoom } = require('../src/games/musicquiz');
const flush = async () => {
  for (let i = 0; i < 30; i++) await Promise.resolve();
};
function fixture(withAudio = false) {
  const room = new MusicQuizRoom('ABCDEF', 'playback', () => 0),
    seat = room.add('player');
  room.start();
  room.act(seat.id, 'listen', { roundId: room.roundId, requestId: randomUUID() });
  const ids = new Map(),
    events = {},
    intervals = new Set(),
    instances = [];
  let deferred = false;
  class E {
    constructor(tag = 'div') {
      this.tag = tag;
      this.children = [];
      this.dataset = {};
      this.style = {};
      this.classList = { add() {} };
      this.textContent = '';
      this.disabled = false;
      this.parent = null;
    }
    set id(v) {
      this._id = v;
      ids.set('#' + v, this);
    }
    get id() {
      return this._id;
    }
    append(...items) {
      for (const n of items) {
        n.parent = this;
        this.children.push(n);
      }
    }
    replaceChildren(...items) {
      this.children = [];
      this.append(...items);
    }
    setAttribute(k, v) {
      this[k] = v;
    }
    removeAttribute(k) {
      delete this[k];
    }
    pause() {
      this.paused = true;
    }
    load() {}
    async play() {
      this.started = true;
      this.onplaying?.();
    }
    closest() {
      return this;
    }
    focus() {}
    click() {
      if (!this.disabled) return this.onclick?.();
    }
    remove() {
      if (this.parent) this.parent.children = this.parent.children.filter((n) => n !== this);
    }
    querySelectorAll(selector) {
      return this.children.flatMap((n) => [
        ...(selector.includes(n.tag) ||
        (selector.includes('[data-mq-mount]') && n.dataset.mqMount !== undefined)
          ? [n]
          : []),
        ...n.querySelectorAll(selector),
      ]);
    }
  }
  for (const id of [
    'mqInvite',
    'mqCopyRoom',
    'mqRoomActions',
    'mqRoomHint',
    'mqSessionActions',
    'mqChat',
    'roomTag',
    'feedback',
    'controls',
    'leave',
    'retry',
    'mqPlayback',
    'game',
    'players',
    'phase',
    'connection',
    'mqCover',
    'results',
    'deadline',
    'guide',
  ]) {
    const n = new E();
    n.id = id;
  }
  const head = new E('head');
  const c = {
    console,
    URL,
    crypto: { randomUUID },
    AbortController,
    location: { pathname: '/musicquiz/ABCDEF', origin: 'https://game.example', replace() {} },
    sessionStorage: {
      getItem() {
        return null;
      },
      setItem() {},
    },
    confirm: () => false,
    setTimeout() {},
    setInterval(fn) {
      intervals.add(fn);
      return fn;
    },
    clearInterval(fn) {
      intervals.delete(fn);
    },
    addEventListener: (k, fn) => (events[k] = fn),
    document: {
      hidden: false,
      activeElement: null,
      head,
      querySelector: (s) => ids.get(s) || null,
      querySelectorAll: () => [],
      createElement: (tag) => new E(tag),
      createTextNode: (text) => {
        const n = new E();
        n.textContent = text;
        return n;
      },
      getElementById: (id) => ids.get('#' + id),
      addEventListener: (k, fn) => (events[k] = fn),
    },
    AudioSettings: {
      get: () => ({ music: { volume: 0.5 } }),
      set() {},
      subscribe() {},
      bindPreview(a) {
        a.bound = true;
        return () => {
          a.unbound = true;
        };
      },
    },
    GameUI: { decorateButton() {} },
    GameShell: { playerRow: () => '' },
    RoomControls: { bindActions: () => ({ refresh() {} }) },
    RoomHost: { update() {} },
    RoomReconnect: { restore: async () => ({}) },
    RoomApi: {
      request: async () => {
        const v = room.view(seat.id);
        if (withAudio && v.playback)
          v.playback = {
            ...v.playback,
            provider: 'audio',
            url:
              '/api/game-song-audio?code=ABCDEF&roundId=' +
              v.roundId +
              '&stage=' +
              v.playback.stage,
            start: 0,
          };
        return v;
      },
    },
    YT: {
      Player: function (frame, options) {
        const p = {
          frame,
          options,
          destroyed: false,
          destroy() {
            this.destroyed = true;
            frame.remove();
          },
          setVolume() {},
          playVideo() {},
          pauseVideo() {},
        };
        instances.push(p);
        if (!deferred) queueMicrotask(() => options.events.onReady({ target: p }));
        return p;
      },
    },
  };
  c.window = c;
  vm.runInNewContext(fs.readFileSync(require.resolve('../public/musicquiz.js'), 'utf8'), c);
  return {
    room,
    seat,
    ids,
    events,
    instances,
    intervals,
    setDeferred() {
      deferred = true;
    },
    async poll() {
      for (const fn of [...intervals]) await fn();
      await flush();
    },
  };
}
test('YouTube frame identifies its real origin and overrides same-origin referrer policy locally', async () => {
  const f = fixture();
  await flush();
  const box = f.ids.get('#mqPlayback');
  await box.children[0].click();
  await flush();
  const frame = box.children.find((n) => n.tag === 'iframe'),
    url = new URL(frame.src);
  assert.equal(frame.referrerPolicy, 'strict-origin-when-cross-origin');
  assert.equal(url.origin, 'https://www.youtube-nocookie.com');
  assert.equal(url.searchParams.get('origin'), 'https://game.example');
  assert.equal(url.searchParams.get('enablejsapi'), '1');
  assert.ok(
    Math.abs(Number(url.searchParams.get('end')) - Number(url.searchParams.get('start')) - 8) <
      1e-6,
  );
  assert.equal(box.querySelectorAll('iframe').length, 1);
});
test('API failures remove the failed frame; repeated retries never stack players and stale errors are ignored', async () => {
  const f = fixture();
  await flush();
  const box = f.ids.get('#mqPlayback'),
    play = box.children[0];
  await play.click();
  await flush();
  const first = f.instances[0];
  first.options.events.onError({ data: 153 });
  assert.match(box.children[1].textContent, /來源識別/);
  assert.equal(first.destroyed, true);
  assert.equal(box.querySelectorAll('iframe').length, 0);
  await play.click();
  await flush();
  assert.equal(box.querySelectorAll('iframe').length, 1);
  first.options.events.onError({ data: 100 });
  assert.equal(box.querySelectorAll('iframe').length, 1);
  f.instances.at(-1).options.events.onError({ data: 150 });
  assert.match(box.children[1].textContent, /不允許/);
  assert.equal(box.querySelectorAll('iframe').length, 0);
  await play.click();
  await flush();
  assert.equal(box.querySelectorAll('iframe').length, 1);
  f.events.pagehide();
  assert.equal(box.querySelectorAll('iframe').length, 0);
});
test('switching from intro to highlight discards stale readiness and keeps one correctly timed frame', async () => {
  const f = fixture();
  await flush();
  f.setDeferred();
  const box = f.ids.get('#mqPlayback');
  await box.children[0].click();
  const old = f.instances[0];
  f.room.act(f.seat.id, 'guess', { roundId: f.room.roundId, requestId: randomUUID(), pass: true });
  await f.poll();
  const next = f.instances.at(-1);
  old.options.events.onReady({ target: old });
  assert.equal(old.destroyed, true);
  assert.equal(box.querySelectorAll('iframe').length, 1);
  assert.notEqual(next, old);
  const url = new URL(next.frame.src);
  assert.equal(Number(url.searchParams.get('end')) - Number(url.searchParams.get('start')), 30);
});

test('MP3 playback creates no YouTube frame, retries one audio, ignores stale failures and stops on phase change or page exit', async () => {
  const f = fixture(true);
  await flush();
  const box = f.ids.get('#mqPlayback');
  await box.children[0].click();
  await flush();
  let clips = box.children.filter((n) => n.tag === 'audio');
  assert.equal(clips.length, 1);
  const first = clips[0];
  assert.ok(first.started);
  assert.ok(first.bound);
  assert.equal(box.querySelectorAll('iframe').length, 0);
  assert.equal(f.instances.length, 0);
  first.onerror();
  assert.match(box.children[1].textContent, /音檔讀取失敗/);
  assert.ok(first.paused);
  assert.ok(first.unbound);
  assert.equal(box.children.filter((n) => n.tag === 'audio').length, 0);
  await box.children[0].click();
  await flush();
  const next = box.children.find((n) => n.tag === 'audio');
  first.onerror();
  assert.equal(
    box.children.find((n) => n.tag === 'audio'),
    next,
  );
  f.room.act(f.seat.id, 'guess', { roundId: f.room.roundId, requestId: randomUUID(), pass: true });
  await f.poll();
  assert.ok(next.paused);
  assert.ok(next.unbound);
  const highlight = box.children.find((n) => n.tag === 'audio');
  assert.notEqual(highlight, next);
  assert.match(highlight.src, /stage=highlight/);
  f.events.pagehide();
  assert.ok(highlight.paused);
  assert.ok(highlight.unbound);
  assert.equal(box.children.filter((n) => n.tag === 'audio').length, 0);
});
