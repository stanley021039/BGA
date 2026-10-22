// Issue #165: other dialogs (help, invite) and focus mode must not stop the room's
// YouTube video. QA_BASE and QA_CREDENTIALS_FILE ({username,password}) point at a test server.
const { chromium } = require('playwright'),
  fs = require('node:fs'),
  { randomUUID } = require('node:crypto');
const base = process.env.QA_BASE || 'http://127.0.0.1:3150',
  login = JSON.parse(fs.readFileSync(process.env.QA_CREDENTIALS_FILE, 'utf8'));
(async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(process.platform === 'win32' ? { channel: 'chrome' } : {}),
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.request.post(base + '/api/auth/login', { data: login });
  const { code } = await (
    await context.request.post(base + '/api/create', {
      data: { type: 'quacks', roomName: 'media repro' },
    })
  ).json();
  const page = await context.newPage();
  await page.goto(base + '/quacks/' + code, { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const snapshot = await (await context.request.get(base + '/api/room-media?code=' + code)).json();
  const queued = await context.request.post(base + '/api/room-media?code=' + code, {
    data: {
      requestId: randomUUID(),
      action: 'enqueue',
      expectedRevision: snapshot.revision,
      roomInstanceId: snapshot.roomInstanceId,
      playbackSessionId: snapshot.playbackSessionId,
      type: 'video',
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      title: 'repro',
    },
  });
  console.log('enqueue', queued.status());
  await page.waitForTimeout(3000);
  // Accept the "load video" consent, as a viewer would.
  await page.getByRole('button', { name: '同意播放（載入影片）' }).click({ timeout: 10000 });
  await page.waitForTimeout(6000);
  const state = () =>
    page.evaluate(() => ({
      mediaOpen: !!document.querySelector('dialog.vue-room-media')?.open,
      iframes: document.querySelectorAll('.vue-room-media iframe').length,
    }));
  console.log('before other dialog', JSON.stringify(await state()));
  await page.getByRole('button', { name: '遊戲說明' }).click();
  await page.waitForTimeout(1500);
  console.log('while help dialog open', JSON.stringify(await state()));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1500);
  console.log('after help dialog closed', JSON.stringify(await state()));
  await page.getByRole('button', { name: '邀請朋友加入這桌' }).click();
  await page.waitForTimeout(1500);
  console.log('while invite dialog open', JSON.stringify(await state()));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1500);
  console.log('after invite dialog closed', JSON.stringify(await state()));
  await page.getByRole('button', { name: '專注全螢幕' }).click();
  await page.waitForTimeout(2500);
  console.log(
    'in focus mode',
    JSON.stringify(await state()),
    await page.evaluate(() => String(document.fullscreenElement?.className || 'none')),
  );
  await page.getByRole('button', { name: '退出專注全螢幕' }).click();
  await page.waitForTimeout(1500);
  console.log('after focus mode', JSON.stringify(await state()));
  await context.request.post(base + '/api/leave', { data: { code } });
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
