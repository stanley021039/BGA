// Local UI regression: draws only in memory; never saves or uploads artwork.
const fs = require('fs'),
  path = require('path'),
  assert = require('assert/strict');
const { chromium } = require('playwright');
const base = process.env.UI_LAYOUT_BASE || 'http://127.0.0.1:3152';
if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(base).hostname))
  throw Error('Use a local isolated playtest');
if (!process.env.UI_LAYOUT_CREDENTIALS_FILE) throw Error('Set UI_LAYOUT_CREDENTIALS_FILE');
const credentials = JSON.parse(fs.readFileSync(process.env.UI_LAYOUT_CREDENTIALS_FILE, 'utf8'));
const output = path.resolve(process.env.UI_LAYOUT_OUTPUT || 'work/ui-layout-qa');
fs.mkdirSync(output, { recursive: true });
(async () => {
  const b = await chromium.launch({
    ...(process.platform === 'win32' ? { channel: 'msedge' } : {}),
    headless: true,
  });
  try {
    for (const viewport of [
      { width: 1920, height: 1080 },
      { width: 844, height: 390 },
      { width: 390, height: 844 },
    ]) {
      const c = await b.newContext({
        viewport,
        colorScheme: process.env.UI_LAYOUT_COLOR_SCHEME === 'dark' ? 'dark' : 'light',
        isMobile: viewport.width < 1000,
        hasTouch: viewport.width < 1000,
      });
      await c.addInitScript(() => {
        localStorage.setItem(
          'bga-entry-intro-settings',
          JSON.stringify({ version: 1, enabled: false }),
        );
        localStorage.setItem('ah-motion-settings', JSON.stringify({ version: 1, enabled: false }));
      });
      await c.request.post(base + '/api/auth/login', { data: credentials });
      const p = await c.newPage();
      p.on('response', (r) => {
        if (r.status() >= 400) console.log('HTTP ' + r.status() + ' ' + r.url());
      });
      await p.goto(base + '/');
      await p.waitForTimeout(500);
      await p.goto(base + '/studio');
      await p.locator('#paint-brush.studio-icon-button').waitFor();
      assert.equal(await p.locator('.studio-tools button.studio-icon-button').count(), 13);
      const canvas = p.locator('#paint-canvas');
      await canvas.scrollIntoViewIfNeeded();
      const r = await canvas.boundingBox();
      await p.mouse.move(r.x + r.width * 0.3, r.y + r.height * 0.25);
      await p.mouse.down();
      await p.mouse.move(r.x + r.width * 0.6, r.y + r.height * 0.35, { steps: 8 });
      await p.mouse.up();
      const hasInk = () =>
        canvas.evaluate((el) =>
          el
            .getContext('2d')
            .getImageData(0, 0, el.width, el.height)
            .data.some((v, i) => i % 4 === 3 && v > 0),
        );
      assert.ok(await hasInk());
      const undo = p.locator('#paint-undo');
      await undo.scrollIntoViewIfNeeded();
      await undo.click();
      assert.equal(await hasInk(), false);
      await p.locator('#paint-redo').click();
      assert.ok(await hasInk());
      for (const id of ['paint-clear', 'paint-reset']) {
        const button = p.locator('#' + id);
        await button.scrollIntoViewIfNeeded();
        const box = await button.evaluate((el) => {
          const a = el.getBoundingClientRect(),
            b = el.parentElement.getBoundingClientRect();
          return {
            a: { x: a.x, y: a.y, w: a.width, h: a.height, r: a.right, b: a.bottom },
            p: { x: b.x, y: b.y, r: b.right, b: b.bottom },
          };
        });
        assert.ok(
          box.a.x >= box.p.x - 1 &&
            box.a.r <= box.p.r + 1 &&
            box.a.y >= box.p.y - 1 &&
            box.a.b <= box.p.b + 1,
          JSON.stringify(box),
        );
      }
      assert.equal(
        await p.locator('.studio-tools').evaluate((el) => getComputedStyle(el).flexWrap),
        'nowrap',
      );
      await p.screenshot({ path: path.join(output, 'studio-fixed-' + viewport.width + '.png') });
      console.log(viewport.width + ' editor drawing/undo/redo/clear reachability passed');
      await p.goto(base + '/gacha');
      const preview = p.locator('.gacha-reward-thumbnail[data-kind="attacks"]');
      await preview.waitFor();
      for (const colorScheme of ['light', 'dark']) {
        await p.emulateMedia({ colorScheme });
        await p.waitForTimeout(100);
        const paint = await preview.evaluate((el) => {
          const h = el.querySelector('.ui-heading'),
            r = h.getBoundingClientRect(),
            b = el.getBoundingClientRect();
          return {
            ink: getComputedStyle(h).color,
            bg: getComputedStyle(el).backgroundColor,
            contained:
              r.left >= b.left - 1 &&
              r.right <= b.right + 1 &&
              r.top >= b.top - 1 &&
              r.bottom <= b.bottom + 1,
          };
        });
        const luma = (c) => {
          const values = c
            .match(/[\d.]+/g)
            .slice(0, 3)
            .map(Number)
            .map((n) => {
              n /= 255;
              return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
            });
          return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
        };
        const a = luma(paint.ink),
          z = luma(paint.bg);
        assert.ok((Math.max(a, z) + 0.05) / (Math.min(a, z) + 0.05) >= 4.5, JSON.stringify(paint));
        assert.ok(paint.contained, JSON.stringify(paint));
        console.log(viewport.width + ' ' + colorScheme + ' preview text readable and contained');
      }
      await c.close();
    }
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
