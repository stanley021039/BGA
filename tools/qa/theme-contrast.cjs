const fs = require('node:fs'),
  path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../..'),
  audit = fs.readFileSync(path.join(root, 'tools/browser-contrast-audit.js'), 'utf8');
const pages = JSON.parse(fs.readFileSync(path.join(root, 'frontend/pages.json'), 'utf8')).concat([
  { id: 'game-audio', route: '/admin/game-audio' },
  { id: 'sound-library', route: '/sound-library' },
]);
const games = new Set([
  'draw',
  'musicquiz',
  'minimal',
  'bluff',
  'telephone',
  'majority',
  'trpg',
  'gift',
  'poker',
  'quacks',
  'race',
]);
let base = process.env.BGA_QA_BASE;
const output = path.join(root, 'work/qa-theme-contrast-151');
fs.mkdirSync(output, { recursive: true });
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const results = [],
    roomCodes = new Map();
  let fixture;
  try {
    if (!base) {
      const { appFixture } = require(path.join(root, 'tests/helpers/app-fixture.cjs'));
      const { createAuth } = require(path.join(root, 'src/auth'));
      fixture = await appFixture(
        { after() {} },
        {
          config: {
            frontendEnabled: true,
            frontendRoot: path.join(root, 'frontend/dist'),
            achievementPurpose: 'test',
            marketAutomationEnabled: false,
          },
          seed: async (db) => {
            await createAuth(db).bootstrap('minimal_qa_host', 'synthetic-minimal-acceptance-only');
          },
        },
      );
      base = fixture.base;
    }
    for (const width of [1920, 390])
      for (const scheme of ['light', 'dark', 'auto']) {
        const context = await browser.newContext({
          viewport: { width, height: width === 1920 ? 1080 : 844 },
          colorScheme: 'dark',
        });
        await context.addInitScript((value) => {
          localStorage.setItem('ah-color-scheme', value);
          localStorage.setItem(
            'bga-entry-intro-settings',
            JSON.stringify({ version: 1, enabled: false }),
          );
        }, scheme);
        await context.request.post(base + '/api/auth/login', {
          data: { username: 'minimal_qa_host', password: 'synthetic-minimal-acceptance-only' },
        });
        const page = await context.newPage();
        let errors = [];
        page.on('pageerror', (e) => errors.push(e.message));
        for (const entry of pages.filter(
          (p) => !process.env.BGA_AUDIT_GAMES_ONLY || games.has(p.id),
        )) {
          errors = [];
          let url = base + entry.route;
          if (games.has(entry.id)) {
            if (!roomCodes.has(entry.id)) {
              const response = await context.request.post(base + '/api/create', {
                data: { type: entry.id === 'race' ? 'thunder' : entry.id },
              });
              const r = await response.json();
              if (response.status() !== 200 || !String(r.code).match(/^[A-F0-9]{6}$/))
                throw Error('Create failed: ' + response.status() + ' ' + JSON.stringify(r));
              roomCodes.set(entry.id, r.code);
            }
            url += '/' + roomCodes.get(entry.id);
          }
          await page.goto(url);
          await page.waitForTimeout(1000);
          if (await page.getByRole('button', { name: '略過開場', exact: true }).isVisible())
            await page.getByRole('button', { name: '略過開場', exact: true }).click();
          if (games.has(entry.id)) await page.waitForTimeout(1000);
          if (await page.locator('.vue-media-consent-dialog[open]').isVisible())
            await page.getByRole('button', { name: '略過（本機不載入）', exact: true }).click();
          await page.waitForTimeout(300);
          const report = await page.evaluate(audit.replace(/\);\s*$/, ')()'));
          const data = await page.evaluate(() => ({
            title: document.title,
            text: document.body.innerText.slice(0, 120),
            overflow: document.documentElement.scrollWidth > innerWidth,
          }));
          const result = {
            page: entry.id,
            route: entry.route,
            width,
            preference: scheme,
            ...report,
            errors: [...errors],
            ...data,
          };
          results.push(result);
          fs.writeFileSync(path.join(output, 'matrix.json'), JSON.stringify(results, null, 2));
          if (report.failures.length || errors.length)
            console.log(
              'candidate',
              entry.id,
              width,
              scheme,
              JSON.stringify({ failures: report.failures, errors }),
            );
          if (['minimal', 'draw', 'profile', 'settings', 'login'].includes(entry.id))
            await page.screenshot({
              path: path.join(output, `${entry.id}-${width}-${scheme}.png`),
              fullPage: true,
            });
        }
        await context.close();
        console.log('group', width, scheme, 'done');
      }
    console.log(
      JSON.stringify({
        groups: results.length,
        withFailures: results.filter((r) => r.failures.length).length,
        failures: results.reduce((a, r) => a + r.failures.length, 0),
        errors: results.filter((r) => r.errors.length).length,
      }),
    );
    if (results.some((r) => r.failures.length || r.errors.length))
      throw Error('Contrast or page-error candidates require review; see matrix.json');
  } finally {
    await browser.close();
    await fixture?.dispose();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
