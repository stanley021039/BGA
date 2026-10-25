'use strict';
const fs = require('fs'),
  path = require('path'),
  assert = require('assert/strict'),
  { randomUUID } = require('crypto'),
  { chromium } = require('playwright');
const { WITCHES } = require('../../src/games/quacks-catalog');
const { openDatabase } = require('../../src/db'),
  { createAuth } = require('../../src/auth'),
  { createApp } = require('../../src/app'),
  { QuacksRoom } = require('../../src/games/quacks'),
  { FORTUNES } = require('../../src/games/quacks-expansion-fortunes');
const out = path.resolve(__dirname, '../../work/qa/quacks-choice-media-fit');
fs.mkdirSync(out, { recursive: true });
(async () => {
  const root = fs.mkdtempSync(path.join(out, 'data-')),
    dbFile = path.join(root, 'qa.sqlite'),
    db = openDatabase(dbFile),
    auth = createAuth(db),
    password = 'synthetic-choice-qa-password';
  await auth.bootstrap('choice_owner', password);
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
    const context = await browser.newContext(),
      page = await context.newPage(),
      errors = [];
    page.on('pageerror', (e) => {
      errors.push(e.message);
      console.log('PAGEERROR', e.message);
    });
    const api = async (route, data) => {
      const res = await context.request[data === undefined ? 'get' : 'post'](
        base + '/api/' + route,
        data === undefined ? {} : { data },
      );
      assert.equal(res.status(), 200, route + ' ' + (await res.text()));
      return res.json();
    };
    await api('auth/login', { username: 'choice_owner', password });
    const { code } = await api('create', { type: 'quacks', witches: true, alchemists: true });
    await api('bot', { code });
    await api('start', { code });
    const original = await api('state?code=' + code);
    let fixture;
    const reset = (stage = 'drawing') => {
      fixture = structuredClone(original);
      fixture.version += 10000;
      fixture.phase = stage === 'drawing' ? 'brewing' : 'settlement';
      fixture.stage = stage;
      fixture.round = 7;
      fixture.serverNow = Date.now();
      fixture.mine.pending = null;
      fixture.mine.waitingEffect = false;
      fixture.mine.reserve = [];
      fixture.mine.canDraw = true;
      fixture.mine.alchemy = {
        ...fixture.mine.alchemy,
        patientId: fixture.patients[0].id,
        essence: 2,
        max: 2,
        confirmed: false,
        calculation: { colors: 2, exactSeven: 0, explosions: 0, locoweed: 0, fortune: 0 },
        pool: [],
      };
      fixture.recipes.find((p) => p.id === fixture.me).alchemy = {
        patientId: fixture.patients[0].id,
        essence: 2,
        confirmed: false,
      };
    };
    await page.route('**/api/state?*', (route) => route.fulfill({ json: fixture }));
    const submissions = [];
    await page.route('**/api/action', async (route) => {
      const command = route.request().postDataJSON();
      submissions.push(command);
      if (command.action === 'free-witch') {
        fixture.mine.visitorUsed = true;
        fixture.mine.canVisit = false;
        fixture.mine.budget *= 2;
      }
      fixture.version++;
      await route.fulfill({ json: fixture });
    });
    await page.addLocatorHandler(page.locator('#tableMediaConsent[open]'), () =>
      page.locator('#mediaConsentDecline').click(),
    );
    const r = new QuacksRoom('ABCDEF', 'choice', () => 0),
      a = r.add('A');
    r.add('B');
    r.configure(a.id, { witches: true });
    r.start();
    r.fortune = FORTUNES.find((f) => f.id === 'witch-trade');
    r.applyExpansionFortune();
    const trade = r.view(a.id).mine.pending;
    for (const [width, height] of [
      [1920, 1080],
      [1440, 900],
      [1280, 720],
      [1024, 640],
      [390, 844],
    ]) {
      await page.setViewportSize({ width, height });
      reset();
      fixture.mine.pending = trade;
      await page.goto(base + '/quacks/' + code);
      await page.locator('.q-choice-coin').first().waitFor();
      assert.equal(await page.locator('.q-choice-ingredient').count(), 0);
      await page.locator('.q-choice-coin').first().click();
      await page.locator('.q-choice-ingredient').first().waitFor();
      assert.equal(submissions.length, 0);
      const first = page.locator('.q-choice-ingredient').first();
      assert.equal(await first.locator('.ingredient-token').count(), 1);
      const optionId = (await first.getAttribute('data-quacks-action-key')).split(':').at(-1);
      fixture.version++;
      await page.waitForTimeout(1450);
      assert.equal(await page.locator('.q-choice-coin').count(), 0);
      await first.click();
      await page.waitForTimeout(150);
      assert.equal(submissions.at(-1).optionId, optionId);
      submissions.length = 0;
      await page.screenshot({ path: path.join(out, 'trade-' + width + '.png'), fullPage: true });
      reset();
      a.pending = [];
      a.pot = [r.chip('green', 1), r.chip('blue', 2), r.chip('orange', 1), r.chip('locoweed', 1)];
      r.selectChip(a, '愚人草：收回一片彩色藥材', a.pot, 'remove');
      fixture.mine.pending = r.view(a.id).mine.pending;
      await page.reload();
      await page.locator('.q-choice-ingredient').first().waitFor();
      assert.equal(await page.locator('.q-choice-ingredient .ingredient-token').count(), 4);
      assert.equal(await page.locator('#qRecent').count(), 0);
      assert.equal(await page.locator('#gameFocusToggle').isVisible(), false);
      if (width === 1440) {
        await page.locator('#qMobileMenu summary').click();
        await page.getByRole('button', { name: '專注全螢幕', exact: true }).click();
        assert.equal(
          await page.locator('body').evaluate((n) => n.classList.contains('game-focus-active')),
          true,
        );
        assert.equal(await page.locator('#gameFocusToggle').isVisible(), true);
        await page.keyboard.press('Escape');
        assert.equal(
          await page.locator('body').evaluate((n) => n.classList.contains('game-focus-active')),
          false,
        );
      }
      await page.screenshot({ path: path.join(out, 'locoweed-' + width + '.png'), fullPage: true });

      reset();
      fixture.mine.pending = trade;
      const own = fixture.recipes.find((p) => p.id === fixture.me),
        peer = fixture.recipes.find((p) => p.id !== fixture.me);
      for (const [index, p] of fixture.recipes.entries())
        Object.assign(p, {
          hidden: false,
          droplet: index ? 0 : 11,
          startPosition: index ? 4 : 13,
          position: index ? 8 : 16,
          white: 0,
          threshold: 7,
          pot: [{ id: 'visible-' + index, color: 'orange', value: 1, position: index ? 8 : 16 }],
          overflow: [],
          alchemy: { patientId: fixture.patients[0].id, essence: 2 },
        });
      await page.reload();
      await page.locator('.q-choice-coin').first().waitFor();
      await page.locator('#qInspectPot').click();
      await page.locator('#qReturnStage').waitFor();
      assert.equal(await page.locator('#qStageOverlay').isVisible(), false);
      await page.locator('#qPotPatient').hover();
      assert.ok((await page.locator('#potTooltip').innerText()).includes(fixture.patients[0].text));
      await page.locator('#potTabs button').nth(1).click();
      assert.equal(
        await page.locator('#cauldron .pot-droplet').getAttribute('data-position'),
        String(peer.droplet),
      );
      assert.match(
        await page.locator('#qPotMetrics').innerText(),
        new RegExp('水滴 ' + peer.droplet),
      );
      await page.locator('#potTabs button').first().click();
      assert.equal(
        await page.locator('#cauldron .pot-droplet').getAttribute('data-position'),
        String(own.droplet),
      );
      await page.screenshot({
        path: path.join(out, 'patient-inspect-' + width + '.png'),
        fullPage: true,
      });
      for (let repeat = 0; repeat < 3; repeat++) {
        await page.locator('#qReturnStage').click();
        assert.equal(await page.locator('.q-choice-coin').count(), 3);
        await page.locator('#qInspectPot').click();
      }
      await page.locator('#qReturnStage').click();
      assert.equal(submissions.length, 0);
      assert.equal(await page.locator('#qAlchemyTool').count(), 1);
      assert.ok(
        (await page.locator('#qAlchemyTool').getAttribute('aria-label')).includes('特效藥'),
      );
      reset();
      fixture.phase = 'between';
      fixture.stage = null;
      await page.reload();
      await page.locator('#qIntermissionScore>svg').waitFor();
      assert.equal(await page.locator('#qStageTitle').innerText(), '環形計分板');
      assert.equal(await page.locator('.q-round-announcement').count(), 0);
      await page.screenshot({
        path: path.join(out, 'ring-intermission-' + width + '.png'),
        fullPage: true,
      });
      evidence.push({
        width,
        peekReturn: true,
        patientEffect: true,
        playerMarkerIdentity: true,
        scoreboard: true,
      });

      reset();
      const current = fixture.recipes.find((p) => p.id === fixture.me);
      Object.assign(current, {
        position: 0,
        white: 0,
        threshold: 7,
        pot: [],
        overflow: [],
        droplet: 0,
        startPosition: 0,
      });
      await page.reload();
      await page.locator('.draw-action').waitFor();
      current.pot = [
        { id: 'flight-fixture', color: 'orange', value: 1, position: 1, fromPosition: 0 },
      ];
      current.position = 1;
      fixture.version++;
      await page.locator('.q-flight').first().waitFor();
      await page.locator('#potTabs button').nth(1).click();
      assert.equal(
        await page.locator('.q-flight').count(),
        0,
        'switching pots cancels the previous player flight',
      );
      reset('shopping');
      fixture.mine.canBuy = true;
      fixture.mine.budget = 50;
      fixture.mine.ready = false;
      fixture.market.turnPlayerId = fixture.recipes.find((p) => p.id !== fixture.me).id;
      await page.reload();
      await page.locator('.q-shop-turn').waitFor();
      assert.ok((await page.locator('.q-shop-turn').innerText()).includes('請稍候'));
      assert.ok((await page.locator('.ingredient-purchase').count()) > 0);
      for (const b of await page.locator('.ingredient-purchase').all())
        assert.equal(await b.isDisabled(), true);
      fixture.market.turnPlayerId = fixture.me;
      fixture.market.stock['orange:1'] = 0;
      fixture.version++;
      await page.waitForFunction(() =>
        document.querySelector('.q-shop-turn')?.textContent.includes('輪到你'),
      );
      assert.equal(
        await page.locator('[data-purchase-color=orange][data-purchase-value="1"]').isDisabled(),
        true,
      );
      await page.screenshot({
        path: path.join(out, 'market-turn-' + width + '.png'),
        fullPage: true,
      });
      evidence.push({ width, potFlightsCancelled: true, marketTurn: true, soldOutDisabled: true });

      reset('essence');
      await page.reload();
      await page.locator('#qStageContent #alchemy .essence-flask').waitFor();
      const fit = await page.locator('#qStageContent').evaluate((n) => {
        const a = n.querySelector('#alchemy'),
          b = a.querySelector('button'),
          r = n.getBoundingClientRect(),
          br = b.getBoundingClientRect();
        return {
          stageClient: n.clientHeight,
          stageScroll: n.scrollHeight,
          panelClient: a.clientHeight,
          panelScroll: a.scrollHeight,
          buttonTop: br.top,
          buttonBottom: br.bottom,
          stageTop: r.top,
          stageBottom: r.bottom,
          flask: a.querySelector('.essence-flask').getBoundingClientRect().height,
          flaskCenterOffset: Math.abs(
            (a.querySelector('.essence-flask').getBoundingClientRect().left +
              a.querySelector('.essence-flask').getBoundingClientRect().right -
              2 * r.left -
              n.clientWidth) /
              2,
          ),
          buttonCenterOffset: Math.abs((br.left + br.right - 2 * r.left - n.clientWidth) / 2),
          buttonHeight: br.height,
          buttonWidth: br.width,
          buttonFont: parseFloat(getComputedStyle(b).fontSize),
        };
      });
      assert.ok(
        fit.flaskCenterOffset <= 2 && fit.buttonCenterOffset <= 2,
        JSON.stringify({ width, fit }),
      );
      assert.ok(
        fit.buttonHeight >= 44 && fit.buttonHeight <= 46 && fit.buttonFont <= 16.1,
        JSON.stringify({ width, fit }),
      );
      assert.ok(fit.panelScroll <= fit.panelClient + 2, JSON.stringify({ width, fit }));
      assert.ok(fit.stageScroll <= fit.stageClient + 2, JSON.stringify({ width, fit }));
      assert.ok(
        fit.buttonTop >= fit.stageTop - 1 && fit.buttonBottom <= fit.stageBottom + 1,
        JSON.stringify({ width, fit }),
      );
      await page.screenshot({ path: path.join(out, 'essence-' + width + '.png'), fullPage: true });
      reset();
      const p = fixture.recipes.find((p) => p.id === fixture.me);
      p.position = 52;
      p.pot = [{ color: 'orange', value: 6, position: 52 }];
      p.overflow = [];
      await page.reload();
      await page.locator('#cauldron .overflow-basin').waitFor();
      assert.equal(await page.locator('#cauldron .overflow-chip').count(), 0);
      for (let i = 1; i <= 3; i++) {
        p.overflow.push({ color: i === 2 ? 'blue' : 'green', value: 2, effectValue: 2 });
        fixture.version++;
        await page.waitForFunction(
          (n) => document.querySelectorAll('#cauldron .overflow-chip').length === n,
          i,
        );
      }
      assert.match(
        await page.locator('#cauldron .overflow-basin').getAttribute('aria-label'),
        /3 片，3 分/,
      );
      await page.screenshot({ path: path.join(out, 'overflow-' + width + '.png'), fullPage: true });
      evidence.push({
        width,
        height,
        coinFirst: true,
        locoweedIcons: 4,
        noRecentTray: true,
        noFloatingFocus: true,
        fit,
        continuousOverflow: 3,
      });
    }
    for (const width of [1440, 390, 320]) {
      await page.emulateMedia({ colorScheme: width === 1440 ? 'dark' : 'light' });
      await page.setViewportSize({ width, height: 900 });
      reset('shopping');
      fixture.fortune = FORTUNES.find((f) => f.id === 'witch-visit');
      fixture.visitingWitch = { color: 'copper', ...WITCHES.copper.find((w) => w.id === 'double') };
      fixture.mine.canVisit = true;
      fixture.mine.visitorUsed = false;
      fixture.mine.canBuy = true;
      fixture.mine.canScore = true;
      fixture.mine.budget = 9;
      const coins = structuredClone(fixture.mine.coins);
      submissions.length = 0;
      await page.reload();
      const trigger = page.locator('.q-visitor-trigger');
      await trigger.waitFor();
      assert.equal(await trigger.locator('.q-visitor-free').count(), 0);
      await trigger.hover();
      await page.locator('#potTooltip').waitFor();
      assert.ok(
        (await page.locator('#potTooltip').innerText()).includes(fixture.visitingWitch.text),
      );
      await trigger.click();
      let card = page.locator('.q-visiting-witch-detail');
      await card.waitFor();
      assert.equal(
        await card.locator('.q-visitor-effect').textContent(),
        fixture.visitingWitch.text,
      );
      assert.match(await card.locator('.q-visitor-status').textContent(), /現在可使用/);
      assert.equal(await page.locator('.q-witch-detail').count(), 4);
      await page.screenshot({
        path: path.join(out, 'visiting-witch-' + width + '.png'),
        fullPage: true,
      });
      await card.locator('[data-visitor-command]').click();
      await page.waitForTimeout(150);
      assert.equal(submissions.length, 1);
      assert.equal(submissions[0].action, 'free-witch');
      assert.deepEqual(fixture.mine.coins, coins);
      await trigger.click();
      card = page.locator('.q-visiting-witch-detail');
      await card.waitFor();
      assert.match(await card.locator('.q-visitor-status').textContent(), /本輪已使用/);
      assert.equal(await card.locator('[data-visitor-command]').isDisabled(), true);
      fixture.fortune = { id: 'none', name: '一般占卜' };
      fixture.version++;
      await page.waitForTimeout(1500);
      assert.match(await card.locator('.q-visitor-status').textContent(), /已離開/);
      assert.equal(await card.locator('[data-visitor-command]').isDisabled(), true);
      await page.keyboard.press('Escape');
      await page.locator('#qMobileMenu summary').click();
      await page.getByRole('button', { name: '草藥女巫說明', exact: true }).click();
      await page.locator('.q-witch-detail').first().waitFor();
      assert.equal(await page.locator('.q-visiting-witch-detail').count(), 0);
      assert.equal(await page.locator('.q-visitor-trigger').count(), 0);
      assert.equal(await page.locator('.q-witch-detail').count(), 3);
      await page.keyboard.press('Escape');
      evidence.push({
        width,
        visitorEffectHint: true,
        visitorInDetails: true,
        usedStatus: true,
        coinUnchanged: true,
        singleCommand: true,
        staleVisitorDisabled: true,
        noVisitorCardWhenAbsent: true,
      });
    }
    const drink = await page.evaluate(async () => {
      const c = new AudioContext(),
        data = await (await fetch('/assets/game-sounds/quacks-drink-real.mp3')).arrayBuffer(),
        buffer = await c.decodeAudioData(data);
      await c.close();
      return { duration: buffer.duration, channels: buffer.numberOfChannels };
    });
    assert.ok(drink.duration > 2.4 && drink.duration < 2.8);
    evidence.push({ realDrinkDecoded: drink });
    assert.deepEqual(errors, []);
    fs.writeFileSync(
      path.join(out, 'evidence.json'),
      JSON.stringify({ checks: evidence, errors }, null, 2),
    );
    console.log(JSON.stringify(evidence));
    await context.close();
  } catch (e) {
    console.error(e);
    if (browser) {
      const p = browser.contexts()[0]?.pages()[0];
      await p?.screenshot({ path: path.join(out, 'failure.png'), fullPage: true });
    }
    throw e;
  } finally {
    await browser?.close();
    await app.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
