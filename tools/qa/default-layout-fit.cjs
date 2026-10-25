'use strict';
const fs = require('fs'),
  path = require('path'),
  assert = require('assert/strict'),
  { chromium } = require('playwright'),
  { openDatabase } = require('../../src/db'),
  { createAuth } = require('../../src/auth'),
  { createApp } = require('../../src/app');
const mode = process.argv[2] || 'before',
  out = path.resolve(__dirname, '../../work/qa/default-layout-fit');
fs.mkdirSync(out, { recursive: true });
(async () => {
  const root = fs.mkdtempSync(path.join(out, 'data-')),
    dbFile = path.join(root, 'qa.sqlite'),
    db = openDatabase(dbFile),
    auth = createAuth(db),
    password = 'synthetic-layout-password';
  await auth.bootstrap('layout_owner', password);
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
  try {
    const { port } = await app.listen(),
      base = 'http://127.0.0.1:' + port;
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const context = await browser.newContext({
      viewport: { width: 1896, height: 846 },
      colorScheme: 'dark',
      reducedMotion: 'reduce',
    });
    let res = await context.request.post(base + '/api/auth/login', {
      data: { username: 'layout_owner', password },
    });
    assert.equal(res.status(), 200);
    res = await context.request.post(base + '/api/create', { data: { type: 'quacks' } });
    const { code } = await res.json(),
      page = await context.newPage(),
      errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addLocatorHandler(page.locator('#tableMediaConsent[open]'), () =>
      page.locator('#mediaConsentDecline').click(),
    );
    const results = [];
    for (const [width, height] of [
      [1896, 846],
      [1847, 796],
      [1440, 800],
      [1366, 768],
      [1280, 720],
      [1280, 600],
      [1100, 700],
      [1024, 640],
      [960, 600],
      [390, 844],
    ]) {
      await page.setViewportSize({ width, height });
      for (const [name, url] of [
        ['lobby', '/'],
        ['quacks', '/quacks/' + code],
      ]) {
        await page.goto(base + url);
        await page.locator(name === 'lobby' ? '#lobbyStage' : '.ui-room-waiting-layout').waitFor();
        await page.waitForTimeout(250);
        const metrics = await page.evaluate(() => {
          const rect = (s) => {
            const n = document.querySelector(s);
            if (!n || !n.getClientRects().length) return null;
            const r = n.getBoundingClientRect();
            return {
              x: r.x,
              y: r.y,
              width: r.width,
              height: r.height,
              right: r.right,
              bottom: r.bottom,
            };
          };
          return {
            viewport: [innerWidth, innerHeight],
            horizontal: document.documentElement.scrollWidth - innerWidth,
            vertical: document.documentElement.scrollHeight - innerHeight,
            header: rect('[data-site-header]'),
            grid: rect('.tpl-lobby-grid'),
            lobby: rect('.lobby-section'),
            cards: rect('[data-card-carousel]'),
            selected: rect('.game-tile.selected'),
            carouselFooter: rect('.carousel-footer'),
            rooms: rect('.rooms-section'),
            waiting: rect('.ui-room-waiting-layout'),
            roster: rect('.ui-room-roster'),
            center: rect('.q-waiting-center,.tpl-waiting-center'),
            settings: rect('.ui-room-waiting-controls'),
            start: rect('[data-room-action=start]'),
            zoom: getComputedStyle(document.body).zoom,
          };
        });
        await page.screenshot({
          path: path.join(out, mode + '-' + name + '-' + width + 'x' + height + '.png'),
          fullPage: true,
        });
        results.push({ name, width, height, ...metrics });
      }
    }
    if (mode === 'after') {
      for (const m of results) {
        assert.equal(m.zoom, '1', 'browser default zoom');
        assert.ok(m.horizontal <= 1, JSON.stringify(m));
        if (m.width < 960) continue;
        assert.ok(m.vertical <= 1, JSON.stringify(m));
        if (m.name === 'lobby') {
          assert.ok(m.rooms.x >= m.cards.right, 'rooms remain beside cards');
          assert.ok(
            m.selected.y >= m.cards.y - 1 && m.selected.bottom <= m.cards.bottom + 1,
            'selected card fits ' + JSON.stringify(m),
          );
          assert.ok(m.carouselFooter.bottom <= m.height, 'carousel actions fit viewport');
        } else {
          assert.ok(
            m.roster.right < m.center.x && m.center.right < m.settings.x,
            'three waiting columns',
          );
          assert.ok(
            m.start.y >= m.settings.y && m.start.bottom <= m.settings.bottom,
            'primary action visible',
          );
        }
      }
      for (const [width, height] of [
        [1847, 796],
        [1366, 768],
        [1280, 600],
        [960, 600],
      ]) {
        await page.setViewportSize({ width, height });
        await page.goto(base + '/');
        await page.locator('.game-tile.selected').waitFor();
        for (let i = 0; i < 12; i++) {
          const fit = await page.locator('.game-tile.selected').evaluate((n) => {
            const r = n.getBoundingClientRect(),
              a = n.closest('[data-card-carousel]').getBoundingClientRect(),
              f = document.querySelector('.carousel-footer').getBoundingClientRect();
            return {
              name: n.dataset.game || 'market',
              top: r.top,
              bottom: r.bottom,
              areaTop: a.top,
              areaBottom: a.bottom,
              footerTop: f.top,
            };
          });
          assert.ok(
            fit.top >= fit.areaTop - 1 &&
              fit.bottom <= fit.areaBottom + 1 &&
              fit.bottom <= fit.footerTop,
            JSON.stringify({ width, height, ...fit }),
          );
          await page.locator('#carouselNext').click();
        }
        await page.locator('.game-tile.selected').press('Home');
        await page.locator('#openCreateRoom').click();
        await page.locator('#createRoomDialog[open]').waitFor();
        await page.locator('[data-close-create]').click();
      }
      console.log(
        'PASS: 20 viewport pages, 48 card selections, keyboard selection and create-dialog controls',
      );
    }
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(out, mode + '-metrics.json'), JSON.stringify(results, null, 2));
    console.log(
      JSON.stringify(
        results.map(
          ({
            name,
            width,
            height,
            horizontal,
            vertical,
            cards,
            selected,
            carouselFooter,
            rooms,
            waiting,
          }) => ({
            name,
            width,
            height,
            horizontal,
            vertical,
            cards,
            selected,
            carouselFooter,
            rooms,
            waiting,
          }),
        ),
      ),
    );
  } finally {
    await browser?.close();
    await app.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
