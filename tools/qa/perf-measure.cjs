// Page-load measurement: requests, transferred bytes and load time per scene,
// on a cold visit and on a revisit in the same browser profile.
// PERF_BASE=https://host PERF_CREDENTIALS_FILE=login.json [PERF_SCENES=lobby,quacks,musicquiz]
// [PERF_OUT=result.json] node tools/qa/perf-measure.cjs
// The credentials file is {"username":"...","password":"..."}; rooms are created
// (and left afterwards) with that account, so point it at a test account only.
const { chromium } = require('playwright'),
  fs = require('node:fs');
const base = (process.env.PERF_BASE || 'http://127.0.0.1:3150').replace(/\/$/, '');
const scenes = (process.env.PERF_SCENES || 'lobby,quacks,musicquiz').split(',').filter(Boolean);
const SETTLE_MS = Number(process.env.PERF_SETTLE_MS || 2500);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function bucket(url) {
  const { pathname } = new URL(url);
  if (pathname.startsWith('/api/')) return 'api';
  if (pathname.startsWith('/frontend-assets/')) return 'frontend';
  if (pathname.startsWith('/media/')) return 'media';
  if (pathname.startsWith('/assets/characters/') || pathname.startsWith('/characters/'))
    return 'characters';
  if (/\.(png|webp|jpe?g|gif|svg)$/i.test(pathname)) return 'image';
  if (/\.(mp3|wav|ogg|m4a)$/i.test(pathname)) return 'audio';
  if (/\.(js|css|woff2?)$/i.test(pathname)) return 'static';
  return 'document';
}
async function visit(context, url) {
  const page = await context.newPage(),
    cdp = await context.newCDPSession(page),
    requests = new Map();
  await cdp.send('Network.enable');
  cdp.on('Network.requestWillBeSent', (event) => {
    if (!event.request.url.startsWith('data:'))
      requests.set(event.requestId, { url: event.request.url, bytes: 0, status: 0, cache: null });
  });
  cdp.on('Network.responseReceived', (event) => {
    const item = requests.get(event.requestId);
    if (item) {
      item.status = event.response.status;
      item.cache =
        event.response.fromDiskCache || event.response.fromMemoryCache
          ? 'cache'
          : event.response.status === 304
            ? '304'
            : 'network';
      item.cacheControl =
        event.response.headers['cache-control'] || event.response.headers['Cache-Control'] || '';
    }
  });
  // A revalidated response is reported as the cached 200; only the raw wire
  // headers show the 304.
  cdp.on('Network.responseReceivedExtraInfo', (event) => {
    const item = requests.get(event.requestId);
    if (item && event.statusCode === 304) item.revalidated = true;
  });
  cdp.on('Network.requestServedFromCache', (event) => {
    const item = requests.get(event.requestId);
    if (item) item.cache = 'cache';
  });
  cdp.on('Network.loadingFinished', (event) => {
    const item = requests.get(event.requestId);
    if (item) item.bytes = event.encodedDataLength;
  });
  const started = Date.now();
  await page.goto(url, { waitUntil: 'load' });
  const loadMs = Date.now() - started;
  await sleep(SETTLE_MS);
  const timing = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    return nav
      ? {
          domContentLoaded: Math.round(nav.domContentLoadedEventEnd),
          load: Math.round(nav.loadEventEnd),
        }
      : null;
  });
  await page.close();
  const list = [...requests.values()].filter((item) => item.status),
    summary = {
      requests: list.length,
      network: 0,
      cached: 0,
      notModified: 0,
      bytes: 0,
      loadMs,
      timing,
      buckets: {},
    };
  for (const item of list) {
    if (item.revalidated && item.cache === 'network') item.cache = '304';
    summary.bytes += item.bytes;
    if (item.cache === 'cache') summary.cached++;
    else if (item.cache === '304') summary.notModified++;
    else summary.network++;
    const group = (summary.buckets[bucket(item.url)] ||= { requests: 0, network: 0, bytes: 0 });
    group.requests++;
    group.bytes += item.bytes;
    if (item.cache === 'network') group.network++;
  }
  summary.largest = list
    .filter((item) => item.cache === 'network')
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, 5)
    .map((item) => ({
      path: new URL(item.url).pathname,
      bytes: item.bytes,
      cacheControl: item.cacheControl,
    }));
  return summary;
}
(async () => {
  const browser = await chromium.launch({
      headless: true,
      ...(process.platform === 'win32' ? { channel: 'chrome' } : {}),
    }),
    results = { base, at: new Date().toISOString(), scenes: {} };
  try {
    const login = process.env.PERF_CREDENTIALS_FILE
      ? JSON.parse(fs.readFileSync(process.env.PERF_CREDENTIALS_FILE, 'utf8'))
      : null;
    for (const scene of scenes) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
      try {
        if (login) {
          const response = await context.request.post(base + '/api/auth/login', {
            data: { username: login.username, password: login.password },
          });
          if (!response.ok()) throw Error('login ' + response.status());
        }
        let path = '/',
          code = null;
        if (scene !== 'lobby') {
          const response = await context.request.post(base + '/api/create', {
            data: { type: scene, roomName: 'perf ' + scene },
          });
          if (!response.ok()) throw Error('create ' + scene + ' ' + response.status());
          code = (await response.json()).code;
          path = `/${scene}/${code}`;
        }
        const cold = await visit(context, base + path),
          warm = await visit(context, base + path);
        results.scenes[scene] = { path, cold, warm };
        if (code) await context.request.post(base + '/api/leave', { data: { code } });
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
  const text = JSON.stringify(results, null, 1);
  if (process.env.PERF_OUT) fs.writeFileSync(process.env.PERF_OUT, text + '\n');
  for (const [scene, { cold, warm }] of Object.entries(results.scenes))
    console.log(
      `${scene.padEnd(10)} cold ${cold.requests} req ${(cold.bytes / 1024).toFixed(0)} KB ${cold.loadMs} ms | revisit ${warm.network} fetched ${warm.cached} cached ${warm.notModified} 304 ${(warm.bytes / 1024).toFixed(0)} KB ${warm.loadMs} ms`,
    );
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
