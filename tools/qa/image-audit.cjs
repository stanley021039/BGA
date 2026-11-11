// Image delivery audit for AGENTS.md "圖片交付": opens every page and a started room of
// every game, then checks each visible image and image response against the rules.
// IMAGE_BASE=http://127.0.0.1:3150 IMAGE_CREDENTIALS_FILE=login.json
// [IMAGE_PAGES=/,/settings] [IMAGE_GAMES=quacks,bluff] [IMAGE_DPR=1] [IMAGE_VIEWPORT=390x844]
// node tools/qa/image-audit.cjs   (run once at the default 1920x1080 and once at 390x844)
// The credentials file is {"username":"...","password":"..."}; rooms are created (and left
// afterwards) with that account, so point it at a test account only. Exits 1 on a violation.
//
// Reported:
// - oversize: downloaded pixels more than 2x the displayed CSS size (cover backgrounds use
//   the shorter side). 128px thumbnails are the floor, so images shown at 64px or less
//   pass with 128.
// - raster: PNG/JPEG/GIF delivered without a ?size= WebP thumbnail.
// - unversioned: /assets image without ?v= or ?size= (cannot be cached long term).
// - heavy: a single image over 256 KiB.
// Images that only appear in some states (dialogs, later phases) are not reached; list and
// check those by hand in the PR.
const { chromium } = require('playwright'),
  fs = require('node:fs');
const base = (process.env.IMAGE_BASE || 'http://127.0.0.1:3150').replace(/\/$/, '');
const dpr = Number(process.env.IMAGE_DPR || 1);
const [vw, vh] = (process.env.IMAGE_VIEWPORT || '1920x1080').split('x').map(Number);
const list = (value, fallback) => (value ? value.split(',').filter(Boolean) : fallback);
const pages = list(process.env.IMAGE_PAGES, [
  '/',
  '/settings',
  '/profile',
  '/achievements',
  '/collection',
  '/gacha',
  '/gifts',
  '/music',
  '/community',
  '/credits',
  '/studio',
  '/market',
  '/arena',
  '/draw-words',
  '/sound-library',
]);
const games = list(process.env.IMAGE_GAMES, [
  'poker',
  'thunder',
  'majority',
  'gift',
  'draw',
  'trpg',
  'coc',
  'telephone',
  'musicquiz',
  'minimal',
  'bluff',
  'decrypto',
  'quacks',
  'ceo',
  'second-wind',
  'lounge',
  'brainwave',
  'drama-bar',
]);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const local = (url) => url.replace(base, '');

async function measure(page) {
  return page.evaluate(async () => {
    const out = [],
      shown = (el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 ? r : null;
      };
    for (const img of document.querySelectorAll('img')) {
      const r = shown(img);
      if (r && img.naturalWidth && img.currentSrc && !img.currentSrc.startsWith('data:'))
        out.push({
          src: img.currentSrc,
          nw: img.naturalWidth,
          nh: img.naturalHeight,
          w: r.width,
          h: r.height,
          cover: false,
        });
    }
    for (const el of document.querySelectorAll('*')) {
      const style = getComputedStyle(el),
        r = style.backgroundImage !== 'none' && shown(el);
      if (!r) continue;
      for (const m of style.backgroundImage.matchAll(/url\("?([^")]+)"?\)/g)) {
        if (m[1].startsWith('data:')) continue;
        const image = new Image();
        image.src = new URL(m[1], location.href).href;
        try {
          await image.decode();
        } catch {
          continue;
        }
        out.push({
          src: image.src,
          nw: image.naturalWidth,
          nh: image.naturalHeight,
          w: r.width,
          h: r.height,
          cover: /cover/.test(style.backgroundSize),
        });
      }
    }
    return out;
  });
}

(async () => {
  const credentials = JSON.parse(fs.readFileSync(process.env.IMAGE_CREDENTIALS_FILE, 'utf8'));
  const browser = await chromium.launch({
    channel: process.env.IMAGE_CHANNEL || 'chrome',
    headless: true,
  });
  const context = await browser.newContext({
    viewport: { width: vw, height: vh },
    deviceScaleFactor: dpr,
  });
  const login = await context.request.post(base + '/api/auth/login', { data: credentials });
  if (!login.ok()) throw Error('Login failed: ' + login.status());
  const api = async (route, data) =>
    (await context.request.post(base + '/api/' + route, { data })).json().catch(() => ({}));
  const targets = pages.map((p) => ({ name: p, url: base + p })),
    rooms = [];
  for (const type of games) {
    const { code } = await api('create', { type, roomName: 'image audit ' + type });
    if (!code) continue;
    rooms.push(code);
    for (let i = 0; i < 3; i++) await api('bot', { code });
    await api('start', { code });
    targets.push({ name: type, url: `${base}/${type === 'thunder' ? 'race' : type}/${code}` });
  }
  const page = await context.newPage(),
    cdp = await context.newCDPSession(page),
    responses = new Map();
  await cdp.send('Network.enable');
  cdp.on('Network.responseReceived', ({ requestId, type, response }) => {
    if (type === 'Image' && !response.url.startsWith('data:'))
      responses.set(requestId, {
        url: local(response.url),
        status: response.status,
        mime: response.mimeType,
        bytes: 0,
      });
  });
  cdp.on('Network.loadingFinished', ({ requestId, encodedDataLength }) => {
    const r = responses.get(requestId);
    if (r) r.bytes = encodedDataLength;
  });
  const found = new Map(),
    report = (kind, key, where) => {
      const entry = found.get(kind + ' ' + key) || { kind, key, pages: new Set() };
      entry.pages.add(where);
      found.set(kind + ' ' + key, entry);
    };
  for (const target of targets) {
    responses.clear();
    await page.goto(target.url, { waitUntil: 'load' }).catch(() => {});
    await page
      .locator('.entry-intro-skip')
      .click({ timeout: 1200 })
      .catch(() => {});
    await sleep(Number(process.env.IMAGE_SETTLE_MS || 3500));
    for (const e of await measure(page).catch(() => [])) {
      if (/\.svg(\?|$)/i.test(e.src) || e.src.startsWith('blob:')) continue;
      const cssW = e.w * dpr,
        cssH = e.h * dpr,
        ratio = e.cover ? Math.min(e.nw / cssW, e.nh / cssH) : Math.max(e.nw / cssW, e.nh / cssH),
        floor = Math.max(e.nw, e.nh) <= 128;
      if (ratio > 2.05 && !floor)
        report(
          'oversize',
          `${local(e.src).split('?')[0]} ${e.nw}x${e.nh} shown ${Math.round(e.w)}x${Math.round(e.h)}`,
          target.name,
        );
    }
    for (const r of responses.values()) {
      if (r.status >= 400) continue;
      const [pathname, query = ''] = r.url.split('?');
      if (/\.(png|jpe?g|gif)$/i.test(pathname) && !/(^|&)size=/.test(query) && !/webp/.test(r.mime))
        report('raster', pathname, target.name);
      if (pathname.startsWith('/assets/') && !/(^|&)(v|size)=/.test(query))
        report('unversioned', pathname, target.name);
      if (r.bytes > 256 * 1024)
        report('heavy', `${pathname} ${Math.round(r.bytes / 1024)} KiB`, target.name);
    }
  }
  for (const code of rooms) await api('leave', { code });
  await browser.close();
  const rows = [...found.values()];
  for (const row of rows) console.log(`${row.kind}\t${row.key}\t${[...row.pages].join(', ')}`);
  console.log(`${targets.length} pages and rooms checked, ${rows.length} problems`);
  if (process.env.IMAGE_OUT)
    fs.writeFileSync(
      process.env.IMAGE_OUT,
      JSON.stringify(
        rows.map((r) => ({ ...r, pages: [...r.pages] })),
        null,
        1,
      ),
    );
  if (rows.length) process.exitCode = 1;
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
