'use strict';
const fs = require('fs'),
  path = require('path'),
  assert = require('assert/strict'),
  { randomUUID } = require('crypto'),
  { chromium } = require('playwright'),
  { openDatabase } = require('../../src/db'),
  { createAuth } = require('../../src/auth'),
  { createApp } = require('../../src/app'),
  { BluffRoom } = require('../../src/games/bluff');
const out = path.resolve(__dirname, '../../work/qa/bluff-reaction-stack');
fs.mkdirSync(out, { recursive: true });
(async () => {
  const dir = fs.mkdtempSync(path.join(out, 'data-')),
    dbFile = path.join(dir, 'qa.sqlite'),
    db = openDatabase(dbFile);
  await createAuth(db).bootstrap('reaction_qa', 'synthetic-browser-password');
  db.close();
  const app = createApp({
    host: '127.0.0.1',
    port: 0,
    dbFile,
    communityDir: path.join(dir, 'community'),
    musicDir: path.join(dir, 'music'),
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
    for (const width of [1440, 390]) {
      const ctx = await browser.newContext({
        viewport: { width, height: 900 },
        colorScheme: width === 1440 ? 'dark' : 'light',
      });
      await ctx.request.post(base + '/api/auth/login', {
        data: { username: 'reaction_qa', password: 'synthetic-browser-password' },
      });
      const r = new BluffRoom('ABC123', '多人反應', () => 0),
        people = Array.from({ length: 9 }, (_, i) => r.add('朋友' + (i + 1)));
      r.start();
      r.act(r.thinkerId, 'choose', {
        questionId: r.choices[0].id,
        roundId: r.roundId,
        requestId: randomUUID(),
      });
      for (const p of people) r.act(p.id, 'ready', { roundId: r.roundId, requestId: randomUUID() });
      let snapshot = r.view(people[0].id);
      const page = await ctx.newPage(),
        errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.addLocatorHandler(page.locator('#tableMediaConsent[open]'), () =>
        page.locator('#mediaConsentDecline').click(),
      );
      await page.addInitScript(() => {
        window.__reactionPlaying = [];
        const Native = window.Audio;
        window.Audio = function (...args) {
          const clip = new Native(...args);
          clip.addEventListener('playing', () => {
            if (clip.src.includes('bluff-reaction.mp3')) window.__reactionPlaying.push(clip.volume);
          });
          return clip;
        };
        window.Audio.prototype = Native.prototype;
      });
      await page.route('**/api/reconnect', (route) =>
        route.fulfill({ json: { type: 'bluff', code: 'ABC123' } }),
      );
      await page.route('**/api/state?*', (route) => route.fulfill({ json: snapshot }));
      await page.goto(base + '/bluff/ABC123');
      await page.getByRole('button', { name: '哦是哦', exact: true }).waitFor();
      assert.equal(await page.getByRole('button', { name: '好了啦', exact: true }).count(), 0);
      const photo = page.locator('.bluff-reaction-button .ui-button-icon img');
      await photo.waitFor();
      await page.waitForFunction(
        () => document.querySelector('.bluff-reaction-button img')?.naturalWidth > 0,
      );
      assert.equal(await page.locator('.bluff-reaction-button .ui-button-icon svg').count(), 0);
      await page
        .getByRole('button', { name: '哦是哦', exact: true })
        .screenshot({ path: path.join(out, 'photo-button-' + width + '.png') });
      await page.locator('#gameFocusToggle').click();
      assert.equal(await page.evaluate(() => GameFocus.isActive()), true);
      for (const p of people.slice(0, 3))
        r.act(p.id, 'reaction', { roundId: r.roundId, requestId: randomUUID() });
      snapshot = r.view(people[0].id);
      await page.waitForFunction(
        () => document.querySelectorAll('#bluffReaction .bluff-reaction').length === 3,
      );
      for (const p of people.slice(3))
        r.act(p.id, 'reaction', { roundId: r.roundId, requestId: randomUUID() });
      snapshot = r.view(people[0].id);
      await page.waitForFunction(
        () => document.querySelectorAll('#bluffReaction .bluff-reaction').length === 9,
      );
      const lines = await page.locator('#bluffReaction .bluff-reaction').allTextContents();
      assert.deepEqual(
        lines,
        people.map((p) => p.name + ' 質疑你'),
      );
      const bounds = await page.locator('#bluffReaction').evaluate((n) => {
        const b = n.getBoundingClientRect();
        return {
          x: b.x,
          y: b.y,
          right: b.right,
          bottom: b.bottom,
          width: innerWidth,
          height: innerHeight,
        };
      });
      assert.ok(
        bounds.x >= 0 &&
          bounds.y >= 0 &&
          bounds.right <= bounds.width + 1 &&
          bounds.bottom <= bounds.height + 1,
        JSON.stringify(bounds),
      );
      assert.equal(await page.evaluate(() => __reactionPlaying.length), 1);
      assert.equal(await page.locator('#bluffReaction').isVisible(), true);
      await page.screenshot({ path: path.join(out, 'nine-players-' + width + '.png') });
      await page.reload();
      await page.getByRole('button', { name: '哦是哦', exact: true }).waitFor();
      assert.equal(await page.locator('#bluffReaction .bluff-reaction').count(), 0);
      assert.equal(await page.evaluate(() => __reactionPlaying.length), 0);
      assert.deepEqual(errors, []);
      evidence.push({
        width,
        visiblePlayers: lines.length,
        text: lines,
        soundPlaying: 1,
        focus: true,
        bounds,
        reloadSilent: true,
        errors,
      });
      await ctx.close();
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
