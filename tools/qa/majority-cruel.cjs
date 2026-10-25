'use strict';
const fs = require('fs'),
  path = require('path'),
  assert = require('assert/strict'),
  { openDatabase } = require('../../src/db'),
  { createAuth } = require('../../src/auth'),
  { createApp } = require('../../src/app'),
  { chromium } = require('playwright');
const out = path.resolve(__dirname, '../../work/qa/majority-cruel');
fs.mkdirSync(out, { recursive: true });
(async () => {
  const root = fs.mkdtempSync(path.join(out, 'data-')),
    dbFile = path.join(root, 'qa.sqlite'),
    db = openDatabase(dbFile);
  try {
    await createAuth(db).bootstrap('cruel_qa', 'synthetic-browser-password');
  } finally {
    db.close();
  }
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
    browser = await chromium.launch({ headless: true, channel: 'msedge' });
    const contexts = await Promise.all(
        Array.from({ length: 4 }, () =>
          browser.newContext({ viewport: { width: 1280, height: 900 } }),
        ),
      ),
      owner = contexts[0],
      peer = contexts[1];
    const post = async (ctx, r, data) => {
      const res = await ctx.request.post(base + '/api/' + r, { data });
      if (!res.ok()) throw Error(r + ' ' + (await res.text()));
      const responseData = await res.json();
      await new Promise((resolve) => setTimeout(resolve, 40));
      return responseData;
    };
    await post(owner, 'auth/login', {
      username: 'cruel_qa',
      password: 'synthetic-browser-password',
    });
    for (let i = 1; i < 4; i++) {
      const invite = await post(owner, 'admin/invites', {});
      await post(contexts[i], 'auth/register', {
        username: 'cruel_peer' + i,
        password: 'synthetic-browser-password',
        confirmPassword: 'synthetic-browser-password',
        invite: invite.code,
      });
    }
    const { code } = await post(owner, 'create', { type: 'majority', roomName: '殘酷二選一驗收' });
    for (const ctx of contexts.slice(1)) await post(ctx, 'join', { code });
    const state = async (ctx) => (await ctx.request.get(base + '/api/state?code=' + code)).json();
    const act = (ctx, name, extra = {}) =>
      state(ctx).then((s) =>
        post(ctx, 'action', { code, action: name, questionId: s.question?.id, ...extra }),
      );
    const errors = [],
      pages = [];
    async function open(ctx, c) {
      const p = await ctx.newPage();
      p.on('pageerror', (e) => errors.push(e.message));
      await p.addLocatorHandler(p.locator('#tableMediaConsent[open]'), () =>
        p.locator('#mediaConsentDecline').click(),
      );
      await p.goto(base + '/majority/' + c);
      return p;
    }
    pages.push(await open(owner, code), await open(peer, code));
    const p = pages[0];
    await p.locator('#majorityMode').selectOption('cruel');
    await p.locator('#cruelRules').waitFor();
    await pages[1].locator('.room-waiting-template h2').filter({ hasText: '殘酷2選1' }).waitFor();
    let s = await state(owner);
    const before = s.cruel.teams[0].members[1],
      other = s.players[2].id;
    await p.locator('.cruel-waiting-content [data-pair-player]').first().selectOption(other);
    await pages[1].waitForFunction(
      (id) =>
        Array.from(document.querySelectorAll('.cruel-team')).some((n) =>
          n.textContent.includes(id),
        ),
      s.players[2].name,
    );
    await p.waitForFunction(
      (id) => document.querySelector('.cruel-waiting-content [data-pair-player]')?.value === id,
      other,
    );
    assert.equal((await state(owner)).cruel.teams[0].members[1], other);
    await p.locator('.cruel-waiting-content [data-pair-player]').first().selectOption(before);
    await p.waitForFunction(
      (id) => document.querySelector('.cruel-waiting-content [data-pair-player]')?.value === id,
      before,
    );
    await p.screenshot({ path: path.join(out, 'teams-setup.png'), fullPage: true });
    await p.getByRole('button', { name: '開始遊戲', exact: true }).click();
    await p.locator('.cruel-answer').first().waitFor();
    assert.equal(await p.locator('.cruel-answer').count(), 2);
    await p.waitForFunction(() =>
      Array.from(document.querySelectorAll('.cruel-option-art')).every(
        (i) => i.complete && i.naturalWidth > 0,
      ),
    );
    await p.screenshot({ path: path.join(out, 'paired-image-question.png'), fullPage: true });
    const layout = await p.evaluate(() => ({
      friends: document.querySelector('.game-roster').getBoundingClientRect().x,
      main: document.querySelector('.play-layout>main').getBoundingClientRect().x,
      chat: document.getElementById('gameSidebar').getBoundingClientRect().x,
    }));
    assert.ok(layout.friends < layout.main && layout.main < layout.chat, JSON.stringify(layout));
    const old = (await state(owner)).question.id;
    await p.locator('[data-do=replace]').click();
    await p.waitForFunction(
      (id) =>
        !document.querySelector('img')?.src.includes(id) &&
        Array.from(document.querySelectorAll('.cruel-option-art')).every(
          (i) => !i.src.includes(id),
        ),
      old,
    );
    assert.notEqual((await state(owner)).question.id, old);
    const stale = await peer.request.post(base + '/api/action', {
      data: { code, action: 'answer', questionId: old, answer: 1 },
    });
    assert.equal(stale.ok(), false);
    await p.locator('[data-choice="0"]').click();
    await p.locator('[data-do=answer]').click();
    assert.equal((await state(peer)).answers, undefined);
    for (let i = 1; i < 4; i++) await act(contexts[i], 'answer', { answer: i < 2 ? 0 : 1 });
    await p.locator('.cruel-round-gains').waitFor();
    assert.deepEqual(
      (await state(owner)).cruel.teams.map((t) => t.score),
      [1, 1],
    );
    await p.screenshot({ path: path.join(out, 'teams-reveal.png'), fullPage: true });
    await act(owner, 'next');
    await p.locator('.cruel-answer').first().waitFor();
    await p.evaluate(() => document.documentElement.setAttribute('data-color-scheme', 'dark'));
    await p.screenshot({ path: path.join(out, 'paired-dark-desktop.png'), fullPage: true });
    await p.setViewportSize({ width: 390, height: 844 });
    await p.waitForTimeout(200);
    assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await p.screenshot({ path: path.join(out, 'paired-mobile.png'), fullPage: true });
    await p.locator('#gameFocusToggle').click();
    assert.equal(await p.evaluate(() => GameFocus.isActive()), true);
    assert.equal(await p.locator('.cruel-answer').count(), 2);
    await p.screenshot({ path: path.join(out, 'paired-mobile-focus.png'), fullPage: true });
    await p.locator('#gameFocusToggle').click();
    for (let n = 2; n <= 10; n++) {
      for (let i = 0; i < 4; i++) await act(contexts[i], 'answer', { answer: i < 2 ? 0 : 1 });
      await act(owner, 'next');
    }
    assert.equal((await state(owner)).phase, 'finished');
    const solo = await post(owner, 'create', { type: 'majority', roomName: '獨自十題驗收' }),
      sp = await open(owner, solo.code);
    await sp.locator('#majorityMode').selectOption('cruel');
    await sp.locator('#cruelRules').selectOption('individual');
    await sp.locator('#cruelScoring').waitFor();
    await sp.getByRole('button', { name: '開始遊戲', exact: true }).click();
    await sp.locator('[data-choice="1"]').click();
    await sp.locator('[data-do=answer]').click();
    await sp.getByText('沒有標準答案，這就是你的偏好。').waitFor();
    const ss = async () => (await owner.request.get(base + '/api/state?code=' + solo.code)).json(),
      sa = async (name, extra = {}) => {
        const s = await ss();
        return post(owner, 'action', {
          code: solo.code,
          action: name,
          questionId: s.question?.id,
          ...extra,
        });
      };
    await sa('next');
    for (let n = 2; n <= 10; n++) {
      await sa('answer', { answer: n % 2 });
      await sa('next');
    }
    await sp.locator('.cruel-recap article').first().waitFor();
    assert.equal(await sp.locator('.cruel-recap article').count(), 10);
    assert.equal((await ss()).players[0].score, 0);
    await sp.screenshot({ path: path.join(out, 'solo-ten-choice-recap.png'), fullPage: true });

    const normal = await post(owner, 'create', { type: 'majority', roomName: '一般同頻回歸' });
    await post(peer, 'join', { code: normal.code });
    await post(contexts[2], 'join', { code: normal.code });
    const np = await open(owner, normal.code);
    await np.getByRole('button', { name: '開始遊戲', exact: true }).click();
    await np.locator('#topic').selectOption('cruel');
    assert.equal(await np.locator('#questionType').inputValue(), 'two');
    await np.locator('[data-do=draw]').click();
    await np.locator('.qcard').first().waitFor();
    assert.equal(await np.locator('.qcard .cruel-option-art').count(), 6);
    await np.locator('.qcard').first().click();
    await np.locator('[data-choice="0"]').waitFor();
    assert.equal(await np.locator('#stage .cruel-option-art').count(), 2);
    await np.waitForTimeout(1000);
    assert.equal(await np.locator('#connection').innerText(), '');
    await np.close();

    const svg = await owner.request.get(base + '/assets/majority-cruel/cruel-two-001-a.svg');
    assert.equal(svg.status(), 200);
    assert.match(svg.headers()['content-type'], /image\/svg/);
    assert.equal(
      (await owner.request.get(base + '/assets/majority-cruel/not-a-card.svg')).status(),
      404,
    );
    assert.deepEqual(errors, []);
    fs.writeFileSync(
      path.join(out, 'evidence.json'),
      JSON.stringify(
        {
          at: new Date().toISOString(),
          fourPlayers: true,
          hostPairing: true,
          secretAnswers: true,
          staleAnswerRejected: true,
          oneSkip: true,
          tenTeamQuestions: true,
          soloTenQuestions: true,
          soloScoreZero: true,
          imageAssets: true,
          mobile390: true,
          focus: true,
          errors,
        },
        null,
        2,
      ),
    );
    console.log(JSON.stringify({ passed: true, errors }));
  } finally {
    await browser?.close();
    await app.close();
  }
})().catch((e) => {
  console.error(e.stack);
  process.exitCode = 1;
});
