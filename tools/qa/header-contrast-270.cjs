'use strict';
// Standalone browser regression; requires Playwright and a built frontend.
const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict'),
  { randomUUID } = require('node:crypto'),
  { chromium } = require('playwright'),
  { PNG } = require('pngjs'),
  { openDatabase } = require('../../src/db'),
  { createAuth } = require('../../src/auth'),
  { unlockPlaytestRewards } = require('../playtest-rewards.cjs'),
  backgrounds = require('../../public/shared/lobby-backgrounds.json');

function rgba(value) {
  const values = (value.match(/[\d.]+/g) || []).map(Number);
  assert.ok(values.length >= 3, 'unsupported browser colour: ' + value);
  return [...values.slice(0, 3), values[3] ?? 1];
}
function luminance(rgb) {
  return rgb
    .slice(0, 3)
    .map((n) => n / 255)
    .map((n) => (n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4))
    .reduce((sum, n, i) => sum + n * [0.2126, 0.7152, 0.0722][i], 0);
}
function contrast(a, b) {
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
function sample(node, png, ink = rgba(node.ink)) {
  const surface = rgba(node.surface),
    { x, y, width, height } = node.box;
  let minimum = 21;
  for (let py = Math.max(0, Math.floor(y)); py < Math.min(png.height, Math.ceil(y + height)); py++)
    for (
      let px = Math.max(0, Math.floor(x));
      px < Math.min(png.width, Math.ceil(x + width));
      px++
    ) {
      const index = (py * png.width + px) * 4,
        pixel = [...png.data.subarray(index, index + 3)].map(
          (n, i) => n * (1 - surface[3]) + surface[i] * surface[3],
        );
      minimum = Math.min(minimum, contrast(ink, pixel));
    }
  return Number(minimum.toFixed(3));
}

async function main() {
  const output = path.resolve(__dirname, '../../work/qa/header-contrast-270');
  fs.mkdirSync(output, { recursive: true });
  const root = fs.mkdtempSync(path.join(output, 'run-')),
    dbFile = path.join(root, 'qa.sqlite'),
    password = 'synthetic-header-' + randomUUID(),
    db = openDatabase(dbFile);
  fs.writeFileSync(
    path.join(root, '.bga-playtest.json'),
    JSON.stringify({ purpose: 'isolated-playtest' }),
  );
  try {
    await createAuth(db).bootstrap('header_owner', password);
  } finally {
    db.close();
  }
  unlockPlaytestRewards(dbFile);

  // Advance only this isolated lobby's clock to exercise the real background API
  // without waiting nine 30-second cooldowns. Global/server/browser clocks stay real.
  let lobbyOffset = 0;
  const lobbyModule = require('../../src/rooms/lobby'),
    originalLobby = lobbyModule.createLobby;
  lobbyModule.createLobby = (_now, ...args) =>
    originalLobby(() => Date.now() + lobbyOffset, ...args);
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
  lobbyModule.createLobby = originalLobby;
  let browser;
  const report = { root, cases: [], errors: [] };
  try {
    const { port } = await app.listen(),
      base = `http://127.0.0.1:${port}`;
    browser = await chromium.launch({
      channel: process.env.BGA_QA_BROWSER_CHANNEL || 'msedge',
      headless: true,
    });
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      reducedMotion: 'reduce',
    });
    await context.addInitScript(() =>
      localStorage.setItem(
        'bga-entry-intro-settings',
        JSON.stringify({ version: 1, enabled: false }),
      ),
    );
    assert.equal(
      (
        await context.request.post(base + '/api/auth/login', {
          data: { username: 'header_owner', password },
        })
      ).status(),
      200,
    );
    const page = await context.newPage();
    page.on('pageerror', (error) => report.errors.push(error.message));
    await page.goto(base + '/');
    await page.getByRole('button', { name: '遊戲題庫', exact: true }).waitFor();

    async function inspect() {
      const nodes = await page.locator('#site-header-app').evaluate((header) => {
        const nodes = [
          header.querySelector('.vue-site-brand'),
          ...header.querySelectorAll(
            '.vue-site-nav > a, .vue-site-more > button, .vue-site-controls > button, .vue-invitation-button > button',
          ),
        ];
        return nodes
          .filter(Boolean)
          .filter((node) => node.getBoundingClientRect().width > 0)
          .map((node) => {
            const icon = node.classList.contains('ui-icon-button'),
              text = icon ? node.querySelector('svg') : node.querySelector('.vue-button-caption'),
              range = document.createRange();
            if (!text) {
              const child = [...node.childNodes].find(
                (item) => item.nodeType === Node.TEXT_NODE && item.textContent.trim(),
              );
              range.selectNodeContents(child || node);
            }
            const box = (text || range).getBoundingClientRect(),
              css = getComputedStyle(node),
              glyph = getComputedStyle(text || node);
            return {
              label: node.getAttribute('aria-label') || node.textContent.trim(),
              icon,
              ink: css.color,
              surface: css.backgroundColor,
              strokeWidth: glyph.webkitTextStrokeWidth,
              strokeColor: glyph.webkitTextStrokeColor,
              paintOrder: glyph.paintOrder,
              filter: glyph.filter,
              box: { x: box.x, y: box.y, width: box.width, height: box.height },
            };
          });
      });
      const style = await page.locator('#site-header-app').getAttribute('style');
      let png;
      try {
        await page
          .locator('#site-header-app')
          .evaluate((node) => (node.style.visibility = 'hidden'));
        png = PNG.sync.read(await page.screenshot());
      } finally {
        await page.locator('#site-header-app').evaluate((node, style) => {
          if (style === null) node.removeAttribute('style');
          else node.setAttribute('style', style);
        }, style);
      }
      return nodes.map((node) => {
        const rawRatio = sample(node, png),
          required = node.icon ? 3 : 4.5,
          shadow = node.icon && node.filter.match(/rgba?\([^)]+\)/)?.[0],
          outline = shadow ? rgba(shadow) : rgba(node.strokeColor),
          outlined = node.icon
            ? !!shadow
            : parseFloat(node.strokeWidth) >= 1.5 && node.paintOrder.startsWith('stroke'),
          outlineRatio = outlined && outline[3] === 1 ? contrast(rgba(node.ink), outline) : 0,
          assessment =
            rawRatio >= required
              ? 'artwork-or-control-surface'
              : outlineRatio >= required
                ? 'painted-glyph-outline'
                : 'failed';
        return {
          ...node,
          rawRatio,
          outlineRatio: Number(outlineRatio.toFixed(3)),
          ratio:
            assessment === 'painted-glyph-outline' ? Number(outlineRatio.toFixed(3)) : rawRatio,
          required,
          assessment,
        };
      });
    }

    for (const background of backgrounds) {
      lobbyOffset += 31000;
      const changed = await context.request.post(base + '/api/lobby/background', {
        data: { id: background.id },
      });
      assert.equal(changed.status(), 200, await changed.text());
      await page.locator(`.lobby-backdrop[data-background='${background.id}']`).waitFor();
      for (const width of [1920, 390]) {
        await page.setViewportSize({ width, height: width === 390 ? 844 : 1080 });
        for (const theme of ['light', 'dark']) {
          if ((await page.evaluate(() => document.documentElement.dataset.colorScheme)) !== theme)
            await page
              .getByRole('button', {
                name: theme === 'dark' ? '切換為深色模式' : '切換為亮色模式',
                exact: true,
              })
              .click();
          await page.waitForFunction(
            (theme) => document.documentElement.dataset.colorScheme === theme,
            theme,
          );
          await page.mouse.move(0, width === 390 ? 840 : 1070);
          await page.waitForTimeout(200);
          assert.equal(
            await page
              .locator('#site-header-app')
              .evaluate((node) => getComputedStyle(node).backgroundColor),
            'rgba(0, 0, 0, 0)',
          );
          const idle = await inspect(),
            hovered = [];
          if (background.id === 'castle' && width === 1920 && theme === 'light') {
            // Mutation check: the old theme-only foreground must fail on dark artwork.
            const oldTheme = await page.addStyleTag({
              content: '#site-header-app { --stitch-header-ink: var(--stitch-ink) !important; }',
            });
            try {
              await page.waitForTimeout(200);
              assert.ok(
                (await inspect()).some((node) => node.assessment === 'failed'),
                'the regression must detect the original theme-only foreground',
              );
            } finally {
              await oldTheme.evaluate((node) => node.remove());
            }
            await page.waitForTimeout(200);
          }
          for (const label of [
            '遊戲題庫',
            theme === 'dark' ? '切換為亮色模式' : '切換為深色模式',
            '房間邀請',
          ]) {
            const button = page.getByRole('button', { name: label, exact: true });
            await button.hover();
            await page.waitForTimeout(200);
            const values = await inspect();
            hovered.push(values.find((node) => node.label === label));
          }
          await page.mouse.move(0, width === 390 ? 840 : 1070);
          const library = page.getByRole('button', { name: '遊戲題庫', exact: true });
          await library.focus();
          await page.keyboard.press('Tab');
          await page.keyboard.press('Shift+Tab');
          assert.equal(await library.evaluate((node) => node === document.activeElement), true);
          const focus = await library.evaluate((node) => ({
            color: getComputedStyle(node).outlineColor,
            width: getComputedStyle(node).outlineWidth,
            shadow: getComputedStyle(node).boxShadow,
          }));
          assert.ok(parseFloat(focus.width) >= 2);
          const ringBacking = focus.shadow.match(/rgba?\([^)]+\)/)?.[0];
          if (ringBacking) assert.ok(contrast(rgba(focus.color), rgba(ringBacking)) >= 3);
          await library.click();
          await page.locator('#vue-site-library-menu').waitFor({ state: 'visible' });
          await page.keyboard.press('Escape');
          await page.locator('#site-account-button').click();
          await page.locator('#site-account-menu').waitFor({ state: 'visible' });
          await page.keyboard.press('Escape');
          await page.screenshot({
            path: path.join(root, `${background.id}-${width}-${theme}.png`),
            fullPage: true,
          });
          await page.locator('#site-header-app').screenshot({
            path: path.join(root, `${background.id}-${width}-${theme}-header.png`),
          });
          report.cases.push({ background: background.id, width, theme, idle, hovered, focus });
          console.log(
            JSON.stringify({
              background: background.id,
              width,
              theme,
              minimumRaw: Math.min(...idle.map((node) => node.rawRatio)),
              minimumAssessed: Math.min(...idle.map((node) => node.ratio)),
              outlined: idle
                .filter((node) => node.assessment === 'painted-glyph-outline')
                .map((node) => node.label),
              failures: [...idle, ...hovered]
                .filter((node) => node.ratio < node.required)
                .map((node) => ({ label: node.label, ratio: node.ratio })),
            }),
          );
        }
      }
    }
    await page.reload();
    await page.locator(`.lobby-backdrop[data-background='${backgrounds.at(-1).id}']`).waitFor();
    await page.waitForTimeout(200);
    const reloaded = await inspect();
    assert.ok(
      reloaded.every((node) => node.assessment !== 'failed'),
      'reloaded scene retains readable header',
    );
    report.reload = { background: backgrounds.at(-1).id, nodes: reloaded };
    assert.deepEqual(report.errors, []);
    const failures = report.cases.flatMap((entry) =>
      [...entry.idle, ...entry.hovered]
        .filter((node) => node.ratio < node.required)
        .map((node) => ({
          background: entry.background,
          width: entry.width,
          theme: entry.theme,
          label: node.label,
          ratio: node.ratio,
          required: node.required,
        })),
    );
    report.failures = failures;
    fs.writeFileSync(path.join(root, 'report.json'), JSON.stringify(report, null, 2));
    assert.deepEqual(failures, [], 'header contrast below text/icon threshold');
    console.log(
      JSON.stringify({
        root,
        cases: report.cases.length,
        failures: failures.length,
        errors: report.errors.length,
      }),
    );
  } finally {
    await browser?.close();
    await app.close();
  }
}
main().catch((error) => {
  console.error(error.stack);
  process.exitCode = 1;
});
