'use strict';
// Run against an isolated test server with a test account that owns all rewards.
// NODE_PATH may point to a separately installed Playwright runtime.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

async function main() {
  const base = process.env.QA_BASE_URL;
  assert.ok(
    base && process.env.QA_USERNAME && process.env.QA_PASSWORD,
    'Set QA_BASE_URL, QA_USERNAME and QA_PASSWORD for an isolated test server',
  );
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.QA_BROWSER_PATH ? { executablePath: process.env.QA_BROWSER_PATH } : {}),
  });
  try {
    const context = await browser.newContext();
    const login = await context.request.post(new URL('/api/auth/login', base).href, {
      data: { username: process.env.QA_USERNAME, password: process.env.QA_PASSWORD },
    });
    assert.equal(login.status(), 200, 'test account can sign in');
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    for (const [width, height] of [
      [1920, 1080],
      [390, 844],
    ]) {
      await page.setViewportSize({ width, height });
      await page.goto(new URL('/settings#attack', base).href);
      const skip = page.getByRole('button', { name: /略過開場/ });
      if (await skip.isVisible()) await skip.click();
      const grid = page.locator('#settings-panel-attack .attack-effect-grid');
      const preview = page.locator('#settings-panel-attack .attack-preview-main');
      await grid.locator('button').last().waitFor();
      for (const theme of ['light', 'dark']) {
        await page.evaluate((value) => window.ColorScheme.set(value), theme);
        await grid.scrollIntoViewIfNeeded();
        await grid.evaluate((element) => {
          element.scrollTop = element.scrollHeight;
        });
        await grid.locator('button').last().click();
        const box = await preview.boundingBox();
        assert.ok(
          box && box.y >= 0 && box.y + box.height <= height + 1,
          `${width}px ${theme}: main preview stays visible after selecting last effect`,
        );
        const cards = await grid.locator('button').evaluateAll((elements) =>
          elements.map((element) => ({
            height: element.clientHeight,
            content: element.scrollHeight,
          })),
        );
        assert.ok(
          cards.every((card) => card.content <= card.height + 1),
          `${width}px ${theme}: cards never compress below their text`,
        );
      }
      await page.goto(new URL('/achievements', base).href);
      const redemption = page.locator('.achievement-redemption');
      await redemption.waitFor();
      assert.equal(await redemption.count(), 1);
      assert.ok(
        await redemption.evaluate(
          (element) =>
            !!(
              element.compareDocumentPosition(document.querySelector('.achievements-panel')) &
              Node.DOCUMENT_POSITION_FOLLOWING
            ),
        ),
        'redemption appears above badges',
      );
      const rewards = page.getByRole('region', { name: '專屬成就外觀獎勵清單', exact: true });
      await rewards.locator('article').last().waitFor();
      const geometry = await rewards.evaluate((element) => ({
        height: element.clientHeight,
        content: element.scrollHeight,
        badgeHeight: document.querySelector('.achievement-groups').clientHeight,
      }));
      assert.equal(geometry.height, geometry.badgeHeight);
      assert.ok(geometry.content > geometry.height);
      await rewards.evaluate((element) => {
        element.scrollTop = element.scrollHeight;
      });
      await rewards.getByRole('button', { name: '套用彈幕框', exact: true }).last().click();
      console.log(
        `${width}px: attack preview, card layout, redemption order and reward scrolling passed`,
      );
    }
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
