'use strict';
const fs = require('fs'),
  path = require('path'),
  assert = require('node:assert/strict'),
  { randomUUID } = require('crypto'),
  { chromium } = require('playwright');
const { openDatabase } = require('../../src/db'),
  { createAuth } = require('../../src/auth'),
  { createApp } = require('../../src/app'),
  { AchievementStore } = require('../../src/achievements/store'),
  { rewards } = require('../../src/achievements/rewards');
const out = path.resolve(__dirname, '../../work/qa/achievement-rewards');
fs.mkdirSync(out, { recursive: true });
(async () => {
  const root = fs.mkdtempSync(path.join(out, 'data-')),
    dbFile = path.join(root, 'qa.sqlite'),
    db = openDatabase(dbFile),
    auth = createAuth(db),
    password = 'synthetic-reward-qa-password';
  await auth.bootstrap('reward_owner', password);
  const owner = db.prepare("SELECT * FROM users WHERE username='reward_owner'").get(),
    invite = auth.createInvite(owner, { days: 1 });
  await auth.register(
    {
      username: 'reward_peer',
      displayName: '朋友',
      password,
      confirmPassword: password,
      invite: invite.code,
    },
    { setHeader() {} },
  );
  // Synthetic earned badges isolate visual/claim testing. Real game qualification
  // and transfer integrity are exercised in achievement-rewards.test.js.
  const store = new AchievementStore(db);
  for (const r of rewards)
    store.insert.run(owner.id, r.achievementId, 'visual-fixture', new Date().toISOString());
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
    const api = async (ctx, route, data) => {
      const response = await ctx.request[data === undefined ? 'get' : 'post'](
        base + '/api/' + route,
        data === undefined ? {} : { data },
      );
      assert.equal(response.status(), 200, route + ' ' + (await response.text()));
      return response.json();
    };
    for (const width of [1280, 1920, 390, 320]) {
      const context = await browser.newContext({
          viewport: { width, height: width === 1920 ? 1080 : width === 1280 ? 900 : 844 },
          colorScheme: width === 1280 ? 'dark' : 'light',
        }),
        peer = await browser.newContext({ viewport: { width, height: 844 } });
      await api(context, 'auth/login', { username: 'reward_owner', password });
      await api(peer, 'auth/login', { username: 'reward_peer', password });
      const page = await context.newPage(),
        errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(base + '/achievements');
      await page.locator('.achievement-reward').first().waitFor();
      assert.equal(await page.locator('.achievement-card').count(), 47);
      assert.equal(await page.locator('.achievement-reward').count(), 12);
      assert.equal(await page.locator('.achievement-reward .reward-object').count(), 12);
      if (width === 1280)
        for (const r of rewards) {
          const button = page
            .locator('[data-achievement-id="' + r.achievementId + '"]')
            .getByRole('button', { name: '領取獎勵', exact: true });
          await button.click();
          await page
            .locator('[data-achievement-id="' + r.achievementId + '"]')
            .getByRole('button', { name: '套用彈幕框', exact: true })
            .waitFor();
        }
      const item = page.locator('[data-achievement-id="draw-regular"]');
      await item.getByRole('button', { name: '套用彈幕框', exact: true }).click();
      assert.equal(await page.evaluate(() => BarrageFrames.get().selected), 'palette');
      await item.getByRole('button', { name: '套用播放器', exact: true }).click();
      assert.equal(await page.evaluate(() => MediaAppearance.get()), 'palette');
      await page.reload();
      await page.locator('.achievement-reward').first().waitFor();
      await page.waitForFunction(() => BarrageFrames.canUse('palette'));
      assert.equal(await page.evaluate(() => BarrageFrames.get().selected), 'palette');
      await page.screenshot({
        path: path.join(out, 'achievements-' + width + '.png'),
        fullPage: true,
      });
      await page.locator('#achievementGameFilter').selectOption('musicquiz');
      await page.screenshot({
        path: path.join(out, 'music-reward-' + width + '.png'),
        fullPage: width === 1280,
      });
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
        false,
        'achievement horizontal overflow ' + width,
      );
      const before = await peer.request.post(base + '/api/lobby/barrage', {
        data: { message: 'locked', requestId: randomUUID(), builtinFrameId: 'palette' },
      });
      assert.equal(before.status(), 403);
      await page.goto(base + '/');
      await page.locator('[data-lobby-barrage]').waitFor();
      await page.waitForFunction(() => BarrageFrames.canUse('palette'));
      await page.waitForTimeout(700);
      await page.locator('[data-lobby-barrage]').click();
      await page.locator('#lobbyBarrageText').fill('我的主題獎勵框');
      /* debug layout removed */ await page.evaluate(() => {
        const l = document.querySelector('.lobby-barrage-layer'),
          b = document.createElement('div');
        b.className = 'game-barrage game-barrage-framed lobby-barrage';
        BarrageFrames.decorate(
          b,
          { kind: 'builtin', id: 'palette', version: 1 },
          'reward_owner',
          '我的主題獎勵框',
        );
        l.append(b);
        const x = {
          prefs: BarrageFrames.get(),
          motion: MotionPolicy.get(),
          hidden: document.hidden,
          layer: l.clientHeight,
          bubble: b.offsetHeight,
          width: b.offsetWidth,
        };
        b.remove();
        return x;
      });
      await page.locator('.lobby-barrage-dialog [type=submit]').click();
      await page.locator('.lobby-barrage[data-frame-id=palette]').waitFor();
      const { code } = await api(context, 'create', { type: 'musicquiz' });
      await page.addLocatorHandler(page.locator('#tableMediaConsent[open]'), () =>
        page.locator('#mediaConsentDecline').click(),
      );
      await page.goto(base + '/musicquiz/' + code);
      await page.locator('.mq-banks').waitFor();
      await page.waitForFunction(() => BarrageFrames.canUse('palette'));
      const slots = await page.evaluate(() =>
        ['.mq-roster', '.mq-stage', '#mqChat'].map((s) => {
          const r = document.querySelector(s).getBoundingClientRect();
          return { x: r.x, y: r.y };
        }),
      );
      if (width >= 1280)
        assert.ok(
          slots[0].x < slots[1].x && slots[1].x < slots[2].x,
          'friends left / play center / chat right',
        );
      else assert.ok(slots[0].y < slots[1].y && slots[1].y < slots[2].y, 'mobile slot order');
      const geometry = [];
      for (const id of await page.evaluate(() =>
        BarrageFrames.options
          .filter((o) => !['default', 'paper', 'comic', 'pixel'].includes(o.id))
          .map((o) => o.id),
      )) {
        await page.evaluate((id) => {
          MediaAppearance.set(id);
          TableMedia.open();
        }, id);
        await page.locator('#tableMedia[open]').waitFor();
        await page.waitForTimeout(120);
        const bounds = await page.evaluate(() => {
          const d = document.querySelector('#tableMedia'),
            r = d.getBoundingClientRect(),
            arts = [
              ...d.querySelectorAll('.barrage-art-root>div:not(.inset-0):not(.reward-surface)'),
            ]
              .filter((n) => getComputedStyle(n).visibility === 'visible')
              .map((n) => {
                const b = n.getBoundingClientRect();
                return {
                  left: b.left,
                  top: b.top,
                  right: b.right,
                  bottom: b.bottom,
                  outside:
                    b.top < r.top || b.right > r.right || b.left < r.left || b.bottom > r.bottom,
                  pointer: getComputedStyle(n).pointerEvents,
                };
              });
          return {
            overflow: getComputedStyle(d).overflow,
            arts,
            width: innerWidth,
            height: innerHeight,
          };
        });
        assert.equal(bounds.overflow, 'visible');
        assert.ok(
          bounds.arts.some((a) => a.outside),
          id + ' decoration extends',
        );
        assert.ok(
          bounds.arts.every(
            (a) =>
              a.pointer === 'none' &&
              a.left >= 0 &&
              a.top >= 0 &&
              a.right <= bounds.width &&
              a.bottom <= bounds.height,
          ),
          id + ' complete viewport ' + JSON.stringify(bounds),
        );
        geometry.push({ id, ...bounds });
        if (['jelly', 'palette', 'vinyl', 'mic'].includes(id))
          await page.screenshot({
            path: path.join(out, 'player-' + id + '-' + width + '.png'),
            fullPage: true,
          });
      }
      assert.deepEqual(errors, []);
      evidence.push({ width, claimAndReload: true, lockedPeerDenied: true, geometry, errors });
      await context.close();
      await peer.close();
      console.log('PASS achievement native ' + width);
    }
    fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(evidence, null, 2));
  } catch (error) {
    console.error(error);
    for (const context of browser?.contexts() || [])
      for (const page of context.pages()) {
        console.log((await page.locator('body').innerText()).slice(-5000));
        await page.screenshot({
          path: path.join(out, 'failure-' + Date.now() + '.png'),
          fullPage: true,
        });
      }
    process.exitCode = 1;
  } finally {
    await browser?.close();
    await app.close();
  }
})();
