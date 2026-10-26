'use strict';
// Built frontend + Playwright/Edge required. Everything stays inside isolated work/.
const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { chromium } = require('playwright');
const { openDatabase } = require('../../src/db'),
  { createAuth } = require('../../src/auth');
const { unlockPlaytestRewards } = require('../playtest-rewards.cjs');
const { classes, phaseKey, advance, freezeBots } = require('./spectator-fixtures-296.cjs');
const { spectatorView } = require('../../src/rooms/spectator');
const gamePath = (type) => (type === 'thunder' ? 'race' : type);
async function main() {
  const output = path.resolve(__dirname, '../../work/qa/spectators-296');
  fs.mkdirSync(output, { recursive: true });
  const root = fs.mkdtempSync(path.join(output, 'run-')),
    dbFile = path.join(root, 'qa.sqlite'),
    password = 'synthetic-qa-' + randomUUID();
  fs.writeFileSync(
    path.join(root, '.bga-playtest.json'),
    JSON.stringify({ purpose: 'isolated-playtest' }),
  );
  const db = openDatabase(dbFile);
  try {
    await createAuth(db).bootstrap('watch_owner', password);
    const hash = db
      .prepare('SELECT password_hash FROM users WHERE username=?')
      .get('watch_owner').password_hash;
    for (const type of Object.keys(classes))
      db.prepare(
        'INSERT INTO users(id,username,display_name,password_hash,role,created_at) VALUES(?,?,?,?,?,?)',
      ).run(
        randomUUID(),
        'watch_' + type.replaceAll('-', '_'),
        '觀戰測試',
        hash,
        'member',
        new Date().toISOString(),
      );
  } finally {
    db.close();
  }
  unlockPlaytestRewards(dbFile);
  const captured = new Map(),
    restores = [];
  for (const Type of Object.values(classes)) {
    const own = Object.hasOwn(Type.prototype, 'add'),
      original = Type.prototype.add;
    Type.prototype.add = function (...args) {
      captured.set(this.code, this);
      return original.apply(this, args);
    };
    restores.push(() => (own ? (Type.prototype.add = original) : delete Type.prototype.add));
  }
  const { createApp } = require('../../src/app');
  const app = createApp({
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
  let browser;
  const report = {
    root,
    cases: [],
    errors: [],
    writes: [],
    flows: [],
    phaseCoverage: {},
    fixture:
      'real engines and AI commands; temporary deadline holds during screenshots; no production data',
  };
  try {
    const { port } = await app.listen(),
      base = `http://127.0.0.1:${port}`;
    browser = await chromium.launch({
      channel: process.env.BGA_QA_BROWSER_CHANNEL || 'msedge',
      headless: true,
    });
    const owner = await browser.newContext(),
      watcher = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        reducedMotion: 'reduce',
      });
    await watcher.addInitScript(() =>
      localStorage.setItem(
        'bga-entry-intro-settings',
        JSON.stringify({ version: 1, enabled: false }),
      ),
    );
    assert.equal(
      (
        await owner.request.post(base + '/api/auth/login', {
          data: { username: 'watch_owner', password },
        })
      ).status(),
      200,
    );
    const post = async (route, data) => {
      const res = await owner.request.post(base + '/api/' + route, { data });
      assert.equal(res.status(), 200, await res.text());
      return res.json();
    };
    const page = await watcher.newPage();
    page.on('pageerror', (error) => report.errors.push(error.message));
    page.on('request', (request) => {
      if (
        new URL(page.url()).searchParams.get('watch') === '1' &&
        request.url().startsWith(base + '/api/') &&
        request.method() !== 'GET' &&
        request.method() !== 'HEAD'
      )
        report.writes.push({ method: request.method(), path: new URL(request.url()).pathname });
    });
    const watched = [];
    async function inspect(room, key) {
      // Holds only this synthetic room's timers while four screenshots are taken.
      // Original deadlines are restored before advancing through real engine commands.
      const deadline = room.deadline,
        diceAt = room.diceCheck?.readyAt;
      if (Number.isFinite(deadline)) room.deadline = Date.now() + 60000;
      if (Number.isFinite(diceAt)) room.diceCheck.readyAt = Date.now() + 60000;
      try {
        for (const width of [1920, 390]) {
          await page.setViewportSize({ width, height: width === 390 ? 844 : 1080 });
          for (const theme of ['light', 'dark']) {
            freezeBots(room);
            const url = base + '/' + gamePath(room.type || 'poker') + '/' + room.code + '?watch=1';
            await page.goto(url);
            await page
              .getByRole('heading', { name: spectatorView(room).title + '觀戰', exact: true })
              .waitFor();
            if ((await page.evaluate(() => document.documentElement.dataset.colorScheme)) !== theme)
              await page
                .getByRole('button', {
                  name: theme === 'dark' ? '切換為深色模式' : '切換為亮色模式',
                  exact: true,
                })
                .click();
            await page.waitForTimeout(100);
            const layout = await page.evaluate(() => ({
              width: document.documentElement.clientWidth,
              scroll: document.documentElement.scrollWidth,
              overflow: getComputedStyle(document.body).overflowY,
              text: document.querySelector('.vue-room-spectator')?.textContent || '',
            }));
            assert.ok(
              layout.scroll <= layout.width + 1,
              `${room.type || 'poker'} ${key} ${width}: document horizontal overflow ${layout.scroll}/${layout.width}`,
            );
            assert.notEqual(
              layout.overflow,
              'hidden',
              'watch page can scroll independently of the player game layout',
            );
            assert.equal(
              await page
                .getByRole('button', {
                  name: /^(送出|開始遊戲|開始傳遞|下注|下一輪|再玩一局|抽取藥材)$/,
                })
                .count(),
              0,
            );
            assert.ok(
              !layout.text.includes('[object Object]'),
              'public object data is rendered as readable fields',
            );
            await page.screenshot({
              path: path.join(root, `${room.type || 'poker'}-${key}-${width}-${theme}.png`),
              fullPage: true,
            });
            report.cases.push({
              type: room.type || 'poker',
              phase: key,
              width,
              theme,
              widthCheck: layout.scroll,
            });
          }
        }
      } finally {
        room.deadline = deadline;
        if (room.diceCheck && Number.isFinite(diceAt)) room.diceCheck.readyAt = diceAt;
      }
    }
    for (const type of process.env.BGA_QA_DRAW_ONLY ? [] : Object.keys(classes)) {
      // Each game uses an independent synthetic account, retaining real per-account limits.
      assert.equal(
        (
          await watcher.request.post(base + '/api/auth/login', {
            data: { username: 'watch_' + type.replaceAll('-', '_'), password },
          })
        ).status(),
        200,
      );
      const { code } = await post('create', { type });
      if (type !== 'lounge') {
        await post('bot', { code });
        await post('bot', { code });
      }
      const room = captured.get(code);
      assert.ok(room, 'isolated fixture captured the new room');
      if (type === 'musicquiz') room.configure(room.host, { target: 3 });
      if (type === 'gift') room.configure(room.host, { target: 8 });
      if (type === 'majority') room.configure(room.host, { rounds: 3 });
      freezeBots(room);
      const seen = new Set();
      async function capture() {
        const key = phaseKey(room);
        if (!seen.has(key)) {
          await inspect(room, key);
          seen.add(key);
        }
      }
      await capture();
      if (type !== 'lounge') {
        await post('start', { code });
        freezeBots(room);
        await capture();
        let stagnant = 0;
        for (let step = 1; step < 3500 && !['finished', 'showdown'].includes(room.phase); step++) {
          if (advance(room, step)) stagnant = 0;
          else stagnant++;
          assert.ok(stagnant < 5, type + ' has an engine continuation');
          await capture();
        }
        assert.ok(['finished', 'showdown'].includes(room.phase), type + ' reached completion');
      }
      report.phaseCoverage[type] = [...seen];
      watched.push({ type, code, room });
      console.log(
        JSON.stringify({
          type,
          phases: [...seen],
          cases: report.cases.filter((c) => c.type === type).length,
        }),
      );
    }
    if (process.env.BGA_QA_DRAW_ONLY) {
      await require('./spectator-drawing-296.cjs')({
        browser,
        owner,
        watcher,
        page,
        post,
        base,
        password,
        root,
        report,
      });
    } else {
      // Follow a real game switch on the same watch document without mounting its player page.
      const entry = watched.find((e) => e.type === 'telephone'),
        context = { code: entry.code, gameType: 'telephone', gameRevision: 0 };
      await post('rematch', context);
      await page.goto(base + '/telephone/' + entry.code + '?watch=1');
      await page.getByRole('heading', { name: '傳情畫意觀戰', exact: true }).waitFor();
      await post('change-game', { ...context, targetType: 'poker' });
      await page.getByRole('heading', { name: '德州撲克觀戰', exact: true }).waitFor();
      assert.ok(page.url().endsWith('/poker/' + entry.code + '?watch=1'));
      await page.reload();
      await page.getByRole('heading', { name: '德州撲克觀戰', exact: true }).waitFor();
      report.flows.push('same room change + URL + reload retains watch identity');
      const joined = await watcher.request.post(base + '/api/join', { data: { code: entry.code } });
      assert.equal(joined.status(), 200);
      await page.getByText('已入座玩家請使用玩家畫面', { exact: true }).waitFor();
      assert.equal(await page.locator('.vue-spectator-roster').count(), 0);
      report.flows.push('joining revokes observation and clears the old public board');
      // Lobby entry remains reachable for active or full rooms; it must not join a table.
      await page.goto(base + '/');
      await page.getByRole('button', { name: '找一桌加入', exact: true }).click();
      await page.getByRole('link', { name: '觀戰', exact: true }).first().waitFor();
      await page.screenshot({ path: path.join(root, 'lobby-watch-entry-390.png'), fullPage: true });
      report.flows.push('lobby room list exposes watch links');
    }
    assert.deepEqual(report.errors, []);
    assert.deepEqual(report.writes, []);
    report.completed = true;
    console.log(
      JSON.stringify({
        root,
        cases: report.cases.length,
        games: Object.keys(report.phaseCoverage).length,
        errors: report.errors.length,
      }),
    );
  } finally {
    fs.writeFileSync(path.join(root, 'report.json'), JSON.stringify(report, null, 2));
    await browser?.close();
    await app.close();
    for (const restore of restores) restore();
  }
}
main().catch((error) => {
  console.error(error.stack);
  process.exitCode = 1;
});
