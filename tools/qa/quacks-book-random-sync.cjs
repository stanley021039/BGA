'use strict';
const fs = require('fs'),
  path = require('path'),
  assert = require('assert/strict'),
  { chromium } = require('playwright'),
  { openDatabase } = require('../../src/db'),
  { createAuth } = require('../../src/auth'),
  { createApp } = require('../../src/app'),
  { QuacksRoom } = require('../../src/games/quacks');
// Fixed legal random results exercise a second randomization with identical selections.
QuacksRoom.prototype.index = (n) => n - 1;
const out = path.resolve(__dirname, '../../work/qa/quacks-book-random-sync');
fs.mkdirSync(out, { recursive: true });
(async () => {
  const root = fs.mkdtempSync(path.join(out, 'data-')),
    dbFile = path.join(root, 'qa.sqlite'),
    db = openDatabase(dbFile),
    auth = createAuth(db),
    password = 'synthetic-browser-password';
  await auth.bootstrap('book_owner', password);
  const admin = db.prepare("SELECT * FROM users WHERE username='book_owner'").get(),
    invite = auth.createInvite(admin, { days: 1 });
  await auth.register(
    {
      username: 'book_peer',
      displayName: '朋友',
      password,
      confirmPassword: password,
      invite: invite.code,
    },
    { setHeader() {} },
  );
  db.close();
  const app = createApp({
    host: '127.0.0.1',
    port: 0,
    dbFile,
    communityDir: path.join(root, 'community'),
    musicDir: path.join(root, 'music'),
    achievementPurpose: 'test',
    externalSideEffectsEnabled: false,
    marketAutomationEnabled: false,
    githubClient: { configured: false },
  });
  let browser;
  const evidence = [];
  try {
    const { port } = await app.listen(),
      base = 'http://127.0.0.1:' + port;
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    for (const width of [1280, 390]) {
      const contexts = await Promise.all(
          [0, 1].map(() =>
            browser.newContext({
              viewport: { width, height: 900 },
              colorScheme: width === 1280 ? 'dark' : 'light',
            }),
          ),
        ),
        request = async (i, route, data) => {
          const res = await contexts[i].request[data === undefined ? 'get' : 'post'](
            base + '/api/' + route,
            data === undefined ? {} : { data },
          );
          assert.equal(res.status(), 200, await res.text());
          return res.json();
        };
      for (let i = 0; i < 2; i++)
        await request(i, 'auth/login', { username: i ? 'book_peer' : 'book_owner', password });
      const { code } = await request(0, 'create', { type: 'quacks', witches: true });
      await request(1, 'join', { code });
      const pages = await Promise.all(contexts.map((c) => c.newPage())),
        errors = [];
      for (const p of pages) {
        p.on('pageerror', (e) => errors.push(e.message));
        await p.addLocatorHandler(p.locator('#tableMediaConsent[open]'), () =>
          p.locator('#mediaConsentDecline').click(),
        );
        await p.goto(base + '/quacks/' + code);
        await p.locator('.q-header').waitFor();
      }
      await pages[0].locator('[data-room-action=start]').click();
      await pages[0].locator('#bookDialog').waitFor();
      await pages[1].locator('#qBook').click();
      for (const p of pages) {
        await p.locator('#qBookTab-green').click();
        assert.equal(await p.locator('.book-voting-heading button').count(), 1);
        assert.equal(await p.locator('[data-book-control=help]').count(), 0);
        assert.equal(await p.locator('[data-book-control=settings]').count(), 0);
        assert.equal(await p.locator('#bookVotingHelp').count(), 0);
      }
      await pages[0].locator('[data-book-control="green-face-2"]').click();
      await pages[1].locator('[data-book-control="green-face-4"]').click();
      const waitSelected = async (p) =>
        p.waitForFunction(
          () =>
            document.querySelector('#bookVoting [data-ingredient="green"] .book-page-effect>strong')
              ?.textContent === '第 6 面效果',
        );
      await pages[0].locator('[data-book-control=random]').click();
      for (const p of pages) await waitSelected(p);
      for (const p of pages) {
        const card = p.locator('#bookVoting [data-ingredient=green]');
        assert.equal(await card.locator('.book-selected-stamp').textContent(), '已選');
        assert.equal(
          await card.locator('.book-page-top small').textContent(),
          '第 6 面 · 本局採用',
        );
        assert.equal(await p.locator('#qBookTab-green').getAttribute('aria-selected'), 'true');
        assert.equal(await p.locator('#bookVoting .book-card:visible').count(), 1);
      }
      await pages[1].locator('[data-book-control="green-face-2"]').click();
      await pages[1].waitForTimeout(2600);
      assert.equal(
        await pages[1]
          .locator('#bookVoting [data-ingredient=green] .book-page-effect>strong')
          .textContent(),
        '第 2 面效果',
      );
      await pages[0].locator('[data-book-control="green-face-3"]').click();
      await pages[0].locator('[data-book-control=random]').click();
      for (const p of pages) await waitSelected(p);
      await pages[0].locator('[data-book-control="green-face-1"]').click();
      await pages[1].locator('[data-book-control=random]').click();
      for (const p of pages) await waitSelected(p);
      for (let i = 0; i < 2; i++) {
        await pages[i].screenshot({
          path: path.join(out, 'random-synced-' + width + '-' + i + '.png'),
          fullPage: true,
        });
        assert.ok(
          await pages[i].evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        );
      }
      const s = await request(0, 'state?code=' + code);
      assert.equal(s.bookSelection.find((b) => b.color === 'green').selected, 6);
      assert.ok(await pages[0].locator('.room-settings-panel').count());
      assert.deepEqual(errors, []);
      evidence.push({
        width,
        realHttp: true,
        removedTwoHeadingButtons: true,
        bothPagesSynced: true,
        bothPlayersSynced: true,
        identicalRandomResultSynced: true,
        manualBrowsingRetainedDuringPoll: true,
        activeColorRetained: true,
        outsideRoomSettingsRetained: true,
        errors,
      });
      for (const c of contexts) await c.close();
    }
    fs.writeFileSync(path.join(out, 'evidence.json'), JSON.stringify(evidence, null, 2));
    console.log(JSON.stringify(evidence));
  } finally {
    await browser?.close();
    await app.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
