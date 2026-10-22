'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parseHTML } = require('linkedom');
const { window } = parseHTML('<html><body></body></html>');
for (const key of ['window', 'document', 'Element', 'HTMLElement', 'SVGElement', 'Event'])
  global[key] = key === 'window' ? window : window[key];
const vue = require('vue');
const ts = require('typescript');
const { parse, compileScript } = require('vue/compiler-sfc');

function harness() {
  const changes = [];
  const telephone = vue.reactive({
    state: {
      phase: 'passing',
      stepId: 'guess-1',
      round: 2,
      roundLimit: 2,
      players: [],
      sources: [],
      options: { sources: [] },
      books: [],
      task: { kind: 'text', submitted: false, previous: { authorName: '畫者', strokes: [] } },
    },
    text: '',
    strokes: [],
    now: 1000,
    editable: true,
    expired: false,
    changeText(value) {
      if (!this.editable) return;
      this.text = [...value.replace(/[\u0000-\u001f\u007f]/g, '')].slice(0, 80).join('');
      changes.push(this.text);
    },
  });
  const room = vue.reactive({ scope: 1 });
  const source = compileScript(
    parse(
      fs.readFileSync(path.join(__dirname, '../src/pages/telephone/TelephoneScene.vue'), 'utf8'),
    ).descriptor,
    { id: 'telephone-ime', inlineTemplate: true },
  ).content;
  const stub = {
    setup(_props, { expose }) {
      expose({ cancel() {} });
      return () => null;
    },
  };
  const loaded = { exports: {} };
  vm.runInNewContext(
    ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    {
      module: loaded,
      exports: loaded.exports,
      document,
      require: (id) =>
        id === 'vue'
          ? vue
          : id.includes('stores/telephone')
            ? { useTelephoneStore: () => telephone }
            : id.includes('stores/room')
              ? { useRoomStore: () => room }
              : id.includes('stores/party-actions')
                ? { usePartyActionsStore: () => ({}) }
                : { default: stub },
    },
  );
  const host = document.createElement('div');
  document.body.append(host);
  const app = vue.createApp(loaded.exports.default);
  app.mount(host);
  const input = () => host.querySelector('#telephoneGuess');
  function event(type, value) {
    if (value !== undefined) input().value = value;
    input().dispatchEvent(new window.Event(type, { bubbles: true }));
  }
  return {
    telephone,
    room,
    changes,
    input,
    event,
    dispose() {
      app.unmount();
      host.remove();
    },
  };
}

test('actual scene retains Chinese composition through countdown and snapshot renders', async () => {
  const h = harness();
  try {
    h.event('input', '原有');
    await vue.nextTick();
    h.event('compositionstart');
    h.event('input', '原有注音');
    await vue.nextTick();
    assert.equal(h.telephone.text, '原有', 'unfinished composition is not sent to drafts');
    for (let tick = 0; tick < 4; tick++) {
      h.telephone.now += 250;
      h.telephone.state = { ...h.telephone.state };
      await vue.nextTick();
      assert.equal(h.input().value, '原有注音');
    }
    h.event('compositionend', '原有中文');
    await vue.nextTick();
    assert.equal(h.input().value, '原有中文');
    assert.equal(h.telephone.text, '原有中文');
    h.event('compositionstart');
    h.event('input', '原有中文取消');
    h.event('compositionend', '原有中文');
    await vue.nextTick();
    assert.equal(h.input().value, '原有中文');
    h.event('compositionstart');
    h.event('input', '原有中文未選字');
    const oldInput = h.input();
    h.telephone.state.stepId = 'guess-2';
    h.telephone.text = '';
    await vue.nextTick();
    assert.equal(h.input().value, '', 'new page clears the prior guess');
    assert.notEqual(h.input(), oldInput, 'new page cannot inherit an active IME session');
    h.event('input', '新頁');
    await vue.nextTick();
    assert.equal(h.telephone.text, '新頁');
  } finally {
    h.dispose();
  }
});

test('completed input still normalizes controls and limits Unicode code points', async () => {
  const h = harness();
  try {
    for (const value of ['English', '貼上\n中文\t', '😀'.repeat(81), '😀'.repeat(80) + '多']) {
      h.event('input', value);
      await vue.nextTick();
      const expected = [...value.replace(/[\u0000-\u001f\u007f]/g, '')].slice(0, 80).join('');
      assert.equal(h.telephone.text, expected);
      assert.equal(h.input().value, expected);
    }
  } finally {
    h.dispose();
  }
});
