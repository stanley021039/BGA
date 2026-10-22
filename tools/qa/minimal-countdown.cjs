const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../..');
const output = path.join(root, 'work/qa-minimal-countdown-193');
fs.mkdirSync(output, { recursive: true });
const { appFixture } = require(path.join(root, 'tests/helpers/app-fixture.cjs'));
const { createAuth } = require(path.join(root, 'src/auth'));
(async () => {
  const clean = [],
    clients = [],
    evidence = [];
  let browser;
  try {
    const password = 'synthetic-minimal-acceptance-only';
    const { base } = process.env.BGA_QA_BASE
      ? { base: process.env.BGA_QA_BASE }
      : await appFixture(
          { after: (f) => clean.push(f) },
          {
            config: {
              frontendEnabled: true,
              frontendRoot: path.join(root, 'frontend/dist'),
              achievementPurpose: 'test',
              marketAutomationEnabled: false,
            },
            seed: async (db) => {
              const auth = createAuth(db);
              await auth.bootstrap('minimal_qa_host', password);
              const owner = db
                .prepare("SELECT * FROM users WHERE username='minimal_qa_host'")
                .get();
              for (const username of ['minimal_qa_one', 'minimal_qa_two'])
                await auth.register(
                  {
                    username,
                    displayName: username,
                    password,
                    confirmPassword: password,
                    invite: auth.createInvite(owner, { days: 1 }).code,
                  },
                  { setHeader() {} },
                );
            },
          },
        );
    browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--mute-audio'] });
    async function post(c, route, data) {
      const r = await c.context.request.post(base + '/api/' + route, { data });
      assert.equal(r.status(), 200, await r.text());
      return r.json();
    }
    async function state(c, code) {
      return (await c.context.request.get(base + '/api/state?code=' + code)).json();
    }
    for (const [i, username] of ['minimal_qa_host', 'minimal_qa_one', 'minimal_qa_two'].entries()) {
      const context = await browser.newContext({
        viewport: { width: i === 2 ? 390 : 1920, height: i === 2 ? 844 : 1080 },
        colorScheme: i === 2 ? 'dark' : 'light',
      });
      const page = await context.newPage();
      const c = { context, page, username, errors: [] };
      clients.push(c);
      page.on('pageerror', (e) => c.errors.push(e.message));
      await page.addInitScript(() => {
        window.__clips = [];
        const Native = window.Audio;
        window.Audio = function (...args) {
          const clip = new Native(...args);
          clip.addEventListener('playing', () =>
            window.__clips.push({ src: clip.src, at: Date.now(), volume: clip.volume }),
          );
          return clip;
        };
        window.Audio.prototype = Native.prototype;
      });
      await post(c, 'auth/login', { username, password });
      await page.addLocatorHandler(page.locator('.vue-media-consent-dialog[open]'), () =>
        page.getByRole('button', { name: '略過（本機不載入）', exact: true }).click(),
      );
    }
    async function scenario(kind) {
      const { code } = await post(clients[0], 'create', { type: 'minimal' });
      for (const c of clients.slice(1)) await post(c, 'join', { code });
      for (const c of clients) {
        await c.page.setViewportSize(
          kind === 'mobile' ? { width: 390, height: 844 } : { width: 1920, height: 1080 },
        );
        await c.page.goto(base + '/minimal/' + code);
        await c.page.locator('.vue-room-waiting-template').waitFor();
        await c.page.locator('.vue-room-waiting-template').click();
        await c.page.evaluate(() =>
          AudioSettings.set('effects', { enabled: true, volume: 0.25 }, { gesture: true }),
        );
      }
      await post(clients[0], 'start', { code });
      for (const c of clients)
        await c.page.locator('.vue-minimal-stage[data-phase="drawing"]').waitFor();
      await clients[0].page.waitForTimeout(2200);
      const states = await Promise.all(clients.map((c) => state(c, code)));
      const guesser = states.findIndex((s) => s.me === s.guesserId);
      const artists = clients.map((_, i) => i).filter((i) => i !== guesser);
      const last = kind === 'mobile' ? (artists.find((i) => i === 2) ?? artists[1]) : artists[1];
      const first = artists.find((i) => i !== last);
      const client = clients[last];
      for (const c of clients) await c.page.evaluate(() => (window.__clips = []));
      if (kind === 'muted')
        await client.page.evaluate(() =>
          AudioSettings.set('effects', { enabled: false }, { gesture: true }),
        );
      const s = states[first];
      const begun = Date.now();
      await post(clients[first], 'action', {
        code,
        action: 'submit',
        roundId: s.roundId,
        requestId: crypto.randomUUID(),
        shapes: [{ kind: 'line', x1: 10, y1: 10, x2: 100, y2: 80 }],
      });
      await client.page.waitForTimeout(kind === 'reload' ? 6200 : kind === 'early' ? 2200 : 11000);
      if (kind === 'reload') {
        await client.page.reload();
        await client.page.locator('.vue-minimal-stage').waitFor();
        await client.page.waitForTimeout(4400);
      }
      if (kind === 'early') {
        const t = await state(client, code);
        await post(client, 'action', {
          code,
          action: 'submit',
          roundId: t.roundId,
          requestId: crypto.randomUUID(),
          shapes: [{ kind: 'circle', cx: 100, cy: 80, r: 25 }],
        });
        await client.page.waitForTimeout(8500);
      }
      const clips = await Promise.all(
        clients.map((c) =>
          c.page.evaluate(() => window.__clips.filter((v) => v.src.includes('turn.wav'))),
        ),
      );
      const result = {
        kind,
        code,
        guesser,
        last,
        clips: clips.map((v) => v.map((x) => ({ ...x, elapsed: x.at - begun }))),
        errors: clients.map((c) => c.errors),
      };
      evidence.push(result);
      fs.writeFileSync(path.join(output, 'evidence.json'), JSON.stringify(evidence, null, 2));
      assert.ok(
        clips.every((v, i) => i === last || v.length === 0),
        JSON.stringify(result),
      );
      if (['desktop', 'mobile'].includes(kind))
        assert.equal(clips[last].length, 6, JSON.stringify(result));
      if (kind === 'early') assert.equal(clips[last].length, 1, JSON.stringify(result));
      if (kind === 'muted') assert.equal(clips[last].length, 0, JSON.stringify(result));
      if (kind === 'reload') assert.ok(clips[last].length <= 3, JSON.stringify(result));
      const box = await client.page.locator('.vue-minimal-stage').boundingBox();
      result.box = box;
      result.overflow = await client.page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      );
      assert.equal(result.overflow, false);
      assert.ok(
        clients.every((c) => !c.errors.length),
        JSON.stringify(result),
      );
      await client.page.screenshot({ path: path.join(output, kind + '.png'), fullPage: true });
      console.log(kind, JSON.stringify(clips.map((v) => v.length)));
    }
    for (const kind of (process.env.BGA_QA_SCENARIOS || 'desktop,mobile,early,reload,muted').split(
      ',',
    ))
      await scenario(kind);
    fs.writeFileSync(path.join(output, 'evidence.json'), JSON.stringify(evidence, null, 2));
  } finally {
    await browser?.close();
    for (const fn of clean.reverse()) await fn();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
