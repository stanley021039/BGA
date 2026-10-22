// Isolated draw/sync/error UI acceptance. Build frontend first; expose playwright
// through NODE_PATH. Uses only a synthetic local account and disposable database.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { createAuth } = require('../../src/auth');
const { appFixture } = require('../../tests/helpers/app-fixture.cjs');
(async () => {
  const cleanup = [];
  let browser;
  try {
    const password = 'synthetic-telephone-notices-password';
    const { base } = await appFixture(
      { after: (task) => cleanup.push(task) },
      {
        config: {
          frontendEnabled: true,
          frontendRoot: path.resolve(__dirname, '../../frontend/dist'),
          marketAutomationEnabled: false,
          achievementPurpose: 'test',
        },
        seed: (db) => createAuth(db).bootstrap('notices_owner', password),
      },
    );
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    const out = path.resolve(__dirname, '../../work/qa-telephone-notices');
    fs.mkdirSync(out, { recursive: true });
    const results = [],
      errors = [];
    for (const width of [1920, 390]) {
      const context = await browser.newContext({
        viewport: { width, height: width === 1920 ? 1080 : 844 },
        colorScheme: width === 1920 ? 'light' : 'dark',
      });
      const post = async (route, data) => {
        const response = await context.request.post(base + '/api/' + route, { data });
        assert.equal(response.status(), 200, await response.text());
        return response.json();
      };
      await post('auth/login', { username: 'notices_owner', password });
      const { code } = await post('create', { type: 'telephone' });
      await post('bot', { code });
      await post('bot', { code });
      const opening = await post('start', { code });
      await post('action', {
        code,
        action: 'submit',
        stepId: opening.stepId,
        requestId: require('node:crypto').randomUUID(),
        text: '通知驗收主題',
      });
      let drawing;
      for (let tries = 0; tries < 100; tries++) {
        drawing = await (await context.request.get(base + '/api/state?code=' + code)).json();
        if (drawing.phase === 'passing') break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      assert.equal(drawing.phase, 'passing');
      const page = await context.newPage();
      page.on('pageerror', (error) => errors.push(error.message));
      await page.addLocatorHandler(page.locator('.vue-media-consent-dialog[open]'), () =>
        page.getByRole('button', { name: '略過（本機不載入）', exact: true }).click(),
      );
      await page.goto(base + '/telephone/' + code);
      const canvas = page.locator('.vue-telephone-drawing-console canvas');
      await canvas.waitFor();
      // Close the normal consent UI before measuring or using pointer input.
      await page.getByRole('button', { name: '完成並提交這一頁', exact: true }).hover();
      const metrics = () =>
        page.evaluate(() => {
          const rect = (selector) => {
            const r = document.querySelector(selector).getBoundingClientRect();
            return { width: r.width, height: r.height };
          };
          return {
            horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
            stage: rect('.vue-telephone-stage'),
            actions: rect('.vue-telephone-actions'),
            quota: !!document.querySelector('.vue-telephone-quota'),
          };
        });
      const initial = await metrics();
      assert.equal(initial.quota, false);
      assert.doesNotMatch(
        await page.locator('.vue-telephone-stage').textContent(),
        /目前草稿已與伺服器同步|伺服器已接受.*筆|3,000 點/,
      );
      await page.screenshot({ path: path.join(out, `${width}-initial.png`), fullPage: true });
      const box = await canvas.boundingBox();
      await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.3);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.6, { steps: 8 });
      await page.evaluate(() => {
        window.drawSamples = [];
        window.drawSampling = setInterval(() => {
          const c = document.querySelector('.vue-telephone-drawing-console canvas');
          const data = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
          let dark = 0;
          for (let i = 0; i < data.length; i += 4)
            if (data[i + 3] && data[i] < 180 && data[i + 1] < 180 && data[i + 2] < 180) dark++;
          window.drawSamples.push(dark);
        }, 25);
      });
      await page.waitForTimeout(1250);
      await page.mouse.up();
      let state;
      for (let tries = 0; tries < 40; tries++) {
        state = await (await context.request.get(base + '/api/state?code=' + code)).json();
        if (state.task.draft?.strokes?.[0]?.points.length >= 9) break;
        await page.waitForTimeout(100);
      }
      assert.ok(state.task.draft?.strokes?.[0]?.points.length >= 9);
      await page.waitForTimeout(200);
      const samples = await page.evaluate(() => {
        clearInterval(window.drawSampling);
        return window.drawSamples;
      });
      assert.ok(
        samples.length > 10 && samples.every((value) => value > 0),
        'held stroke/ACK/release must not blank',
      );
      assert.equal(await page.locator('.vue-telephone-status').textContent(), '');
      const success = await metrics();
      assert.deepEqual(success, initial);
      await page.screenshot({ path: path.join(out, `${width}-success.png`), fullPage: true });
      await page.route('**/api/telephone/draft', (route) =>
        route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ error: '測試草稿同步失敗', code: 'SYNTHETIC' }),
        }),
      );
      await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.7);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * 0.65, box.y + box.height * 0.2, { steps: 5 });
      await page.mouse.up();
      await page.waitForFunction(() =>
        document.querySelector('.vue-telephone-status')?.textContent.includes('測試草稿同步失敗'),
      );
      const failure = await metrics();
      assert.deepEqual(failure, initial);
      assert.equal(failure.horizontalOverflow, false);
      await page.screenshot({ path: path.join(out, `${width}-failure.png`), fullPage: true });
      results.push({
        width,
        initial,
        success,
        failure,
        heldStrokeSamples: samples.length,
        minimumDarkPixels: Math.min(...samples),
      });
      await page.unroute('**/api/telephone/draft');
      await post('leave', { code });
      await context.close();
    }
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(out, 'metrics.json'), JSON.stringify({ results, errors }, null, 2));
    console.log(
      JSON.stringify({
        widths: [1920, 390],
        draft: 'pass',
        failureVisible: 'pass',
        heldStroke: 'pass',
        errors,
      }),
    );
  } finally {
    await browser?.close();
    for (const task of cleanup.reverse()) await task();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
