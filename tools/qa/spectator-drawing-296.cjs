'use strict';
const assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path');
const { randomUUID } = require('node:crypto');

// Real pointer input, accepted HTTP batches and pixels from the built observer UI.
module.exports = async function drawingQA({
  browser,
  owner,
  watcher,
  page,
  post,
  base,
  password,
  root,
  report,
}) {
  const peer = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  assert.equal(
    (
      await peer.request.post(base + '/api/auth/login', {
        data: { username: 'watch_draw', password },
      })
    ).status(),
    200,
  );
  assert.equal(
    (
      await watcher.request.post(base + '/api/auth/login', {
        data: { username: 'watch_lounge', password },
      })
    ).status(),
    200,
  );
  const json = async (context, route) => (await context.request.get(base + '/api/' + route)).json();
  const send = async (context, route, data) => {
    const response = await context.request.post(base + '/api/' + route, { data });
    assert.equal(response.status(), 200, await response.text());
    return response.json();
  };
  const { code } = await post('create', { type: 'draw', roomName: '觀戰筆跡時序驗收' });
  await send(peer, 'join', { code });
  await post('settings', { code, seconds: 120 });
  await post('start', { code });
  const first = await json(owner, 'state?code=' + code),
    artistContext = first.me === first.presenterId ? owner : peer;
  const artist = await artistContext.newPage();
  await artist.addInitScript(() =>
    localStorage.setItem(
      'bga-entry-intro-settings',
      JSON.stringify({ version: 1, enabled: false }),
    ),
  );
  artist.on('pageerror', (error) => report.errors.push(error.message));
  try {
    await artist.goto(base + '/draw/' + code);
    // Selection is a real authorized player action; candidate content never reaches the observer.
    const selection = await json(artistContext, 'state?code=' + code);
    await send(artistContext, 'action', {
      code,
      action: 'choose',
      questionId: selection.candidates[0].id,
      round: selection.round,
      canvasEpoch: selection.canvasEpoch,
      requestId: randomUUID(),
    });
    await artist.getByText('禁止直接寫出答案', { exact: true }).waitFor();
    await artist.getByRole('button', { name: '略過（本機不載入）', exact: true }).click();
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(base + '/draw/' + code + '?watch=1');
    const visible = page.locator('.vue-spectator-canvas');
    await visible.scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelector('.vue-spectator-canvas')?.width > 0);
    const sample = async (p, selector) =>
      p.evaluate((selector) => {
        const source = document.querySelector(selector),
          probe = document.createElement('canvas');
        probe.width = 256;
        probe.height = 128;
        const ctx = probe.getContext('2d', { willReadFrequently: true });
        window.__spectatorInk = { frames: [], active: true };
        function tick() {
          if (!window.__spectatorInk.active) return;
          ctx.clearRect(0, 0, 256, 128);
          ctx.drawImage(source, 0, 0, 256, 128);
          const bytes = ctx.getImageData(0, 0, 256, 128).data;
          let ink = 0;
          for (let i = 0; i < bytes.length; i += 4)
            if (bytes[i + 3] && Math.min(bytes[i], bytes[i + 1], bytes[i + 2]) < 180) ink++;
          window.__spectatorInk.frames.push({ at: performance.now(), ink });
          requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
      }, selector);
    const stop = async (p) =>
      p.evaluate(() => {
        window.__spectatorInk.active = false;
        return window.__spectatorInk.frames;
      });
    let acknowledgements = 0;
    await artist.route('**/api/draw/stroke', async (route) => {
      const response = await route.fetch();
      await wait(650);
      acknowledgements++;
      await route.fulfill({ response });
    });
    await sample(artist, '#drawCanvas');
    await sample(page, '.vue-spectator-canvas');
    const box = await artist.locator('#drawCanvas').boundingBox();
    assert.ok(box);
    await artist.mouse.move(box.x + box.width * 0.1, box.y + box.height * 0.4);
    await artist.mouse.down();
    for (let i = 1; i <= 75; i++) {
      await artist.mouse.move(
        box.x + box.width * (0.1 + i * 0.009),
        box.y + box.height * (0.4 + Math.sin(i * 0.2) * 0.15),
      );
      await wait(35);
    }
    // Both display real ink before the artist releases the pointer.
    const held = await Promise.all([
      artist.evaluate(() => window.__spectatorInk.frames.at(-1).ink),
      page.evaluate(() => window.__spectatorInk.frames.at(-1).ink),
    ]);
    fs.writeFileSync(
      path.join(root, 'draw-held-debug.json'),
      JSON.stringify({
        held,
        state: await json(artistContext, 'state?code=' + code),
        canonical: await json(artistContext, 'draw/canvas?code=' + code),
      }),
    );
    await artist.screenshot({ path: path.join(root, 'draw-held-artist.png'), fullPage: true });
    await page.screenshot({ path: path.join(root, 'draw-held-observer.png'), fullPage: true });
    assert.ok(
      held.every((n) => n > 0),
      'held pointer remains visible on artist and observer',
    );
    await artist.mouse.up();
    await wait(2200);
    await artist.unroute('**/api/draw/stroke');
    const artistFrames = await stop(artist),
      observerFrames = await stop(page);
    for (const frames of [artistFrames, observerFrames]) {
      const firstInk = frames.findIndex((f) => f.ink > 0);
      assert.ok(firstInk >= 0);
      assert.ok(!frames.slice(firstInk).some((f) => f.ink === 0), 'no white flash after first ink');
    }
    assert.ok(
      new Set(observerFrames.filter((f) => f.ink > 0).map((f) => f.ink)).size > 8,
      'observer has intermediate timed pixels',
    );
    assert.ok(acknowledgements > 0);
    const canonical = await json(artistContext, 'draw/canvas?code=' + code);
    assert.ok(canonical.strokes.length > 1);
    assert.ok(canonical.strokes.every((s) => s.pointTimes));
    const inkDigest = async (p, selector) =>
      p.locator(selector).evaluate((source) => {
        const probe = document.createElement('canvas');
        probe.width = 1024;
        probe.height = 512;
        const ctx = probe.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(source, 0, 0, 1024, 512);
        const bytes = ctx.getImageData(0, 0, 1024, 512).data;
        let ink = 0;
        for (let i = 0; i < bytes.length; i += 4)
          if (bytes[i + 3] && Math.min(bytes[i], bytes[i + 1], bytes[i + 2]) < 180) ink++;
        return ink;
      });
    const finalInk = await Promise.all([
      inkDigest(artist, '#drawCanvas'),
      inkDigest(page, '.vue-spectator-canvas'),
    ]);
    assert.ok(
      Math.abs(finalInk[0] - finalInk[1]) < Math.max(150, finalInk[0] * 0.03),
      'accepted observer geometry matches player geometry',
    );
    await page.screenshot({ path: path.join(root, 'draw-live-observer-1920.png'), fullPage: true });
    const timer = await page.getByRole('timer').innerText();
    await wait(1200);
    assert.notEqual(await page.getByRole('timer').innerText(), timer);
    await page.getByRole('button', { name: '全螢幕：只顯示遊戲區', exact: true }).click();
    await page.waitForFunction(() => document.body.classList.contains('vue-spectator-focus'));
    assert.equal(await page.locator('#site-header-app').isVisible(), false);
    await page.getByRole('button', { name: '退出全螢幕（Esc）', exact: true }).click();
    await page.waitForFunction(() => !document.body.classList.contains('vue-spectator-focus'));
    // Real DOM visibility events exercise resource disposal and resume; this is a
    // controlled fixture, not a claim about OS background scheduling.
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForFunction(() => document.querySelector('.vue-spectator-canvas').width === 0);
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: false });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForFunction(() => document.querySelector('.vue-spectator-canvas').width > 0);
    await wait(100);
    assert.ok((await inkDigest(page, '.vue-spectator-canvas')) > 0, 'resume rebuilds accepted ink');
    await page.reload();
    await visible.scrollIntoViewIfNeeded();
    await wait(200);
    assert.ok((await inkDigest(page, '.vue-spectator-canvas')) > 0);
    const oldEpoch = canonical.canvasEpoch || selection.canvasEpoch;
    const live = await json(artistContext, 'state?code=' + code);
    await send(artistContext, 'action', {
      code,
      action: 'skip',
      round: live.round,
      canvasEpoch: live.canvasEpoch,
    });
    await page.getByText('本輪揭曉', { exact: false }).first().waitFor();
    await post('action', { code, action: 'next' });
    await page.waitForFunction(() =>
      document.querySelector('.vue-spectator-heading')?.textContent.includes('選擇中'),
    );
    await visible.scrollIntoViewIfNeeded();
    await wait(200);
    assert.equal(await inkDigest(page, '.vue-spectator-canvas'), 0, 'new round clears old ink');
    const next = await json(owner, 'state?code=' + code);
    assert.notEqual(next.canvasEpoch, oldEpoch);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: path.join(root, 'draw-new-round-observer-390.png'),
      fullPage: true,
    });
    fs.writeFileSync(
      path.join(root, 'draw-timing.json'),
      JSON.stringify({ held, finalInk, acknowledgements, artistFrames, observerFrames }),
    );
    report.flows.push(
      'real pointer held + delayed ACK + incremental timed observer pixels + no white flash + countdown + focus + controlled hidden/resume + reload + fresh round',
    );
  } finally {
    await artist.close();
    await peer.close();
  }
};
