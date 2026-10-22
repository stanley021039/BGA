// Optional native Chromium IME check; expose playwright through NODE_PATH.
// Uses an isolated scene fixture, not production accounts or room data.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const ts = require('../../frontend/node_modules/typescript');
const { parse, compileScript } = require('../../frontend/node_modules/vue/compiler-sfc');
const root = path.resolve(__dirname, '../..');
const source = compileScript(
  parse(fs.readFileSync(path.join(root, 'frontend/src/pages/telephone/TelephoneScene.vue'), 'utf8'))
    .descriptor,
  { id: 'telephone-ime-browser', inlineTemplate: true },
).content;
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    for (const width of [1920, 390]) {
      const page = await browser.newPage({
        viewport: { width, height: width === 1920 ? 1080 : 844 },
      });
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.setContent('<main id="app"></main>');
      await page.addScriptTag({
        path: path.join(root, 'frontend/node_modules/vue/dist/vue.global.prod.js'),
      });
      await page.evaluate((code) => {
        const stub = {
          setup(_p, { expose }) {
            expose({ cancel() {} });
            return () => null;
          },
        };
        const telephone = Vue.reactive({
          state: {
            phase: 'passing',
            stepId: 'g1',
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
          now: Date.now(),
          editable: true,
          expired: false,
          changeText(value) {
            if (this.editable)
              this.text = [...value.replace(/[\u0000-\u001f\u007f]/g, '')].slice(0, 80).join('');
          },
        });
        window.probe = telephone;
        const module = { exports: {} };
        const require = (id) =>
          id === 'vue'
            ? Vue
            : id.includes('stores/telephone')
              ? { useTelephoneStore: () => telephone }
              : id.includes('stores/room')
                ? { useRoomStore: () => ({ scope: 1 }) }
                : id.includes('stores/party-actions')
                  ? { usePartyActionsStore: () => ({}) }
                  : { default: stub };
        new Function('module', 'exports', 'require', code)(module, module.exports, require);
        Vue.createApp(module.exports.default).mount('#app');
        window.probeClock = setInterval(() => {
          telephone.now += 250;
          telephone.state = { ...telephone.state };
        }, 250);
      }, compiled);
      const input = page.locator('#telephoneGuess');
      await input.focus();
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Input.imeSetComposition', {
        text: '中文組字',
        selectionStart: 4,
        selectionEnd: 4,
      });
      await page.waitForTimeout(1250);
      assert.equal(await input.inputValue(), '中文組字');
      assert.equal(await page.evaluate(() => probe.text), '', 'preedit must not enter the draft');
      await cdp.send('Input.insertText', { text: '中文答案' });
      await page.waitForTimeout(300);
      assert.equal(await input.inputValue(), '中文答案');
      assert.equal(await page.evaluate(() => probe.text), '中文答案');
      await cdp.send('Input.imeSetComposition', {
        text: '接著',
        selectionStart: 2,
        selectionEnd: 2,
      });
      await page.waitForTimeout(550);
      assert.equal(await input.inputValue(), '中文答案接著');
      await cdp.send('Input.insertText', { text: '再選字' });
      assert.equal(await input.inputValue(), '中文答案再選字');
      await page.evaluate(async () => {
        probe.text = '';
        probe.state.stepId = 'g2';
        await Vue.nextTick();
      });
      assert.equal(await input.inputValue(), '');
      assert.deepEqual(errors, []);
      console.log(JSON.stringify({ width, nativeChromiumComposition: 'pass', errors }));
      await page.close();
    }
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
