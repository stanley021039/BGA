'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const vue = require('vue');
const ts = require('typescript');
const { parse, compileScript } = require('@vue/compiler-sfc');
function loadService(name) {
  const loaded = { exports: {} };
  vm.runInNewContext(
    ts.transpileModule(
      fs.readFileSync(path.resolve(__dirname, `../src/services/${name}.ts`), 'utf8'),
      {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
      },
    ).outputText,
    { module: loaded, exports: loaded.exports },
  );
  return loaded;
}
const historyModule = loadService('media-history'),
  consentModule = loadService('media-consent');

function harness() {
  const calls = [],
    lifecycle = {};
  const provider = Object.fromEntries(
    ['setWindow', 'setMarker', 'update', 'disconnect', 'dispose', 'joinVideo', 'exitVideo'].map(
      (key) => [key, (...args) => calls.push([key, ...args])],
    ),
  );
  const session = vue.reactive({ user: { id: 'account-a' } }),
    consent = consentModule.exports.createMediaConsent(null, null);
  const media = vue.reactive({
    context: 1,
    enabled: true,
    connected: true,
    receipt: 0,
    marker: {},
    snapshot: { roomInstanceId: 'room-a', myPlayerId: 'host', current: null },
    position: () => 0,
    serverNow: () => 1000,
    library() {},
    async load() {},
    cancelSnapshot: () => calls.push(['cancelSnapshot']),
    report() {},
  });
  const geometry = {
    style: vue.ref({}),
    box: vue.ref({ width: 430, height: 720 }),
    layout() {},
    cancel() {},
    edges: [],
  };
  const source = compileScript(
    parse(fs.readFileSync(path.resolve(__dirname, '../src/components/RoomMedia.vue'), 'utf8'))
      .descriptor,
    { id: 'media-lifecycle' },
  ).content;
  const module = { exports: {} };
  vm.runInNewContext(
    ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    {
      module,
      exports: module.exports,
      require: (id) =>
        id === 'vue'
          ? {
              ...vue,
              useId: () => 'media-test',
              onMounted: (fn) => (lifecycle.mount = fn),
              onBeforeUnmount: (fn) => (lifecycle.unmount = fn),
            }
          : id.includes('stores/media')
            ? { useMediaStore: () => media }
            : id.includes('stores/session')
              ? { useSessionStore: () => session }
              : id.includes('services/media-history')
                ? historyModule.exports
                : id.includes('services/media-consent')
                  ? { mediaConsent: () => consent }
                  : id.includes('stores/preferences')
                    ? {
                        usePreferencesStore: () => ({
                          media: 'default',
                          audio: { music: { enabled: true, volume: 0.3 } },
                        }),
                      }
                    : id.includes('composables/media-window')
                      ? { useMediaWindow: () => geometry }
                      : id.includes('contracts/media')
                        ? { mediaCurrentKey: () => '', mediaPlaybackKey: () => '' }
                        : {},
      localStorage: { getItem: () => null },
      window: {
        RoomMediaPlayer: {
          create: () => {
            calls.push(['create']);
            return provider;
          },
        },
      },
      document: {
        hidden: false,
        querySelector: () => null,
        addEventListener() {},
        removeEventListener() {},
      },
      MutationObserver: class {
        observe() {}
        disconnect() {}
      },
      setInterval: () => 1,
      clearInterval() {},
      URLSearchParams,
    },
  );
  const scope = vue.effectScope();
  let component;
  scope.run(() => (component = module.exports.default.setup({ connected: true }, { expose() {} })));
  component.audioHost.value = {};
  component.videoHost.value = {};
  component.frameArt.value = { replaceChildren() {} };
  component.dialog.value = {
    open: false,
    show() {
      this.open = true;
    },
    close() {
      this.open = false;
    },
    focus() {},
  };
  lifecycle.mount();
  return {
    component,
    calls,
    media,
    session,
    consent,
    dispose() {
      lifecycle.unmount();
      scope.stop();
    },
  };
}

test('actual Vue window opts into hidden video playback across request, close, Escape and reopen', async () => {
  const h = harness();
  try {
    await h.component.show();
    h.component.setTab('request');
    assert.deepEqual(h.calls.filter((c) => c[0] === 'setWindow').at(-1), [
      'setWindow',
      true,
      true,
      true,
    ]);
    h.component.close();
    assert.equal(h.component.opened.value, false);
    assert.deepEqual(h.calls.filter((c) => c[0] === 'setWindow').at(-1), [
      'setWindow',
      false,
      true,
      true,
    ]);
    await h.component.open();
    h.component.setTab('player');
    assert.deepEqual(h.calls.filter((c) => c[0] === 'setWindow').at(-1), [
      'setWindow',
      true,
      false,
      true,
    ]);
    h.component.escape({ key: 'Escape', preventDefault() {} });
    assert.equal(h.component.opened.value, false);
    assert.equal(h.calls.filter((c) => c[0] === 'create').length, 1);
    assert.equal(h.calls.filter((c) => ['disconnect', 'dispose'].includes(c[0])).length, 0);
    h.media.context++;
    await vue.nextTick();
    assert.equal(
      h.calls.filter((c) => c[0] === 'disconnect').length,
      1,
      'leaving the room still clears playback',
    );
  } finally {
    h.dispose();
  }
  assert.equal(h.calls.filter((c) => c[0] === 'dispose').length, 1);
});

test('recent videos are bounded, deduplicated, account isolated and survive a new room instance', () => {
  const saved = new Map();
  const storage = {
    getItem: (key) => saved.get(key) || null,
    setItem: (key, value) => saved.set(key, value),
  };
  const history = historyModule.exports.createMediaHistory(storage);
  history.selectAccount('a');
  let rows;
  for (let i = 0; i < 12; i++)
    rows = history.record('play-' + i, { videoId: String(i).padStart(11, '0'), title: '片名' + i });
  assert.equal(rows.length, 10);
  assert.equal(rows[0].title, '片名11');
  rows = history.record('replay', { videoId: '00000000004', title: '重播名稱' });
  assert.equal(rows[0].title, '重播名稱');
  assert.equal(rows.filter((row) => row.videoId === '00000000004').length, 1);
  assert.equal(history.selectAccount('b').length, 0);
  assert.equal(history.selectAccount('a')[0].title, '重播名稱');
  const reloaded = historyModule.exports.createMediaHistory(storage);
  assert.equal(reloaded.selectAccount('a')[0].title, '重播名稱');
  assert.equal(reloaded.selectAccount('').length, 0);
});

test('corrupt storage and blocked persistence never break playback or allow unsafe URLs', () => {
  const history = historyModule.exports.createMediaHistory({
    getItem: () => '{',
    setItem: () => {
      throw Error('blocked');
    },
  });
  assert.equal(history.selectAccount('a').length, 0);
  assert.equal(
    history.record('one', { videoId: 'M7lc1UVf-VE', title: '真實片名' })[0].title,
    '真實片名',
  );
  assert.equal(history.record('bad', { videoId: 'javascript:alert(1)', title: 'bad' }).length, 1);
  assert.equal(historyModule.exports.recentVideoUrl('javascript:alert(1)'), '');
  assert.equal(
    historyModule.exports.recentVideoUrl('M7lc1UVf-VE'),
    'https://www.youtube.com/watch?v=M7lc1UVf-VE',
  );
});

test('actual Vue records playing current videos only, fills a title selection without enqueue and closes on Escape', async () => {
  const h = harness();
  try {
    const video = { id: 'item-a', type: 'video', videoId: 'M7lc1UVf-VE', title: '影片名稱' };
    h.media.snapshot = {
      roomInstanceId: 'room-a',
      playbackSessionId: 'play-a',
      current: null,
      queue: [video],
      playback: { state: 'playing' },
    };
    await vue.nextTick();
    assert.equal(h.component.recentVideos.value.length, 0);
    h.media.snapshot.current = video;
    h.media.snapshot.playback.state = 'paused';
    await vue.nextTick();
    assert.equal(h.component.recentVideos.value.length, 0);
    h.media.snapshot.playback.state = 'playing';
    await vue.nextTick();
    assert.equal(h.component.recentVideos.value[0].title, '影片名稱');
    h.component.chooseRecent(h.component.recentVideos.value[0]);
    assert.equal(h.component.url.value, 'https://www.youtube.com/watch?v=M7lc1UVf-VE');
    assert.equal(h.component.recentOpen.value, false);
    h.component.recentOpen.value = true;
    let stopped = false;
    h.component.recentKey({
      key: 'Escape',
      preventDefault() {},
      stopPropagation() {
        stopped = true;
      },
    });
    assert.equal(stopped, true);
    assert.equal(h.component.recentOpen.value, false);
    h.session.user = { id: 'account-b' };
    await vue.nextTick();
    assert.equal(
      h.component.recentVideos.value.length,
      0,
      'account change must not record the previous snapshot',
    );
  } finally {
    h.dispose();
  }
});

function memoryStorage(entries = []) {
  const saved = new Map(entries);
  return {
    saved,
    getItem: (key) => saved.get(key) ?? null,
    setItem: (key, value) => saved.set(key, value),
    removeItem: (key) => saved.delete(key),
  };
}

test('one video decision covers other rooms in the tab and a reload of any page asks again', () => {
  const { createMediaConsent, clearMediaConsentOnReload, MEDIA_CONSENT_KEY } =
    consentModule.exports;
  for (const accepted of [false, true]) {
    const session = memoryStorage(),
      local = memoryStorage([['bga.media.consents.v1', '[["room-a:host",true]]']]);
    const first = createMediaConsent(session, local);
    assert.equal(first.get(), undefined, 'the old per-room record never answers');
    assert.equal(local.saved.has('bga.media.consents.v1'), false);
    first.set(accepted);
    for (const type of ['navigate', 'back_forward', 'prerender']) {
      clearMediaConsentOnReload(session, type);
      assert.equal(createMediaConsent(session, local).get(), accepted, type);
    }
    // e.g. the lobby reloads: its page boot clears the choice before the next room reads it.
    clearMediaConsentOnReload(session, 'reload');
    assert.equal(session.saved.has(MEDIA_CONSENT_KEY), false);
    assert.equal(createMediaConsent(session, local).get(), undefined);
  }
});

test('every Vue page boot clears the consent on reload before mounting', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/runtime/mount-page.ts'), 'utf8');
  const body = source.slice(source.indexOf('export function mountPage('));
  assert.ok(body.indexOf('resetMediaConsentOnReload()') > 0);
  assert.ok(body.indexOf('resetMediaConsentOnReload()') < body.indexOf('function start()'));
  const pages = path.resolve(__dirname, '../src/pages');
  for (const page of fs.readdirSync(pages)) {
    const entry = path.join(pages, page, 'main.ts');
    if (fs.existsSync(entry))
      assert.match(
        fs.readFileSync(entry, 'utf8'),
        /mountPage\(/,
        page + ' boots through mountPage',
      );
  }
});

test('unavailable or malformed consent storage keeps asking without inferring acceptance', () => {
  const { createMediaConsent, MEDIA_CONSENT_KEY } = consentModule.exports;
  const blocked = {
    getItem() {
      throw Error('blocked');
    },
    setItem() {
      throw Error('blocked');
    },
    removeItem() {
      throw Error('blocked');
    },
  };
  const page = createMediaConsent(blocked, blocked);
  assert.equal(page.get(), undefined);
  page.set(true);
  assert.equal(page.get(), true, 'the choice still holds for this page');
  assert.equal(
    createMediaConsent(memoryStorage([[MEDIA_CONSENT_KEY, 'yes']]), null).get(),
    undefined,
  );
});

test('actual Vue window asks once and reuses the tab decision for a new room', async () => {
  const h = harness();
  try {
    assert.equal(h.component.videoConsent.value, undefined);
    await h.component.chooseVideo(false);
    assert.equal(h.component.videoConsent.value, false);
    assert.equal(h.consent.get(), false, 'the choice is stored for the whole tab');
    h.media.snapshot = { ...h.media.snapshot, roomInstanceId: 'room-b' };
    await vue.nextTick();
    assert.equal(h.component.videoConsent.value, false, 'a new room keeps the tab decision');
  } finally {
    h.dispose();
  }
});
