// 瞎掰王 speech subtitles end to end on the QA server, with a stand-in recognizer
// (headless Chrome has no microphone or speech service).
const { chromium } = require('playwright'),
  fs = require('node:fs'),
  { randomUUID } = require('node:crypto');
// QA_BASE and QA_CREDENTIALS_FILE ({username,password,guests:[two more test accounts]}).
const base = process.env.QA_BASE || 'http://127.0.0.1:3150',
  login = JSON.parse(fs.readFileSync(process.env.QA_CREDENTIALS_FILE, 'utf8'));
const accounts = [login.username, ...login.guests.slice(0, 2)];
const fakeRecognizer = () => {
  class FakeRecognition {
    start() {
      window.__recognizer = this;
      setTimeout(() => this.emit('這題的答案', false), 200);
      setTimeout(() => this.emit('這題的答案是海水蒸發', false), 900);
      setTimeout(() => this.emit('這題的答案是海水蒸發形成的。', true), 1600);
    }
    emit(text, isFinal) {
      const result = Object.assign([{ transcript: text }], { isFinal });
      this.onresult?.({ resultIndex: 0, results: Object.assign([result], {}) });
    }
    stop() {
      setTimeout(() => this.onend?.(), 50);
    }
    abort() {
      this.onend?.();
    }
  }
  window.webkitSpeechRecognition = FakeRecognition;
  window.SpeechRecognition = FakeRecognition;
};
(async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(process.platform === 'win32' ? { channel: 'chrome' } : {}),
  });
  const people = {};
  for (const name of accounts) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.addInitScript(fakeRecognizer);
    await context.request.post(base + '/api/auth/login', {
      data: { username: name, password: login.password },
    });
    people[name] = { context };
  }
  const api = async (name, route, data) => {
    const r = await people[name].context.request.post(base + '/api/' + route, { data });
    const body = await r.json();
    if (!r.ok()) throw Error(route + ' ' + JSON.stringify(body));
    return body;
  };
  const view = async (name, code) =>
    (await people[name].context.request.get(base + '/api/state?code=' + code)).json();
  const { code } = await api(accounts[0], 'create', { type: 'bluff', roomName: '字幕 QA' });
  for (const name of accounts.slice(1)) await api(name, 'join', { code });
  await api(accounts[0], 'start', { code });
  let thinker;
  for (const name of accounts)
    if ((await view(name, code)).thinkerId === (await view(name, code)).me) thinker = name;
  const act = async (name, action, extra = {}) => {
    const s = await view(name, code);
    return api(name, 'action', {
      code,
      action,
      round: s.round,
      roundId: s.roundId,
      requestId: randomUUID(),
      ...extra,
    });
  };
  await act(thinker, 'choose', { questionId: (await view(thinker, code)).choices[0].id });
  for (const name of accounts) await act(name, 'ready');
  const [speaker, listener] = accounts.filter((n) => n !== thinker);
  for (const name of [speaker, listener]) {
    people[name].page = await people[name].context.newPage();
    await people[name].page.goto(base + '/bluff/' + code, { waitUntil: 'load' });
  }
  await people[speaker].page.waitForTimeout(2500);
  // Skip the entry animation if it is still covering the page.
  for (const name of [speaker, listener])
    await people[name].page
      .getByRole('button', { name: /略過開場/ })
      .click({ timeout: 1500 })
      .catch(() => {});
  for (const name of [speaker, listener])
    await people[name].page
      .getByRole('button', { name: '略過（本機不載入）' })
      .click({ timeout: 5000 })
      .catch(() => {});
  await people[speaker].page.waitForTimeout(500);
  const talk = people[speaker].page.getByRole('button', { name: '開始講話並轉成字幕' });
  await talk.click({ timeout: 5000 });
  await people[speaker].page.waitForTimeout(1000);
  const mine = await people[speaker].page
    .locator('.vue-bluff-speech-mine')
    .textContent()
    .catch(() => '');
  await people[listener].page.waitForTimeout(1800);
  const liveForListener = await people[listener].page.locator('.vue-bluff-speech-log').innerText();
  await people[speaker].page.waitForTimeout(1500);
  await people[speaker].page
    .getByRole('button', { name: '停止講話並結束字幕' })
    .click({ timeout: 5000 });
  await people[listener].page.waitForTimeout(2500);
  const logForListener = await people[listener].page.locator('.vue-bluff-speech-log').innerText();
  for (const name of [speaker, listener]) await act(name, 'spoken');
  await act(thinker, 'guess', { targetId: (await view(speaker, code)).me, confirmed: true });
  await people[listener].page.waitForTimeout(2500);
  const review = await people[listener].page
    .locator('.vue-bluff-review-speech')
    .innerText()
    .catch(() => '(none)');
  console.log(
    JSON.stringify(
      { thinker, speaker, listener, mine, liveForListener, logForListener, review },
      null,
      1,
    ),
  );
  for (const name of accounts) await api(name, 'leave', { code }).catch(() => {});
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
