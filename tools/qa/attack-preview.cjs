const fs = require('fs'),
  path = require('path'),
  assert = require('assert/strict'),
  { randomUUID } = require('crypto');
const { chromium } = require('playwright');
// Regression probe for #434/#435. Use a local isolated playtest account only.
const base = process.env.ATTACK_PREVIEW_BASE || 'http://127.0.0.1:3148';
if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(base).hostname))
  throw Error('Use a loopback isolated playtest');
if (!process.env.ATTACK_PREVIEW_CREDENTIALS_FILE)
  throw Error('Set ATTACK_PREVIEW_CREDENTIALS_FILE to a local credentials JSON');
const credentials = JSON.parse(
  fs.readFileSync(process.env.ATTACK_PREVIEW_CREDENTIALS_FILE, 'utf8'),
);
const output = path.resolve(process.env.ATTACK_PREVIEW_OUTPUT || 'work/attack-preview-qa');
fs.mkdirSync(output, { recursive: true });
(async () => {
  const b = await chromium.launch({
    ...(process.platform === 'win32' ? { channel: 'msedge' } : {}),
    headless: true,
  });
  const results = [];
  try {
    for (const viewport of [
      { width: 1920, height: 1080 },
      { width: 844, height: 390 },
      { width: 390, height: 844 },
    ]) {
      const c = await b.newContext({
        viewport,
        colorScheme: process.env.ATTACK_PREVIEW_COLOR_SCHEME === 'dark' ? 'dark' : 'light',
        isMobile: viewport.width < 1000,
        hasTouch: viewport.width < 1000,
      });
      assert.ok((await c.request.post(base + '/api/auth/login', { data: credentials })).ok());
      const p = await c.newPage(),
        errors = [];
      p.on('pageerror', (e) => errors.push(e.message));
      await p.goto(base + '/settings#attack');
      const skip = p.getByRole('button', { name: '略過開場動畫', exact: true });
      if (await skip.count()) await skip.click();
      await p.locator('#entry-intro').waitFor({ state: 'hidden' });
      for (const mode of ['一般招式', '大招']) {
        await p.getByRole('tab', { name: mode, exact: true }).click();
        const grid = p.locator('.attack-effect-grid:visible'),
          preview = p.locator('.attack-preview-main:visible');
        await grid.waitFor();
        await grid.scrollIntoViewIfNeeded();
        const geometry = () =>
          p.evaluate(() => {
            const a = document.querySelector(
              '.attack-preview-section:not([style*="display: none"])',
            );
            const v = a.querySelector('.attack-preview-main').getBoundingClientRect(),
              g = a.querySelector('.attack-effect-grid').getBoundingClientRect();
            return {
              previewBottom: v.bottom,
              gridTop: g.top,
              previewY: v.y,
              width: g.width,
              page: scrollY,
              scroll: a.querySelector('.attack-effect-grid').scrollTop,
              scrollbar: getComputedStyle(a.querySelector('.attack-effect-grid')).scrollbarWidth,
            };
          });
        const before = await geometry();
        assert.ok(before.gridTop >= before.previewBottom, JSON.stringify(before));
        const box = await grid.boundingBox();
        await p.mouse.move(
          box.x + box.width / 2,
          Math.max(10, Math.min(viewport.height - 20, box.y + box.height / 2)),
        );
        await p.mouse.wheel(0, 420);
        await p.waitForTimeout(150);
        const after = await geometry();
        assert.ok(after.scroll > before.scroll, JSON.stringify({ before, after }));
        assert.equal(after.width, before.width);
        assert.equal(after.scrollbar, 'thin');
        assert.ok(after.gridTop >= after.previewBottom);
        await grid.focus();
        await p.keyboard.press('End');
        await p.waitForTimeout(500);
        assert.ok(
          await grid.evaluate((el) => el.scrollTop + el.clientHeight >= el.scrollHeight - 2),
          JSON.stringify(
            await grid.evaluate((el) => ({
              top: el.scrollTop,
              height: el.clientHeight,
              total: el.scrollHeight,
              focus: document.activeElement === el,
            })),
          ),
        );
        results.push({ viewport, mode, before, after });
        await p.screenshot({
          path: path.join(
            output,
            'scroll-' + viewport.width + '-' + (mode === '大招' ? 'ultimate' : 'normal') + '.png',
          ),
        });
      }
      if (viewport.width !== 390) {
        await p.goto(base + '/arena?training=1');
        const arenaSkip = p.getByRole('button', { name: '略過開場動畫', exact: true });
        if (await arenaSkip.count()) await arenaSkip.click();
        await p.locator('#entry-intro').waitFor({ state: 'hidden' });
        await p.getByRole('heading', { name: '特效訓練場', exact: true }).waitFor();
        const api = async (data) => {
          const r = await c.request.post(base + '/api/lobby/training?training=1', { data });
          assert.ok(r.ok(), await r.text());
        };
        for (const effect of [
          'susanoo',
          'susanoo_orange',
          'susanoo_alt',
          'susanoo_blue',
          'susanoo_cyan',
        ]) {
          await api({
            action: 'settings',
            q: 'barrage',
            e: 'beam',
            r: effect,
            entrance: 'classic',
          });
          await api({ action: 'reset' });
          await p.waitForTimeout(650);
          assert.ok(
            (
              await c.request.post(base + '/api/lobby/attack?training=1', {
                data: {
                  requestId: randomUUID(),
                  slot: 'r',
                  aspectRatio: viewport.width / viewport.height,
                },
              })
            ).ok(),
          );
          const root = p.locator('.lobby-avatar.is-self .scene-summon');
          await root.locator('picture img').waitFor();
          const imageInfo = await root.locator('picture img').evaluate(async (im) => {
            await im.decode();
            return {
              src: im.currentSrc,
              width: im.clientWidth,
              height: im.clientHeight,
              naturalWidth: im.naturalWidth,
              naturalHeight: im.naturalHeight,
            };
          });
          assert.ok(imageInfo.naturalWidth <= Math.max(128, imageInfo.width * 2));
          assert.ok(imageInfo.naturalHeight <= Math.max(128, imageInfo.height * 2));
          assert.match(imageInfo.src, /[?&]v=/);
          const imageResponse = await c.request.get(imageInfo.src);
          assert.ok(imageResponse.ok());
          assert.match(imageResponse.headers()['cache-control'], /immutable/);
          const protectedArmor = await root.evaluate((el) => {
            const definitions = el.querySelectorAll('.scene-summon-definitions mask');
            const body = [...definitions[0].querySelectorAll('path[fill="white"]')].map((p) =>
              p.getAttribute('d'),
            );
            return {
              body,
              arms: [...definitions]
                .slice(1)
                .map((m) =>
                  [...m.querySelectorAll('path[fill="black"]')].map((p) => p.getAttribute('d')),
                ),
            };
          });
          assert.ok(protectedArmor.body.length >= 3, effect + ' fixed armor regions');
          assert.equal(protectedArmor.arms.length, 2);
          for (const arm of protectedArmor.arms)
            assert.deepEqual(arm, protectedArmor.body, effect + ' opposite armor masks');
          const states = [];
          for (const t of [900, 1000, 2450, 3900]) {
            await root.evaluate((el, t) => {
              for (const a of el.getAnimations({ subtree: true })) {
                a.pause();
                a.currentTime = t + Number(a.effect.getTiming().delay || 0);
              }
            }, t);
            await p.waitForTimeout(25);
            states.push(
              await root.evaluate((el) => ({
                arms: [...el.querySelectorAll('.scene-summon-arm')].map((a) => {
                  const m = new DOMMatrix(getComputedStyle(a).transform);
                  return (Math.atan2(m.b, m.a) * 180) / Math.PI;
                }),
                mask: getComputedStyle(el.querySelector('picture img')).maskImage,
                engraving: !!el.querySelector('.scene-summon-engraving'),
              })),
            );
            if (t === 1000 || t === 900)
              await p.screenshot({
                path: path.join(output, effect + '-' + viewport.width + '-' + t + '.png'),
              });
          }
          assert.equal(states[0].arms.length, 2);
          assert.ok(Math.abs(states[0].arms[0] - states[1].arms[0]) > 80, effect);
          assert.ok(states.every((s) => s.mask !== 'none'));
          assert.equal(states[0].engraving, effect === 'susanoo_blue');
          results.push({ viewport, effect, states });
          await api({ action: 'reset' });
          await root.waitFor({ state: 'hidden' });
        }
        await p.emulateMedia({ reducedMotion: 'reduce' });
        await api({ action: 'reset' });
        assert.equal(await p.locator('.scene-summon').count(), 0);
      }
      assert.deepEqual(errors, []);
      await c.close();
    }
    fs.writeFileSync(path.join(output, 'qa-results.json'), JSON.stringify(results, null, 2));
    console.log(results.length + ' layout and articulated summon cases passed');
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
