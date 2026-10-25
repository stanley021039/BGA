'use strict';
const fs = require('fs'),
  path = require('path'),
  assert = require('node:assert/strict'),
  { randomUUID } = require('crypto'),
  { chromium } = require('playwright');
const { openDatabase } = require('../../src/db'),
  { createAuth } = require('../../src/auth'),
  { createApp } = require('../../src/app');
const out = path.resolve(__dirname, '../../work/qa/musicquiz-refresh');
fs.mkdirSync(out, { recursive: true });
(async () => {
  const root = fs.mkdtempSync(path.join(out, 'data-')),
    dbFile = path.join(root, 'qa.sqlite'),
    db = openDatabase(dbFile),
    auth = createAuth(db),
    password = 'synthetic-music-qa-password';
  await auth.bootstrap('music_owner', password);
  const owner = db.prepare("SELECT * FROM users WHERE username='music_owner'").get(),
    invite = auth.createInvite(owner, { days: 1 });
  await auth.register(
    {
      username: 'music_peer',
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
    const api = async (ctx, route, data) => {
      const r = await ctx.request[data === undefined ? 'get' : 'post'](
        base + '/api/' + route,
        data === undefined ? {} : { data },
      );
      assert.equal(r.status(), 200, route + ' ' + (await r.text()));
      return r.json();
    };
    for (const width of [1920, 1280, 390, 320]) {
      const contexts = await Promise.all(
        [0, 1].map(() =>
          browser.newContext({
            viewport: { width, height: width === 1920 ? 1080 : width === 1280 ? 900 : 844 },
            colorScheme: width === 1280 ? 'dark' : 'light',
          }),
        ),
      );
      for (let i = 0; i < 2; i++)
        await api(contexts[i], 'auth/login', {
          username: i ? 'music_peer' : 'music_owner',
          password,
        });
      const page = await contexts[0].newPage(),
        peer = await contexts[1].newPage(),
        errors = [];
      page.on('pageerror', (e) => (errors.push(e.message), console.log(e.stack)));
      peer.on('pageerror', (e) => (errors.push(e.message), console.log(e.stack)));
      await page.addInitScript(() => {
        window.__mqPlayers = [];
        window.YT = {
          Player: class {
            constructor(id, options) {
              this.options = options;
              this.time = options.playerVars?.start || 0;
              this.frame = document.createElement('iframe');
              this.frame.title = '可控播放驗證';
              this.frame.srcdoc =
                '<body style="background:#171a18;color:#ecd49a;display:grid;place-items:center;height:90%;font:20px sans-serif">YouTube 播放控制驗證</body>';
              (typeof id === 'string' ? document.getElementById(id) : id).replaceWith(this.frame);
              window.__mqPlayers.push(this);
              setTimeout(() => options.events.onReady({ target: this }), 10);
            }
            setVolume(n) {
              this.volume = n;
            }
            playVideo() {
              this.played = true;
            }
            pauseVideo() {
              this.paused = true;
            }
            getCurrentTime() {
              return this.time;
            }
            destroy() {
              this.destroyed = true;
              this.frame.remove();
            }
          },
        };
      });
      const { code } = await api(contexts[0], 'create', { type: 'musicquiz' });
      await api(contexts[1], 'join', { code });
      await page.addLocatorHandler(page.locator('#tableMediaConsent[open]'), () =>
        page.locator('#mediaConsentDecline').click(),
      );
      await page.goto(base + '/musicquiz/' + code);
      await page.locator('.mq-banks').waitFor({ timeout: 10000 });
      assert.equal(await page.locator('.mq-bank').count(), 7);
      assert.ok(
        (await page.locator('#controls').innerText()).includes('101') ||
          (await page.locator('#controls').innerText()).includes('93'),
      );
      await peer.addLocatorHandler(peer.locator('#tableMediaConsent[open]'), () =>
        peer.locator('#mediaConsentDecline').click(),
      );
      await peer.goto(base + '/musicquiz/' + code);
      await page.getByRole('button', { name: '開始猜歌', exact: true }).click();
      const initial = await api(contexts[0], 'state?code=' + code),
        djPage = initial.djId === initial.me ? page : peer;
      await djPage.getByRole('button', { name: '全員開始聽前奏', exact: true }).waitFor();
      await page.screenshot({ path: path.join(out, 'pick-' + width + '.png'), fullPage: true });
      await djPage.getByRole('button', { name: '全員開始聽前奏', exact: true }).click();
      await page.locator('#mqAnswer').waitFor();
      await page.locator('#mqAnswer').fill('保留中的草稿');
      await page.locator('#mqArtist').fill('藝人草稿');
      await api(contexts[1], 'action', {
        code,
        action: 'guess',
        roundId: (await api(contexts[1], 'state?code=' + code)).roundId,
        requestId: randomUUID(),
        pass: true,
      });
      await page.waitForTimeout(1200);
      assert.equal(await page.locator('#mqAnswer').inputValue(), '保留中的草稿');
      await page.getByRole('button', { name: '啟用本桌猜歌音樂', exact: true }).click();
      await page.waitForFunction(
        () => window.__mqPlayers.length === 1 && window.__mqPlayers[0].played,
      );
      await page.screenshot({ path: path.join(out, 'intro-' + width + '.png'), fullPage: true });
      await page.getByRole('button', { name: '送出答案', exact: true }).click();
      await djPage.locator('.mq-slot').first().waitFor();
      await page.waitForFunction(() => window.__mqPlayers.length === 2);
      assert.equal(await page.evaluate(() => window.__mqPlayers[0].destroyed), true);
      assert.equal(
        await page.evaluate(
          () =>
            window.__mqPlayers[1].options.playerVars.end -
            window.__mqPlayers[1].options.playerVars.start,
        ),
        30,
      );
      await page.screenshot({ path: path.join(out, 'timeline-' + width + '.png'), fullPage: true });
      await djPage.locator('.mq-slot').first().click();
      let s = await api(contexts[1], 'state?code=' + code);
      await api(s.djId === s.me ? contexts[0] : contexts[1], 'action', {
        code,
        action: 'pass',
        roundId: s.roundId,
        requestId: randomUUID(),
      });
      await page.getByRole('button', { name: '下一首', exact: true }).waitFor();
      await page.screenshot({ path: path.join(out, 'reveal-' + width + '.png'), fullPage: true });
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
        false,
        'horizontal overflow ' + width,
      );
      // Whole-player art must protrude and remain transparent to pointer events.
      await page.evaluate(() => {
        MediaAppearance.set('moon');
        TableMedia.open();
      });
      await page.locator('#tableMedia[open]').waitFor();
      await page.waitForTimeout(100);
      const art = await page.evaluate(() => {
        const d = document.querySelector('#tableMedia'),
          r = d.getBoundingClientRect(),
          nodes = [...d.querySelectorAll('.barrage-art-root>.pointer-events-none')].map((n) => {
            const b = n.getBoundingClientRect();
            return {
              outside: b.top < r.top || b.right > r.right || b.left < r.left || b.bottom > r.bottom,
              pointer: getComputedStyle(n).pointerEvents,
            };
          });
        return { overflow: getComputedStyle(d).overflow, nodes };
      });
      assert.equal(art.overflow, 'visible');
      assert.ok(art.nodes.some((n) => n.outside));
      assert.ok(art.nodes.every((n) => n.pointer === 'none'));
      await page.screenshot({
        path: path.join(out, 'player-moon-' + width + '.png'),
        fullPage: true,
      });
      await page.locator('#mediaClose').click();
      // Two actual authenticated lobby clients receive one escaped frame event.
      await page.goto(base + '/');
      await peer.goto(base + '/');
      await page.locator('[data-lobby-barrage]').waitFor();
      await page.waitForTimeout(700);
      await page.locator('[data-lobby-barrage]').click();
      await page.locator('#lobbyBarrageText').fill('大家好 <img src=x>');
      await page.locator('.lobby-barrage-dialog [type=submit]').click();
      await peer.locator('.lobby-barrage').waitFor({ timeout: 5000 });
      assert.ok((await peer.locator('.lobby-barrage').innerText()).includes('<img src=x>'));
      assert.equal(await peer.locator('.lobby-barrage img').count(), 0);
      await page.screenshot({ path: path.join(out, 'lobby-' + width + '.png'), fullPage: true });
      assert.deepEqual(errors, []);
      evidence.push({
        width,
        errors,
        art,
        twoStage: true,
        draftPreserved: true,
        lobbyPeerReceived: true,
      });
      for (const c of contexts) await c.close();
      console.log('PASS native ' + width);
    }
    fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(evidence, null, 2));
    console.log('Music / lobby / player native checks passed');
  } catch (e) {
    console.error(e);
    if (browser) {
      for (const c of browser.contexts())
        for (const p of c.pages()) {
          console.log((await p.locator('body').innerText()).slice(0, 6000));
          await p.screenshot({
            path: path.join(out, 'failure-' + Date.now() + '.png'),
            fullPage: true,
          });
        }
    }
    process.exitCode = 1;
  } finally {
    await browser?.close();
    await app.close();
  }
})();
