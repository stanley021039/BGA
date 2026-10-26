'use strict';
// Native Edge/Audio and real isolated invitation APIs. No production users or audio.
const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto'),
  { chromium } = require('playwright');
const { openDatabase } = require('../../src/db'),
  { createAuth } = require('../../src/auth');
const { unlockPlaytestRewards } = require('../playtest-rewards.cjs');
async function main() {
  const output = path.resolve(__dirname, '../../work/qa/invitation-304');
  fs.mkdirSync(output, { recursive: true });
  const root = fs.mkdtempSync(path.join(output, 'run-')),
    dbFile = path.join(root, 'qa.sqlite'),
    password = 'synthetic-' + randomUUID(),
    guestId = randomUUID();
  fs.writeFileSync(
    path.join(root, '.bga-playtest.json'),
    JSON.stringify({ purpose: 'isolated-playtest' }),
  );
  const db = openDatabase(dbFile);
  try {
    await createAuth(db).bootstrap('invite_owner', password);
    const hash = db
      .prepare('SELECT password_hash FROM users WHERE username=?')
      .get('invite_owner').password_hash;
    db.prepare(
      'INSERT INTO users(id,username,display_name,password_hash,role,created_at) VALUES(?,?,?,?,?,?)',
    ).run(guestId, 'invite_guest', '邀請測試', hash, 'member', new Date().toISOString());
  } finally {
    db.close();
  }
  unlockPlaytestRewards(dbFile);
  const app = require('../../src/app').createApp({
    host: '127.0.0.1',
    port: 0,
    dbFile,
    communityDir: path.join(root, 'community'),
    musicDir: path.join(root, 'music'),
    frontendEnabled: true,
    achievementPurpose: 'test',
    externalSideEffectsEnabled: false,
    marketAutomationEnabled: false,
    githubClient: { configured: false },
  });
  let browser, page;
  const report = {
    root,
    checks: [],
    screenshots: [],
    audio: [],
    errors: [],
    cache: [],
    fixture:
      'isolated accounts; native Audio; controlled DOM hidden/pagehide; no physical speaker assessment',
  };
  try {
    const { port } = await app.listen(),
      base = 'http://127.0.0.1:' + port;
    browser = await chromium.launch({
      channel: 'msedge',
      headless: true,
      ignoreDefaultArgs: ['--mute-audio'],
      args: [
        '--autoplay-policy=user-gesture-required',
        '--disable-features=PreloadMediaEngagementData,MediaEngagementBypassAutoplayPolicies',
      ],
    });
    const owner = await browser.newContext(),
      guest = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    for (const [context, username] of [
      [owner, 'invite_owner'],
      [guest, 'invite_guest'],
    ])
      assert.equal(
        (
          await context.request.post(base + '/api/auth/login', { data: { username, password } })
        ).status(),
        200,
      );
    await guest.addInitScript(() => {
      localStorage.setItem(
        'bga-entry-intro-settings',
        JSON.stringify({ version: 1, enabled: false }),
      );
      const Native = window.Audio,
        tracker = { clips: [], sources: [], events: [] };
      window.__invitationAudio = tracker;
      function Tracked(src) {
        const clip = new Native(src),
          index = tracker.clips.length,
          original = String(src);
        tracker.clips.push(clip);
        tracker.sources.push(original);
        const record = (kind, extra = {}) =>
          tracker.events.push({
            kind,
            original,
            index,
            at: performance.now(),
            volume: clip.volume,
            ...extra,
          });
        for (const kind of ['playing', 'pause', 'ended', 'error'])
          clip.addEventListener(kind, () => record(kind));
        const play = clip.play.bind(clip);
        clip.play = () => {
          const promise = play();
          promise?.catch((error) => record('blocked', { error: error.name }));
          return promise;
        };
        return clip;
      }
      Tracked.prototype = Native.prototype;
      Object.setPrototypeOf(Tracked, Native);
      window.Audio = Tracked;
    });
    const post = async (route, data) => {
      const res = await owner.request.post(base + '/api/' + route, { data });
      assert.equal(res.status(), 200, await res.text());
      return res.json();
    };
    const { code } = await post('create', { type: 'poker', roomName: '邀請音效驗收' });
    const ownerPage = await owner.newPage();
    await ownerPage.goto(base + '/poker/' + code);
    page = await guest.newPage();
    page.on('pageerror', (e) => report.errors.push(e.message));
    const network = await guest.newCDPSession(page),
      requests = new Map();
    await network.send('Network.enable');
    network.on('Network.requestWillBeSent', (e) => requests.set(e.requestId, e.request.url));
    network.on('Network.responseReceived', (e) => {
      if (/\/turn\.(?:wav|mp3)/.test(e.response.url))
        report.cache.push({
          url: new URL(e.response.url).pathname,
          status: e.response.status,
          disk: e.response.fromDiskCache,
          mime: e.response.mimeType,
        });
    });
    network.on('Network.requestServedFromCache', (e) => {
      if (/\/turn\.(?:wav|mp3)/.test(requests.get(e.requestId) || ''))
        report.cache.push({ servedFromCache: true });
    });
    await page.route(base + '/', async (route) => {
      const response = await route.fetch();
      await route.fulfill({
        response,
        headers: { ...response.headers(), 'permissions-policy': 'autoplay=()' },
      });
    });
    // Playwright locator/evaluate calls may carry userGesture. The initial policy
    // check uses CDP with userGesture:false so observation cannot unlock audio.
    const passiveWait = async (expression) => {
      for (let i = 0; i < 200; i++) {
        const value = await network.send('Runtime.evaluate', {
          expression,
          returnByValue: true,
          userGesture: false,
        });
        if (value.result.value) return;
        await page.waitForTimeout(100);
      }
      throw Error('Passive browser condition timed out: ' + expression);
    };
    await page.goto(base + '/');
    await page.unroute(base + '/');
    await passiveWait('!!document.querySelector(".vue-invitation-button button")');
    console.log(JSON.stringify({ phase: 'recipient-ready', root }));
    const audio = () =>
      page.evaluate(() =>
        window.__invitationAudio.events.filter((e) => /\/turn\.(wav|mp3)/.test(e.original)),
      );
    const clips = () =>
      page.evaluate(
        () =>
          window.__invitationAudio.sources.filter((src) => /\/turn\.(wav|mp3)/.test(src)).length,
      );
    const send = () => post('room-invitations', { code, targetId: guestId });
    const first = await send();
    await passiveWait(
      'window.__invitationAudio.events.some(e => e.kind === "blocked" && e.error === "NotAllowedError")',
    );
    assert.equal((await audio()).filter((e) => e.kind === 'blocked').length, 1);
    assert.equal((await send()).id, first.id);
    for (const width of [1920, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1080 });
      for (const theme of ['light', 'dark']) {
        if ((await page.evaluate(() => document.documentElement.dataset.colorScheme)) !== theme)
          await page
            .getByRole('button', {
              name: theme === 'dark' ? '切換為深色模式' : '切換為亮色模式',
              exact: true,
            })
            .click();
        await page.getByRole('button', { name: /^房間邀請/ }).click();
        await page.getByRole('button', { name: '啟用邀請音效', exact: true }).waitFor();
        const content = page.getByRole('dialog', { name: '收到的房間邀請', exact: true });
        await content.getByText(/瀏覽器可能需要先互動/).waitFor();
        assert.ok(await content.getByRole('button', { name: '加入房間', exact: true }).isEnabled());
        assert.ok(await content.getByRole('button', { name: '婉拒', exact: true }).isEnabled());
        for (const label of ['加入房間', '婉拒', '啟用邀請音效', '關閉邀請']) {
          const button = content.getByRole('button', { name: label, exact: true });
          await button.click({ trial: true });
          const bounds = await button.boundingBox();
          assert.ok(
            bounds && bounds.y >= 0 && bounds.y + bounds.height <= (width === 390 ? 844 : 1080),
          );
        }
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        );
        assert.equal(overflow, false);
        const shot = `blocked-${width}-${theme}.png`;
        await page.screenshot({ path: path.join(root, shot), fullPage: true });
        report.screenshots.push(shot);
        await page.getByRole('button', { name: '關閉邀請', exact: true }).click();
      }
    }
    assert.equal(
      (await audio()).filter((e) => e.kind === 'blocked').length,
      1,
      'renders, repeated inbox openings and server duplicate never replay',
    );
    await page.getByRole('button', { name: /^房間邀請/ }).click();
    await page.getByRole('button', { name: '啟用邀請音效', exact: true }).click();
    await page.waitForFunction(() =>
      window.__invitationAudio.events.some(
        (e) => e.kind === 'playing' && /\/turn\./.test(e.original),
      ),
    );
    assert.equal(await page.getByRole('button', { name: '啟用邀請音效', exact: true }).count(), 0);
    const native = (await audio()).find((e) => e.kind === 'playing');
    assert.equal(native.volume, 0.25);
    await page.waitForTimeout(5500);
    assert.equal((await audio()).filter((e) => e.kind === 'playing').length, 1);
    report.checks.push(
      'native autoplay rejection + actionable hint + explicit gesture playing + poll/dialog dedupe',
    );
    await page.getByRole('button', { name: '婉拒', exact: true }).click();
    await page.getByText('目前沒有房間邀請。', { exact: true }).waitFor();
    const second = await send();
    assert.notEqual(second.id, first.id);
    await page.waitForFunction(
      () =>
        window.__invitationAudio.events.filter(
          (e) => e.kind === 'playing' && /\/turn\./.test(e.original),
        ).length === 2,
    );
    report.audio.push(...(await audio()));
    await page.getByRole('button', { name: '加入房間', exact: true }).click();
    await page.waitForURL(base + '/poker/' + code);
    const receiver = await guest.request.get(base + '/api/state?code=' + code);
    assert.equal(receiver.status(), 200);
    assert.equal((await receiver.json()).players.length, 2);
    report.checks.push('decline removes invite, new invite sounds, accept joins a real seat');
    // Stop the room's optional media dialog so invitation buttons remain reachable.
    await page.addLocatorHandler(page.locator('dialog.vue-media-consent-dialog[open]'), () =>
      page.getByRole('button', { name: '略過（本機不載入）', exact: true }).click(),
    );
    const declineMedia = page.getByRole('button', { name: '略過（本機不載入）', exact: true });
    if (await declineMedia.isVisible()) await declineMedia.click();
    const other = await post('create', { type: 'poker', roomName: '靜音與生命週期驗收' });
    const notify = () => post('room-invitations', { code: other.code, targetId: guestId });
    const preferences = async (enabled) =>
      page.evaluate((enabled) => {
        const value = JSON.parse(localStorage.getItem('ah-audio-settings'));
        value.effects.enabled = enabled;
        localStorage.setItem('ah-audio-settings', JSON.stringify(value));
        window.dispatchEvent(new StorageEvent('storage', { key: 'ah-audio-settings' }));
      }, enabled);
    await preferences(false);
    const beforeMuted = await clips();
    await notify();
    await page.getByRole('button', { name: /^房間邀請（1）/ }).waitFor();
    assert.equal(await clips(), beforeMuted);
    await preferences(true);
    await page.waitForTimeout(5500);
    assert.equal(await clips(), beforeMuted);
    await page.getByRole('button', { name: /^房間邀請/ }).click();
    await page.getByRole('button', { name: '婉拒', exact: true }).click();
    await page.getByText('目前沒有房間邀請。', { exact: true }).waitFor();
    report.checks.push('inside-game mute is silent and unmute never replays a received invite');
    // Controlled hidden state covers the actual document listener without relying on
    // headless OS tab scheduling. Room invitation hints still perform real GETs.
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    const beforeHidden = await clips();
    await notify();
    await page.waitForTimeout(600);
    await page.evaluate(() =>
      window.dispatchEvent(new CustomEvent('bga:room-event', { detail: { kind: 'invitations' } })),
    );
    await page.waitForTimeout(300);
    assert.equal(await clips(), beforeHidden);
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: false });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.getByRole('button', { name: /^房間邀請（1）/ }).waitFor();
    await page.waitForTimeout(300);
    assert.equal(await clips(), beforeHidden);
    report.checks.push('hidden receipt does not play or queue audio');
    await page.getByRole('button', { name: '婉拒', exact: true }).click();
    await page.getByText('目前沒有房間邀請。', { exact: true }).waitFor();
    await page.evaluate(() => {
      window.__hideOnInvitation = true;
      const Native = window.Audio;
      window.Audio = function (src) {
        const clip = new Native(src);
        if (/\/turn\./.test(src))
          clip.addEventListener('playing', () => {
            if (window.__hideOnInvitation) {
              Object.defineProperty(document, 'hidden', { configurable: true, value: true });
              document.dispatchEvent(new Event('visibilitychange'));
            }
          });
        return clip;
      };
      window.Audio.prototype = Native.prototype;
    });
    await notify();
    await page.waitForFunction(() => document.hidden);
    assert.ok(
      await page.evaluate(() => window.__invitationAudio.clips.every((clip) => clip.paused)),
    );
    await page.evaluate(() => {
      window.__hideOnInvitation = false;
      Object.defineProperty(document, 'hidden', { configurable: true, value: false });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    report.checks.push('hiding during native playing immediately stops the clip');
    report.audio.push(...(await audio()));
    const eventsBeforeReload = (await audio()).filter((e) => e.kind === 'playing').length;
    await page.reload();
    await page.getByRole('button', { name: /^房間邀請（1）/ }).waitFor();
    await page.waitForTimeout(5500);
    assert.deepEqual(await audio(), []);
    report.checks.push('reload retains pending invitation and plays no duplicate');
    // Warm retrieval keeps the existing ETag and compressed MP3 mapping.
    const cold = await guest.request.get(base + '/assets/game-sounds/turn.wav');
    assert.equal(cold.status(), 200);
    assert.equal(cold.headers()['content-type'], 'audio/mpeg');
    assert.equal(
      (
        await guest.request.get(base + '/assets/game-sounds/turn.wav', {
          headers: { 'If-None-Match': cold.headers().etag },
        })
      ).status(),
      304,
    );
    report.checks.push(
      'existing compressed clip decodes natively and retains conditional 304 cache',
    );
    assert.deepEqual(report.errors, []);
    report.completed = true;
    if (process.env.BGA_QA_PREVIEW === '1') {
      fs.writeFileSync(
        path.resolve(__dirname, '../../work/invitation-304-preview.json'),
        JSON.stringify({
          base,
          root,
          username: 'invite_guest',
          hostUsername: 'invite_owner',
          password,
          code: other.code,
        }),
      );
    }
    console.log(
      JSON.stringify({
        root,
        checks: report.checks.length,
        screenshots: report.screenshots.length,
        nativePlayingBeforeReload: eventsBeforeReload,
        preview: process.env.BGA_QA_PREVIEW === '1' ? base : undefined,
      }),
    );
  } catch (error) {
    report.failure = error.stack;
    if (page) {
      report.diagnostic = await page
        .evaluate(() => ({
          activation: navigator.userActivation?.hasBeenActive,
          events: window.__invitationAudio?.events,
          clips: window.__invitationAudio?.clips.map((clip) => ({
            src: clip.src,
            paused: clip.paused,
            muted: clip.muted,
            volume: clip.volume,
          })),
        }))
        .catch(() => null);
      await page
        .screenshot({ path: path.join(root, 'failure.png'), fullPage: true })
        .catch(() => {});
    }
    throw error;
  } finally {
    fs.writeFileSync(path.join(root, 'report.json'), JSON.stringify(report, null, 2));
    await browser?.close();
    if (!report.completed || process.env.BGA_QA_PREVIEW !== '1') await app.close();
  }
}
main().catch((error) => {
  console.error(error.stack);
  process.exitCode = 1;
});
