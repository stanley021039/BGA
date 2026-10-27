'use strict';
const { chromium } = require('playwright'),
  { appFixture } = require('../../tests/helpers/app-fixture.cjs'),
  { createAuth } = require('../../src/auth'),
  assert = require('node:assert/strict'),
  fs = require('node:fs');
(async () => {
  const phase = process.argv[2] || 'after';
  fs.mkdirSync('work/issue-310', { recursive: true });
  const f = await appFixture(
    { after() {} },
    {
      config: { frontendEnabled: true, achievementPurpose: 'test', marketAutomationEnabled: false },
      seed: (db) => createAuth(db).bootstrap('header_owner', 'synthetic-password'),
    },
  );
  let b;
  const report = [];
  try {
    b = await chromium.launch({
      executablePath: process.env.BGA_CHROMIUM_PATH || '/usr/bin/chromium',
      args: ['--no-sandbox'],
    });
    for (const scenario of [
      { width: 1920, height: 1080 },
      { width: 1366, height: 1080 },
      { width: 900, height: 1080 },
      { width: 390, height: 844 },
      { width: 320, height: 844 },
      { width: 1366, height: 500 },
      { width: 1366, height: 844, touch: true },
    ])
      for (const color of ['light', 'dark']) {
        const { width, height, touch = false } = scenario;
        const c = await b.newContext({
          viewport: { width, height },
          isMobile: touch,
          hasTouch: touch,
          reducedMotion: 'reduce',
        });
        await c.addInitScript((color) => {
          localStorage.setItem(
            'bga-entry-intro-settings',
            JSON.stringify({ version: 1, enabled: false }),
          );
          localStorage.setItem('bga.color', JSON.stringify({ scheme: color }));
        }, color);
        assert.equal(
          (
            await c.request.post(f.base + '/api/auth/login', {
              data: { username: 'header_owner', password: 'synthetic-password' },
            })
          ).status(),
          200,
        );
        const p = await c.newPage();
        const errors = [];
        p.on('pageerror', (e) => errors.push(e.message));
        const pair = { width, height, touch, color, pages: {} };
        for (const [name, path] of [
          ['lobby', '/'],
          ['settings', '/settings'],
        ]) {
          await p.goto(f.base + path);
          await p.locator('#site-account-button').waitFor();
          await p.evaluate(() => document.fonts.ready);
          if (
            await p
              .getByRole('button', {
                name: color === 'dark' ? '切換為深色模式' : '切換為亮色模式',
                exact: true,
              })
              .count()
          )
            await p
              .getByRole('button', {
                name: color === 'dark' ? '切換為深色模式' : '切換為亮色模式',
                exact: true,
              })
              .click();
          await p.mouse.move(1, 300);
          await p.evaluate(() => {
            if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
          });
          pair.pages[name] = await p.evaluate(() => {
            const styleKeys = [
              'backgroundColor',
              'borderBottomColor',
              'borderBottomWidth',
              'paddingTop',
              'paddingBottom',
              'paddingLeft',
              'paddingRight',
              'marginTop',
              'marginBottom',
              'color',
              'fontFamily',
              'fontSize',
              'height',
              'maxWidth',
            ];
            const read = (s) => {
              const e = document.querySelector(s),
                cs = getComputedStyle(e),
                r = e.getBoundingClientRect();
              return {
                rect: { x: r.x, y: r.y, width: r.width, height: r.height },
                styles: Object.fromEntries(styleKeys.map((k) => [k, cs[k]])),
              };
            };
            return {
              header: read('#site-header-app'),
              content: read('.vue-site-header-content'),
              brand: read('.vue-site-brand'),
              logo: read('.vue-room-brand-image'),
              nav: read('.vue-site-nav'),
              controls: read('.vue-site-controls'),
              theme: read('.vue-site-controls > button[aria-label*="切換為"]'),
              account: read('#site-account-button'),
              overflow: document.documentElement.scrollWidth > innerWidth,
              bg: document.querySelector('.lobby-backdrop')?.getAttribute('data-background'),
            };
          });
          await p.locator('#site-account-button').hover();
          await p.waitForTimeout(250);
          pair.pages[name].accountHover = await p
            .locator('#site-account-button')
            .evaluate((element) => ({
              transform: getComputedStyle(element).transform,
              y: element.getBoundingClientRect().y,
            }));
          await p.mouse.move(1, 300);
          await p.waitForTimeout(250);
          if (name === 'settings' && phase === 'after') {
            const content = await p.evaluate(() => {
              const main = document.querySelector('#settings-app'),
                parent = main.parentElement,
                header = document.querySelector('#site-header-app'),
                shell = header.parentElement;
              const rect = () => {
                const r = main.getBoundingClientRect();
                return { x: r.x, y: r.y, width: r.width, height: r.height };
              };
              const after = rect();
              parent.prepend(header);
              shell.remove();
              const before = rect();
              parent.before(shell);
              shell.append(header);
              return { before, after };
            });
            assert.deepEqual(content.after, content.before, 'settings main geometry');
            pair.content = content;
            await p.getByRole('button', { name: '遊戲題庫', exact: true }).click();
            await p.locator('#vue-site-library-menu').waitFor();
            await p
              .locator('#vue-site-library-menu')
              .getByRole('link', { name: '你畫我猜', exact: true })
              .waitFor();
            await p.keyboard.press('Escape');
            await p.locator('#site-account-button').click();
            await p.locator('.vue-site-account-popup').waitFor();
            await p.getByRole('link', { name: '帳號與個人化設定', exact: true }).waitFor();
            await p.keyboard.press('Escape');
            if ((width === 1920 && color === 'light') || (width === 390 && color === 'dark')) {
              await p.locator('#nickname').fill('導覽測試' + width);
              const saved = p.waitForResponse(
                (r) => r.url().endsWith('/api/profile/name') && r.request().method() === 'POST',
              );
              await p.getByRole('button', { name: '儲存暱稱', exact: true }).click();
              assert.equal((await saved).status(), 200);
              await p.reload();
              await p.locator('#nickname').waitFor();
              assert.equal(await p.locator('#nickname').inputValue(), '導覽測試' + width);
            }
            await p.locator('#settings-tab-media').click();
            await p.locator('#settings-panel-media').waitFor();
            await p.locator('#settings-tab-character').click();
            await p.locator('#nickname').waitFor();
            await p.evaluate(() => scrollTo(0, 0));
          }
          if ([1920, 390].includes(width)) {
            await p.screenshot({
              path: `work/issue-310/${phase}-${width}-${color}-${name}.png`,
              fullPage: name === 'settings',
            });
            await p
              .locator('#site-header-app')
              .screenshot({ path: `work/issue-310/${phase}-${width}-${color}-${name}-header.png` });
          }
        }
        if (phase === 'after') {
          for (const key of ['header', 'content', 'logo', 'nav', 'theme', 'account'])
            assert.deepEqual(
              pair.pages.settings[key],
              pair.pages.lobby[key],
              width + ' ' + color + ' ' + key,
            );
          for (const key of ['x', 'y', 'height'])
            assert.equal(
              pair.pages.settings.brand.rect[key],
              pair.pages.lobby.brand.rect[key],
              width + ' brand ' + key,
            );
          assert.deepEqual(pair.pages.settings.brand.styles, pair.pages.lobby.brand.styles);
          assert.deepEqual(
            pair.pages.settings.accountHover,
            pair.pages.lobby.accountHover,
            'account hover stays aligned',
          );
          assert.equal(pair.pages.settings.overflow, false);
          assert.equal(pair.pages.lobby.overflow, false);
        }
        assert.deepEqual(errors, []);
        report.push(pair);
        await c.close();
        console.log('PAIR', width, height, touch ? 'touch' : 'mouse', color);
      }
  } finally {
    await b?.close();
    await f.dispose();
    fs.writeFileSync('work/issue-310/' + phase + '.json', JSON.stringify(report, null, 2));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
