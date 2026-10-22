'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  { randomUUID } = require('node:crypto');
const { BluffRoom } = require('../src/games/bluff'),
  { addTestBot } = require('../src/ai');
const { appFixture } = require('./helpers/app-fixture.cjs'),
  { createAuth } = require('../src/auth');

const act = (r, id, action, extra = {}) =>
  r.act(id, action, { roundId: r.roundId, requestId: randomUUID(), ...extra });
function toDiscussion(r) {
  act(r, r.thinkerId, 'choose', { questionId: r.choices[0].id });
  for (const p of r.players) act(r, p.id, 'ready');
}
function room(now = () => 1000) {
  const r = new BluffRoom('ABC123', '字幕', () => 0, now);
  for (let i = 0; i < 3; i++) r.add('玩家' + i);
  r.start();
  return r;
}

test('subtitles are accepted only while talking, for the current round, from human players', () => {
  const r = room(),
    [a] = r.players,
    line = (extra) => ({
      roundId: r.roundId,
      utteranceId: randomUUID(),
      text: '我覺得',
      final: false,
      ...extra,
    });
  assert.throws(() => r.caption(a.id, line()), /口說階段/);
  toDiscussion(r);
  assert.throws(() => r.caption(a.id, line({ roundId: 'old' })), /換輪/);
  assert.throws(() => r.caption(a.id, line({ utteranceId: 'x' })), /識別碼/);
  assert.throws(() => r.caption(a.id, line({ final: 'yes' })), /字幕格式/);
  assert.throws(() => r.caption(a.id, line({ text: 5 })), /字幕格式/);
  assert.throws(() => r.caption('nobody', line()), /尚未入座/);
  const bot = new BluffRoom('ABC124', 'bot', () => 0);
  bot.add('人');
  addTestBot(bot);
  addTestBot(bot);
  bot.start();
  toDiscussion(bot);
  const robot = bot.players.find((p) => p.bot);
  assert.throws(
    () =>
      bot.caption(robot.id, {
        roundId: bot.roundId,
        utteranceId: randomUUID(),
        text: 'hi',
        final: true,
      }),
    /AI/,
  );
});

test('interim text is a live subtitle; final lines build the round log kept in the result', () => {
  let now = 1000;
  const r = room(() => now);
  toDiscussion(r);
  const [a, b] = r.players.filter((p) => p.id !== r.thinkerId),
    first = randomUUID(),
    send = (p, utteranceId, text, final) =>
      r.caption(p.id, { roundId: r.roundId, utteranceId, text, final });
  send(a, first, '  這個\n答案 ', false);
  let view = r.view(b.id);
  assert.deepEqual(view.captions, [{ playerId: a.id, text: '這個 答案', final: false }]);
  assert.deepEqual(view.transcript, []);
  const version = r.version;
  send(a, first, '這個答案是對的', true);
  // A browser may report the same final line again; it is stored once.
  send(a, first, '這個答案是對的。', true);
  send(b, randomUUID(), '我不同意', true);
  assert.equal(r.version, version, 'subtitles do not create game events');
  view = r.view(a.id);
  assert.deepEqual(
    view.transcript.map((e) => [e.name, e.text]),
    [
      [a.name, '這個答案是對的。'],
      [b.name, '我不同意'],
    ],
  );
  assert.equal(view.captions.length, 2);
  now += 6000;
  assert.deepEqual(r.view(a.id).captions, []);
  // An empty update clears that utterance's subtitle.
  const second = randomUUID();
  send(a, second, '嗯', false);
  send(a, second, '', false);
  assert.deepEqual(r.view(a.id).captions, []);
  send(a, randomUUID(), 'x'.repeat(500), true);
  assert.equal(r.view(a.id).transcript.at(-1).text.length, 200);

  for (const p of r.players.filter((p) => p.id !== r.thinkerId)) act(r, p.id, 'spoken');
  act(r, r.thinkerId, 'guess', { targetId: a.id, confirmed: true });
  view = r.view(a.id);
  assert.deepEqual(view.captions, []);
  assert.deepEqual(view.transcript, []);
  assert.deepEqual(view.results[0].transcript.slice(0, 2), [
    { name: a.name, text: '這個答案是對的。' },
    { name: b.name, text: '我不同意' },
  ]);
  act(r, r.host, 'next');
  assert.deepEqual(r.transcript, []);
  assert.deepEqual(r.captions, {});
});

test('the caption route only serves seated players in 瞎掰王 rooms', async (t) => {
  const password = 'synthetic-caption-password';
  const { base } = await appFixture(t, {
    seed: async (db) => {
      const auth = createAuth(db);
      await auth.bootstrap('captionhost', password);
      const host = db.prepare("SELECT * FROM users WHERE username='captionhost'").get();
      for (const name of ['captiona', 'captionb']) {
        const invite = auth.createInvite(host, { days: 1 });
        await auth.register(
          {
            username: name,
            displayName: name,
            password,
            confirmPassword: password,
            invite: invite.code,
          },
          { setHeader() {} },
        );
      }
    },
  });
  const cookies = {};
  for (const name of ['captionhost', 'captiona', 'captionb']) {
    const r = await fetch(base + '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: name, password }),
    });
    cookies[name] = r.headers.get('set-cookie').split(';')[0];
  }
  const post = async (who, route, body) => {
    const r = await fetch(base + '/api/' + route, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookies[who] },
      body: JSON.stringify(body),
    });
    return { status: r.status, body: await r.json() };
  };
  const { code } = (await post('captionhost', 'create', { type: 'bluff', roomName: '字幕' })).body;
  await post('captiona', 'join', { code });
  await post('captionb', 'join', { code });
  let state = (await post('captionhost', 'start', { code })).body;
  const action = async (who, name, extra = {}) =>
    (state = (
      await post(who, 'action', {
        code,
        action: name,
        round: state.round,
        roundId: state.roundId,
        requestId: randomUUID(),
        ...extra,
      })
    ).body);
  // Find the thinker's account by asking each seat for its view.
  let thinkerAccount = null;
  for (const who of ['captionhost', 'captiona', 'captionb']) {
    const view = await (
      await fetch(base + '/api/state?code=' + code, { headers: { Cookie: cookies[who] } })
    ).json();
    if (view.me === view.thinkerId) thinkerAccount = who;
  }
  const choices = (
    await (
      await fetch(base + '/api/state?code=' + code, {
        headers: { Cookie: cookies[thinkerAccount] },
      })
    ).json()
  ).choices;
  await action(thinkerAccount, 'choose', { questionId: choices[0].id });
  for (const who of ['captionhost', 'captiona', 'captionb']) await action(who, 'ready');
  const speaker = ['captionhost', 'captiona', 'captionb'].find((who) => who !== thinkerAccount);
  const listener = ['captionhost', 'captiona', 'captionb'].find(
    (who) => who !== thinkerAccount && who !== speaker,
  );
  const sent = await post(speaker, 'bluff/caption', {
    code,
    roundId: state.roundId,
    utteranceId: randomUUID(),
    text: '這題我知道',
    final: true,
  });
  assert.equal(sent.status, 200);
  const heard = await (
    await fetch(base + '/api/state?code=' + code, { headers: { Cookie: cookies[listener] } })
  ).json();
  assert.deepEqual(
    heard.transcript.map((e) => e.text),
    ['這題我知道'],
  );
  assert.equal(heard.captions[0].text, '這題我知道');
  const outsider = await fetch(base + '/api/bluff/caption', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  assert.equal(outsider.status, 401);
  const other = (await post('captionhost', 'create', { type: 'majority', roomName: '別的遊戲' }))
    .body;
  assert.equal(
    (
      await post('captionhost', 'bluff/caption', {
        code: other.code,
        roundId: 'x',
        utteranceId: randomUUID(),
        text: 'a',
        final: true,
      })
    ).status,
    400,
  );
});
