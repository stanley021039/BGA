// Isolated two-seat acceptance: real HTTP actions, fixed initial board and dice
// outcomes; engine collision/neighbor/reroll/motion rules remain authoritative.
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');
const { createAuth } = require('../../src/auth');
const { appFixture } = require('../../tests/helpers/app-fixture.cjs');
const { settleDice } = require('../../tests/helpers/race-dice');
const { ThunderRoom, neighbor } = require('../../src/games/thunder');
const directions = require('../../frontend/src/engines/race-directions.js').default;
(async () => {
  const cleanup = [],
    rooms = new Map(),
    originalStart = ThunderRoom.prototype.start,
    originalRoll = ThunderRoom.prototype.roll;
  let browser,
    scenario = 0;
  ThunderRoom.prototype.roll = function (faces) {
    const fixture = rooms.get(this.code);
    if (!fixture) return originalRoll.call(this, faces);
    if (faces.includes('進入車')) return '進入車';
    if (faces.includes('後方'))
      return directions.byIndex(fixture.rolls++ && fixture.direction === 0 ? 4 : fixture.direction)
        .value;
    return originalRoll.call(this, faces);
  };
  ThunderRoom.prototype.start = function () {
    originalStart.call(this);
    settleDice(this);
    this.turn = this.players.findIndex((p) => p.id === this.host);
    this.phase = 'assign';
    this.deadline = Date.now() + 90000;
    for (const tile of this.tiles)
      for (const row of tile.cells)
        for (const cell of row) {
          cell.kind = 'O';
          delete cell.hazard;
        }
    this.cars.forEach((car, i) =>
      Object.assign(car, { x: i % 6, y: 14, dead: false, moved: false, damage: [] }),
    );
    const own = this.cars.find((c) => c.owner === this.host && c.size === 2);
    const other = this.cars.find((c) => c.owner !== this.host && c.size === 0);
    Object.assign(own, { x: 2, y: 4 });
    Object.assign(other, { x: 2, y: 5 });
    this.player(this.host).dice = [3, 1, 2, 6].map((value) => ({ value, used: false }));
    const direction = scenario % 6;
    rooms.set(this.code, { room: this, own, other, direction, rolls: 0 });
  };
  try {
    const password = 'synthetic-race-directions-password';
    const { base } = await appFixture(
      { after: (f) => cleanup.push(f) },
      {
        config: {
          frontendEnabled: true,
          frontendRoot: path.resolve(__dirname, '../../frontend/dist'),
          marketAutomationEnabled: false,
          achievementPurpose: 'test',
        },
        seed: async (db) => {
          const auth = createAuth(db);
          await auth.bootstrap('race_direction_host', password);
          const owner = db
            .prepare("SELECT * FROM users WHERE username='race_direction_host'")
            .get();
          await auth.register(
            {
              username: 'race_direction_peer',
              displayName: '對手',
              password,
              confirmPassword: password,
              invite: auth.createInvite(owner, { days: 1 }).code,
            },
            { setHeader() {} },
          );
        },
      },
    );
    browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
    const clients = [],
      errors = [],
      evidence = [];
    const output = path.resolve(__dirname, '../../work/qa-race-guidance-directions');
    fs.mkdirSync(output, { recursive: true });
    async function post(client, route, data) {
      const r = await client.context.request.post(base + '/api/' + route, { data });
      assert.equal(r.status(), 200, await r.text());
      return r.json();
    }
    async function state(client, code) {
      return (await client.context.request.get(base + '/api/state?code=' + code)).json();
    }
    async function until(read, predicate, timeout = 15000) {
      const end = Date.now() + timeout;
      while (Date.now() < end) {
        const value = await read();
        if (predicate(value)) return value;
        await new Promise((r) => setTimeout(r, 100));
      }
      throw Error('Timed out waiting for race acceptance state');
    }
    for (const [i, username] of ['race_direction_host', 'race_direction_peer'].entries()) {
      const context = await browser.newContext({
        viewport: { width: i ? 390 : 1920, height: i ? 844 : 1080 },
        colorScheme: i ? 'dark' : 'light',
        hasTouch: !!i,
      });
      const page = await context.newPage(),
        client = { context, page };
      clients.push(client);
      page.setDefaultTimeout(15000);
      page.on('pageerror', (error) => errors.push(error.message));
      await page.addLocatorHandler(page.locator('.vue-media-consent-dialog[open]'), () =>
        page.getByRole('button', { name: '略過（本機不載入）', exact: true }).click(),
      );
      await post(client, 'auth/login', { username, password });
    }
    for (scenario = 0; scenario < 7; scenario++) {
      console.log('Starting collision scenario', scenario);
      const { code } = await post(clients[0], 'create', { type: 'thunder' });
      await post(clients[1], 'join', { code });
      for (const client of clients) {
        await client.page.goto(base + '/race/' + code);
        await client.page.locator('.vue-game-main').waitFor();
        await client.page.locator('.vue-game-main').click({ position: { x: 5, y: 5 } });
      }
      await post(clients[0], 'start', { code });
      console.log('Room started', scenario);
      const fixture = rooms.get(code),
        owner = clients[0].page,
        watcher = clients[1].page;
      await owner.bringToFront();
      await owner.locator('.vue-race-cars button').filter({ hasText: '重型' }).click();
      await owner.getByRole('button', { name: '確認出發', exact: true }).click();
      await until(
        () => state(clients[0], code),
        (s) => s.phase === 'move',
      );
      console.log('Movement selected', scenario);
      const route = owner.locator('#track .cell-interactive[data-x="1"][data-y="4"]');
      await route.hover();
      await owner.waitForTimeout(1200);
      assert.equal(await route.locator('title').count(), 0);
      assert.equal(await owner.locator('.race-route-line').count(), 1);
      await owner.mouse.move(20, 80);
      await route.hover();
      await owner.waitForTimeout(600);
      assert.equal(await route.locator('title').count(), 0);
      assert.match(await route.getAttribute('aria-label'), /荒地.*進入花 1 點/);
      assert.ok(
        await owner.locator('#track .cell-interactive[data-x="0"][data-y="0"] title').count(),
      );
      assert.equal(await owner.locator(`#track [data-car="${fixture.other.id}"] title`).count(), 0);
      // The car and its terrain share a hit area and both route to point().
      // Use a real pointer at their common center instead of requiring one SVG
      // subtree to win Playwright's locator actionability check.
      const targetBox = await owner
        .locator('#track .cell-interactive[data-x="2"][data-y="5"]')
        .boundingBox();
      assert.ok(targetBox);
      await owner.mouse.click(
        targetBox.x + targetBox.width / 2,
        targetBox.y + targetBox.height / 2,
      );
      await until(
        () => state(clients[0], code),
        (s) => s.diceCheck?.kind === 'collision',
      );
      const dialog = owner.locator('.race-dice-dialog[open]');
      await dialog.waitFor();
      await dialog.locator('[data-dice-action="rollDice"]').click();
      await owner.locator('.race-dice-dialog[data-stage="result"]').waitFor();
      async function inspect(direction, label) {
        const expected = directions.byIndex(direction),
          current = await state(clients[0], code);
        assert.equal(current.diceCheck.result.faces[1], expected.value);
        for (const [i, client] of clients.entries()) {
          const page = client.page,
            tile = page.locator(`.race-dice-tile[data-direction="${expected.value}"]`);
          await page.bringToFront();
          await tile.waitFor();
          assert.match(await tile.getAttribute('aria-label'), new RegExp('向' + expected.label));
          assert.equal(
            await tile.locator('.race-dice-value-label').textContent(),
            '向' + expected.label,
          );
          assert.match(
            await page.locator('.race-dice-result').textContent(),
            new RegExp('畫面方向：' + expected.arrow),
          );
          const gpu = await tile.locator('.race-dice-face').getAttribute('data-dice-fx');
          const geometry = await page.locator('.race-dice-dialog[open]').evaluate((el) => {
            const r = el.getBoundingClientRect();
            return {
              x: r.x,
              y: r.y,
              width: r.width,
              height: r.height,
              withinViewport:
                r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight,
            };
          });
          assert.equal(geometry.withinViewport, true, 'dice controls fit the actual viewport');
          evidence.push({
            scenario,
            label,
            seat: i,
            value: expected.value,
            labelText: '向' + expected.label,
            gpu: gpu === 'true',
            geometry,
          });
          assert.equal(
            await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
            false,
          );
          await page.screenshot({
            path: path.join(output, `${scenario}-${label}-${i}.png`),
            fullPage: false,
          });
        }
      }
      await inspect(fixture.direction, 'first-result');
      let accepted = fixture.direction;
      if (scenario === 6) {
        await owner.bringToFront();
        await dialog.locator('[data-dice-action="rerollDice"]').click();
        await owner.locator('.race-dice-dialog[data-stage="rolling"]').waitFor();
        await owner.locator('.race-dice-dialog[data-stage="result"]').waitFor();
        await inspect(4, 'rerolled');
        accepted = 4;
      }
      await owner.bringToFront();
      await dialog.locator('[data-dice-action="acceptDice"]').click();
      const end = neighbor(2, 5, accepted);
      await until(
        () => state(clients[0], code),
        (s) =>
          !s.diceCheck &&
          s.cars.some((c) => c.id === fixture.own.id && c.x === end.x && c.y === end.y),
      );
      for (const client of clients) {
        await client.page.bringToFront();
        await until(
          () =>
            client.page.locator(`#track [data-car="${fixture.own.id}"]`).getAttribute('transform'),
          (value) =>
            value === `translate(${48 + end.y * 44 + (end.x % 2) * 22},${81 + end.x * 44})`,
        );
      }
      console.log(
        'Accepted actual collision direction',
        directions.byIndex(accepted).description,
        end,
      );
      for (const client of clients) await post(client, 'leave', { code });
    }
    // Same shared board in the local lesson: keyboard and touch route selection.
    for (const [i, client] of clients.entries()) {
      const page = client.page;
      await page.bringToFront();
      await page.goto(base + '/race?learn=1');
      await page.locator('.vue-race-coach select').selectOption('10');
      await page.getByRole('button', { name: '確認出發', exact: true }).click();
      const destination = page.locator('#track .cell-interactive[data-x="2"][data-y="3"]');
      await destination.waitFor();
      assert.equal(await destination.locator('title').count(), 0);
      if (i) await destination.tap();
      else {
        await destination.focus();
        await page.keyboard.press('Space');
      }
      await until(
        () => page.locator('.vue-race-coach').innerText(),
        (text) => text.includes('你避開岩壁'),
      );
      await page.getByRole('button', { name: '地形圖例', exact: true }).click();
      await page.getByRole('dialog').filter({ hasText: '地形' }).waitFor();
      assert.match(await page.getByRole('dialog').filter({ hasText: '地形' }).innerText(), /岩壁/);
      await page.screenshot({ path: path.join(output, `lesson-terrain-${i}.png`), fullPage: true });
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: '專注全螢幕', exact: true }).click();
      await page.getByRole('button', { name: '退出專注', exact: true }).waitFor();
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: '專注全螢幕', exact: true }).waitFor();
    }
    assert.deepEqual(errors, []);
    fs.writeFileSync(
      path.join(output, 'metrics.json'),
      JSON.stringify({ evidence, errors }, null, 2),
    );
    console.log(
      JSON.stringify({
        directions: 6,
        reroll: true,
        seats: 2,
        keyboard: true,
        touch: true,
        errors,
      }),
    );
  } catch (error) {
    console.error('Acceptance failed before cleanup', error);
    throw error;
  } finally {
    await browser?.close();
    for (const f of cleanup.reverse()) await f();
    ThunderRoom.prototype.start = originalStart;
    ThunderRoom.prototype.roll = originalRoll;
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
