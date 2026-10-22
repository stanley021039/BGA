// Isolated three-account HTTP + native Chrome acceptance. Requires frontend:build
// and playwright on NODE_PATH. No production accounts, rooms or data are used.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { chromium } = require('playwright');
const { appFixture } = require('../../tests/helpers/app-fixture.cjs');
const { createAuth } = require('../../src/auth');
const { TelephoneRoom } = require('../../src/games/telephone');
(async () => {
  const cleanup = [];
  const start = TelephoneRoom.prototype.start,
    auto = TelephoneRoom.prototype.auto;
  TelephoneRoom.prototype.start = function () {
    start.call(this);
    this.deadline = Date.now() + 2000;
  };
  TelephoneRoom.prototype.auto = function () {
    const changed = auto.call(this);
    if (changed && this.phase === 'passing') this.deadline = Date.now() + 2000;
    return changed;
  };
  const password = 'synthetic-telephone-browser-password';
  let browser;
  try {
    const { base } = await appFixture(
      { after: (task) => cleanup.push(task) },
      {
        config: {
          frontendEnabled: true,
          frontendRoot: path.resolve(__dirname, '../../frontend/dist'),
          marketAutomationEnabled: false,
          achievementPurpose: 'test',
        },
        seed: async (db) => {
          const auth = createAuth(db);
          await auth.bootstrap('review_owner', password);
          const owner = db.prepare("SELECT * FROM users WHERE username='review_owner'").get();
          for (const username of ['review_peer1', 'review_peer2'])
            await auth.register(
              {
                username,
                displayName: username,
                password,
                confirmPassword: password,
                invite: auth.createInvite(owner, { days: 1 }).code,
              },
              { setHeader() {} },
            );
        },
      },
    );
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    const clients = [];
    const errors = [];
    const post = async (context, route, data) => {
      const response = await context.request.post(base + '/api/' + route, { data });
      assert.equal(response.status(), 200, await response.text());
      return response.json();
    };
    for (const [i, username] of ['review_owner', 'review_peer1', 'review_peer2'].entries()) {
      const context = await browser.newContext({
        viewport: { width: i === 1 ? 390 : 1920, height: i === 1 ? 844 : 1080 },
        colorScheme: i === 1 ? 'dark' : 'light',
      });
      await post(context, 'auth/login', { username, password });
      clients.push({ context, page: await context.newPage() });
    }
    const { code } = await post(clients[0].context, 'create', { type: 'telephone' });
    for (const current of clients.slice(1)) await post(current.context, 'join', { code });
    for (const current of clients) {
      current.page.on('pageerror', (error) => errors.push(error.message));
      await current.page.addLocatorHandler(
        current.page.locator('.vue-media-consent-dialog[open]'),
        () => current.page.getByRole('button', { name: '略過（本機不載入）', exact: true }).click(),
      );
      await current.page.goto(base + '/telephone/' + code);
      await current.page.locator('.vue-game-main').waitFor();
    }
    let state = await post(clients[0].context, 'start', { code });
    for (let tries = 0; state.phase === 'prompting' && tries < 60; tries++) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      state = await (await clients[0].context.request.get(base + '/api/state?code=' + code)).json();
    }
    assert.equal(state.phase, 'passing');
    const stroke = {
      tool: 'brush',
      color: '#123456',
      size: 6,
      points: [
        [10, 10],
        [230, 110],
        [400, 200],
      ],
    };
    for (let round = 1; round <= 2; round++) {
      for (const [i, current] of clients.entries())
        await post(current.context, 'action', {
          code,
          stepId: state.stepId,
          requestId: randomUUID(),
          action: 'submit',
          ...(round % 2 ? { strokes: [stroke] } : { text: '第' + i + '位玩家的猜詞' }),
        });
      const oldStep = state.stepId;
      for (let tries = 0; tries < 60; tries++) {
        state = await (
          await clients[0].context.request.get(base + '/api/state?code=' + code)
        ).json();
        if (state.stepId !== oldStep || state.phase === 'finished') break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
    assert.equal(state.phase, 'finished');
    for (const current of clients) await current.page.locator('.vue-telephone-review').waitFor();
    const pages = state.books.flatMap((book) => book.pages);
    const out = path.resolve(__dirname, '../../work/qa-telephone-reveal');
    fs.mkdirSync(out, { recursive: true });
    const geometry = [];
    for (let index = 0; index < pages.length; index++) {
      await clients[0].page
        .getByRole('button', { name: index ? '播放下一頁' : '開始播放故事', exact: true })
        .click();
      for (const current of clients) {
        await current.page.waitForFunction(
          (position) =>
            document
              .querySelector('.vue-telephone-finished-heading [role=status]')
              ?.textContent?.startsWith(position + '／'),
          index + 1,
        );
        assert.equal(await current.page.locator('.vue-telephone-book-page').count(), 1);
        const text = current.page.locator('.vue-telephone-book-text');
        assert.equal(
          (await text.count()) ? await text.textContent() : '',
          pages[index].kind === 'text' ? pages[index].text : '',
        );
      }
      if (index <= 2 || index === pages.length - 1) {
        for (const [i, current] of clients.slice(0, 2).entries()) {
          const metrics = await current.page.evaluate(() => {
            const rect = (selector) => {
              const r = document.querySelector(selector).getBoundingClientRect();
              return { x: r.x, y: r.y, width: r.width, height: r.height };
            };
            const heading = document
              .querySelector('.vue-telephone-review > h2')
              .getBoundingClientRect();
            const card = document.querySelector('.vue-telephone-book-page').getBoundingClientRect();
            return {
              headingOverlapsCard: heading.bottom > card.top,
              viewport: [innerWidth, innerHeight],
              horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
              stage: rect('.vue-telephone-stage'),
              actions: rect('.vue-telephone-actions'),
            };
          });
          assert.equal(metrics.horizontalOverflow, false);
          assert.equal(metrics.headingOverlapsCard, false);
          geometry.push({ index, seat: i, ...metrics });
          await current.page.screenshot({
            path: path.join(out, `page-${index}-seat-${i}.png`),
            fullPage: true,
          });
        }
      }
    }
    for (const current of clients)
      assert.match(
        await current.page.locator('.vue-telephone-actions').textContent(),
        /所有故事已播放完畢/,
      );
    await clients[1].page.reload();
    await clients[1].page.locator('.vue-telephone-book-page').waitFor();
    assert.match(
      await clients[1].page.locator('.vue-telephone-actions').textContent(),
      /所有故事已播放完畢/,
    );
    await clients[0].page.getByRole('button', { name: '專注全螢幕', exact: true }).click();
    await clients[0].page.getByRole('button', { name: '退出專注全螢幕', exact: true }).waitFor();
    await clients[0].page.keyboard.press('Escape');
    await clients[0].page.getByRole('button', { name: '專注全螢幕', exact: true }).waitFor();
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(out, 'metrics.json'), JSON.stringify({ geometry, errors }, null, 2));
    console.log(
      JSON.stringify({
        seats: 3,
        fragments: pages.length,
        widths: [1920, 390],
        refresh: 'pass',
        focus: 'pass',
        errors,
      }),
    );
  } finally {
    await browser?.close();
    for (const task of cleanup.reverse()) await task();
    TelephoneRoom.prototype.start = start;
    TelephoneRoom.prototype.auto = auto;
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
