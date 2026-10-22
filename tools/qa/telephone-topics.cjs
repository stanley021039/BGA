// Native three-seat opening-topic acceptance. Build frontend first and expose
// playwright through NODE_PATH. Case B waits the real 90-second topic deadline.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { chromium } = require('playwright');
const { createAuth } = require('../../src/auth');
const { appFixture } = require('../../tests/helpers/app-fixture.cjs');
const { TelephoneRoom } = require('../../src/games/telephone');
(async () => {
  const cleanup = [],
    rooms = new Map(),
    originalStart = TelephoneRoom.prototype.start;
  TelephoneRoom.prototype.start = function () {
    originalStart.call(this);
    rooms.set(this.code, this);
  };
  let browser;
  try {
    const password = 'synthetic-telephone-topics-password';
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
          await auth.bootstrap('topics_owner', password);
          const owner = db.prepare("SELECT * FROM users WHERE username='topics_owner'").get();
          for (const username of ['topics_peer1', 'topics_peer2'])
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
    const clients = [],
      errors = [],
      evidence = [];
    const out = path.resolve(__dirname, '../../work/qa-telephone-topics');
    fs.mkdirSync(out, { recursive: true });
    const post = async (client, route, data) => {
      const response = await client.context.request.post(base + '/api/' + route, { data });
      assert.equal(response.status(), 200, await response.text());
      return response.json();
    };
    const state = async (client, code) =>
      (await client.context.request.get(base + '/api/state?code=' + code)).json();
    async function until(read, predicate, timeout = 12000, interval = 100) {
      const deadline = Date.now() + timeout;
      while (Date.now() < deadline) {
        const value = await read();
        if (predicate(value)) return value;
        await new Promise((resolve) => setTimeout(resolve, interval));
      }
      throw Error('Timed out waiting for the telephone state');
    }
    for (const [i, username] of ['topics_owner', 'topics_peer1', 'topics_peer2'].entries()) {
      const context = await browser.newContext({
        viewport: { width: i === 1 ? 390 : 1920, height: i === 1 ? 844 : 1080 },
        colorScheme: i === 1 ? 'dark' : 'light',
      });
      const current = { context, page: await context.newPage() };
      clients.push(current);
      await post(current, 'auth/login', { username, password });
      current.page.on('pageerror', (error) => errors.push(error.message));
      await current.page.addLocatorHandler(
        current.page.locator('.vue-media-consent-dialog[open]'),
        () => current.page.getByRole('button', { name: '略過（本機不載入）', exact: true }).click(),
      );
    }
    async function openRoom(sources) {
      const { code } = await post(clients[0], 'create', { type: 'telephone' });
      for (const current of clients.slice(1)) await post(current, 'join', { code });
      if (sources) await post(clients[0], 'settings', { code, sources });
      for (const current of clients) {
        await current.page.goto(base + '/telephone/' + code);
        await current.page.locator('.vue-game-main').waitFor();
        // Trigger the consent handler before screenshots or starting the timer.
        await current.page.locator('.vue-game-main').click({ position: { x: 5, y: 5 } });
      }
      const initial = await post(clients[0], 'start', { code });
      for (const current of clients) {
        await current.page.locator('#telephoneGuess').waitFor();
        assert.equal(await current.page.locator('.vue-telephone-previous').count(), 0);
        assert.equal(await current.page.locator('canvas').count(), 0);
      }
      return { code, initial };
    }
    async function snapshots(label) {
      for (const [i, current] of clients.slice(0, 2).entries()) {
        const geometry = await current.page.evaluate(() => {
          const r = document.querySelector('.vue-telephone-stage').getBoundingClientRect();
          return {
            width: r.width,
            height: r.height,
            horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
          };
        });
        assert.equal(geometry.horizontalOverflow, false);
        evidence.push({ label, seat: i, ...geometry });
        await current.page.screenshot({
          path: path.join(out, `${label}-${i}.png`),
          fullPage: true,
        });
      }
    }
    // A: all players submit well before the real deadline, with native IME and reload.
    const a = await openRoom();
    assert.equal(a.initial.phase, 'prompting');
    assert.equal(a.initial.round, 0);
    await snapshots('opening');
    const themes = ['狗狗在月球上吃火鍋' + '😀'.repeat(71), '會跳舞的仙人掌', '搭火箭的章魚'];
    await clients[0].page.bringToFront();
    const hostInput = clients[0].page.locator('#telephoneGuess');
    await hostInput.click();
    const cdp = await clients[0].context.newCDPSession(clients[0].page);
    await cdp.send('Input.imeSetComposition', {
      text: '中文組字',
      selectionStart: 4,
      selectionEnd: 4,
    });
    await clients[0].page.waitForTimeout(2200);
    assert.equal(await hostInput.inputValue(), '中文組字');
    assert.ok(!(await state(clients[0], a.code)).task.draft?.text);
    await cdp.send('Input.insertText', { text: themes[0] });
    await until(
      () => state(clients[0], a.code),
      (value) => value.task.draft?.text === themes[0],
    );
    await clients[0].page.reload();
    await hostInput.waitFor();
    assert.equal(await hostInput.inputValue(), themes[0]);
    assert.equal((await state(clients[0], a.code)).deadline, a.initial.deadline);
    await clients[0].page.getByRole('button', { name: '專注全螢幕', exact: true }).click();
    await clients[0].page.getByRole('button', { name: '退出專注全螢幕', exact: true }).waitFor();
    await clients[0].page.keyboard.press('Escape');
    assert.equal(await hostInput.inputValue(), themes[0]);
    await clients[0].page.getByRole('button', { name: '送出主題', exact: true }).click();
    await clients[0].page.getByText('主題已送出！', { exact: true }).waitFor();
    assert.equal((await state(clients[0], a.code)).phase, 'prompting');
    assert.ok(!JSON.stringify(await state(clients[1], a.code)).includes(themes[0]));
    await snapshots('submitted');
    for (const [i, current] of clients.entries())
      if (i) {
        await current.page.bringToFront();
        await current.page.locator('#telephoneGuess').fill(themes[i]);
        await current.page.getByRole('button', { name: '送出主題', exact: true }).click();
      }
    let current = await until(
      () => state(clients[0], a.code),
      (value) => value.phase === 'passing',
    );
    assert.ok(Date.now() < a.initial.deadline);
    assert.ok(current.deadline - Date.now() > 85000);
    for (const [i, client] of clients.entries()) {
      const value = await state(client, a.code);
      assert.equal(value.task.previous.text, themes[(i + 2) % 3]);
      await client.page.locator('.vue-telephone-drawing-console canvas').waitFor();
      assert.equal(await client.page.locator('#telephoneGuess').count(), 0);
    }
    await snapshots('first-drawing');
    assert.equal([...themes[0]].length, 80);
    assert.equal((await state(clients[1], a.code)).task.previous.text, themes[0]);
    // Complete the later draw/guess pages through real HTTP; only their deadlines
    // are accelerated in this isolated server, after all three have submitted.
    for (let round = 1; round <= 2; round++) {
      for (const [i, client] of clients.entries())
        await post(client, 'action', {
          code: a.code,
          stepId: current.stepId,
          requestId: randomUUID(),
          action: 'submit',
          ...(round % 2
            ? {
                strokes: [
                  {
                    tool: 'brush',
                    color: '#123456',
                    size: 6,
                    points: [
                      [10, 10],
                      [400, 220],
                    ],
                  },
                ],
              }
            : { text: '接力猜詞' + i }),
        });
      rooms.get(a.code).deadline = Date.now();
      const old = current.stepId;
      current = await until(
        () => state(clients[0], a.code),
        (value) => value.stepId !== old || value.phase === 'finished',
      );
    }
    assert.equal(current.books[0].pages[0].text, themes[0]);
    await clients[0].page.getByRole('button', { name: '開始播放故事', exact: true }).click();
    await clients[0].page.locator('.vue-telephone-book-text').waitFor();
    assert.equal(
      await clients[0].page.locator('.vue-telephone-book-text').textContent(),
      themes[0],
    );
    for (const client of clients) await post(client, 'leave', { code: a.code });
    // B: keep one blank and one synced but unsubmitted topic; do not shorten time.
    const b = await openRoom(['silly']);
    await clients[0].page.bringToFront();
    await clients[0].page.locator('#telephoneGuess').click();
    await clients[0].page.locator('#telephoneGuess').fill('手動出題');
    await clients[0].page.getByRole('button', { name: '送出主題', exact: true }).click();
    await clients[1].page.bringToFront();
    await clients[1].page.locator('#telephoneGuess').click();
    await clients[1].page.locator('#telephoneGuess').fill('已同步未送出的主題');
    await until(
      () => state(clients[1], b.code),
      (value) => value.task.draft?.text === '已同步未送出的主題',
    );
    assert.equal((await state(clients[0], b.code)).phase, 'prompting');
    console.log('Waiting for the real 90-second topic deadline.');
    current = await until(
      () => state(clients[0], b.code),
      (value) => value.phase === 'passing',
      100000,
      1000,
    );
    const elapsed = Date.now() - (b.initial.deadline - 90000);
    assert.ok(elapsed >= 90000, 'blank topic must not advance before the deadline');
    const books = rooms.get(b.code).books;
    assert.equal(books[0].pages[0].text, '手動出題');
    assert.equal(books[1].pages[0].text, '已同步未送出的主題');
    assert.equal(books[1].pages[0].timedOut, true);
    assert.ok(books[2].promptId.startsWith('telephone-silly-'));
    assert.equal(books[2].pages[0].topicFallback, true);
    assert.equal(current.task.previous.text, books[2].pages[0].text);
    for (const [index, client] of clients.entries()) {
      await client.page.locator('.vue-telephone-drawing-console canvas').waitFor();
      assert.equal(
        (await state(client, b.code)).task.previous.text,
        books[(index + 2) % 3].pages[0].text,
      );
    }
    await snapshots('timeout-drawing');
    assert.deepEqual(errors, []);
    fs.writeFileSync(
      path.join(out, 'metrics.json'),
      JSON.stringify({ evidence, elapsed, errors }, null, 2),
    );
    console.log(
      JSON.stringify({
        seats: 3,
        earlyStart: 'pass',
        IME: 'pass',
        reload: 'pass',
        focus: 'pass',
        realDeadlineMs: elapsed,
        fallback: 'silly',
        errors,
      }),
    );
  } finally {
    await browser?.close();
    for (const task of cleanup.reverse()) await task();
    TelephoneRoom.prototype.start = originalStart;
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
