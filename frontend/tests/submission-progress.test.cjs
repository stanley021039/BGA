'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'),
  path = require('node:path'),
  vm = require('node:vm');
const { parseHTML } = require('linkedom');
const { window } = parseHTML('<html><body></body></html>');
for (const key of ['window', 'document', 'Element', 'HTMLElement', 'SVGElement', 'Event'])
  global[key] = key === 'window' ? window : window[key];
const vue = require('vue'),
  ts = require('typescript');
const { parse, compileScript } = require('vue/compiler-sfc');
const { MajorityRoom } = require('../../src/games/majority');
function loader() {
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file);
    let source = fs.readFileSync(file, 'utf8');
    if (file.endsWith('.vue'))
      source = compileScript(parse(source, { filename: file }).descriptor, {
        id: path.basename(file),
        inlineTemplate: true,
      }).content;
    const mod = { exports: {} };
    vm.runInNewContext(
      ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
      }).outputText,
      {
        module: mod,
        exports: mod.exports,
        document,
        window,
        require(id) {
          if (id === 'vue') return vue;
          if (/\.(scss|css)$/.test(id)) return {};
          if (/PlayerAvatar.vue|UiIcon.vue/.test(id)) return { default: { render: () => null } };
          if (id.endsWith('PlayerName.vue'))
            return {
              default: {
                props: ['name'],
                render() {
                  return vue.h('span', this.name);
                },
              },
            };
          if (id.startsWith('.'))
            return load(path.resolve(path.dirname(file), id + (path.extname(id) ? '' : '.ts')));
          return require(id);
        },
      },
    );
    cache.set(file, mod.exports);
    return mod.exports;
  }
  return load;
}
test('roster shows persistent named progress, handles withdraw/new phase/offline and never exposes answers', async () => {
  const load = loader(),
    r = new MajorityRoom('ABCDEF', 'friends', () => 0);
  const p = Array.from({ length: 3 }, (_, i) => r.add('P' + i));
  r.start();
  r.act(r.presenterId, 'ask', { type: 'blank', prompt: '私密回答', options: [] });
  const props = vue.reactive({ snapshot: r.view(p[1].id), status: () => '' });
  const host = document.createElement('div');
  document.body.append(host);
  const component = load(path.resolve(__dirname, '../src/components/RoomRoster.vue')).default;
  const app = vue.createApp({ render: () => vue.h(component, props) });
  app.mount(host);
  const card = (id) => host.querySelector(`[data-player-id="${id}"]`);
  assert.equal(card(p[0].id).querySelector('.vue-player-card-progress').textContent, '等待中');
  r.act(p[0].id, 'answer', { answer: '這個答案絕不能提前公開' });
  p[0].lastSeen = 0;
  props.snapshot = r.view(p[1].id);
  await vue.nextTick();
  assert.match(
    card(p[0].id).querySelector('.vue-player-card-progress').textContent,
    /已選擇.*暫時離線/,
  );
  assert.equal(card(p[0].id).dataset.progress, 'complete');
  assert.ok(!host.textContent.includes('這個答案絕不能提前公開'));
  r.act(p[0].id, 'withdraw');
  props.snapshot = r.view(p[1].id);
  await vue.nextTick();
  assert.equal(card(p[0].id).dataset.progress, 'pending');
  props.snapshot = { ...props.snapshot, phase: 'choosing', answeredIds: [p[0].id] };
  await vue.nextTick();
  assert.equal(
    card(p[0].id).dataset.progress,
    'pending',
    'stale IDs do not mark a different phase complete',
  );
  assert.match(card(p[0].id).textContent, /出題人/);
  app.unmount();
  host.remove();
});
test('public completion adapters distinguish partial choices, active phases and next-round spectators', () => {
  const { submissionProgress: progress } = loader()(
    path.resolve(__dirname, '../src/contracts/submission.ts'),
  );
  const p = { id: 'p', online: true, ready: false },
    s = { phase: 'answering', type: 'majority', participantIds: ['p'], answeredIds: ['p'] };
  assert.equal(progress(s, p).complete, true);
  assert.equal(progress(s, { ...p, waitingForNextRound: true }).complete, false);
  assert.equal(progress({ ...s, phase: 'waiting' }, p), null);
  assert.equal(
    progress({ type: 'gift', phase: 'choosing', gaveIds: ['p'], wishedIds: [] }, p).complete,
    false,
  );
  assert.equal(
    progress({ type: 'gift', phase: 'choosing', gaveIds: ['p'], wishedIds: ['p'] }, p).complete,
    true,
  );
  for (const [type, phase] of [
    ['telephone', 'passing'],
    ['telephone', 'prompting'],
    ['trpg', 'planning'],
  ]) {
    assert.equal(progress({ type, phase }, p).complete, false);
    assert.equal(progress({ type, phase }, { ...p, ready: true }).complete, true);
  }
  for (const [type, phase] of [
    ['minimal', 'drawing'],
    ['bluff', 'preparing'],
    ['musicquiz', 'intro'],
  ]) {
    assert.equal(progress({ type, phase, readyIds: [] }, p).complete, false);
    assert.equal(progress({ type, phase, readyIds: ['p'] }, p).complete, true);
  }
  assert.equal(
    progress({ type: 'musicquiz', phase: 'challenge', djId: 'dj', passed: ['p'] }, p).complete,
    true,
  );
});
