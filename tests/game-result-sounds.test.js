'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  { outcomes, create } = require('../frontend/src/engines/game-result-sounds.js').default;
const previous = {
  code: 'ABC',
  me: 'me',
  version: 1,
  type: 'musicquiz',
  round: 1,
  phase: 'challenge',
  results: [],
};
const result = {
  round: 1,
  answers: [{ id: 'me', choiceId: 'choice', titleCorrect: true }],
  djId: 'me',
  djCorrect: true,
  challenges: {},
};
const next = (r = result) => ({ ...previous, version: 2, phase: 'reveal', results: [r] });
test('music results distinguish personal name and insertion, do not sound for other players or passes', () => {
  assert.deepEqual(outcomes(previous, next()), ['correct']);
  assert.deepEqual(
    outcomes(
      previous,
      next({
        ...result,
        answers: [{ id: 'me', choiceId: 'c', titleCorrect: false }],
        djCorrect: false,
      }),
    ),
    ['incorrect'],
  );
  assert.deepEqual(
    outcomes(previous, next({ ...result, djId: 'other', challenges: { me: 1 }, receiverId: 'me' })),
    ['correct'],
  );
  assert.deepEqual(outcomes(previous, next({ ...result, djId: 'other', answers: [] })), []);
  assert.deepEqual(
    outcomes(
      previous,
      next({ ...result, djId: 'other', challenges: { me: 1 }, receiverId: 'other' }),
    ),
    ['incorrect'],
  );
  assert.deepEqual(outcomes(null, next()), []);
  assert.deepEqual(outcomes(next(), next()), []);
  assert.deepEqual(outcomes(previous, { ...next(), results: [result, result] }), []);
});
test('majority only scores the local player after reveal, ties, missing, solo and alternate rules stay neutral', () => {
  const a = { ...previous, type: 'majority', phase: 'answering' },
    b = {
      ...a,
      version: 2,
      phase: 'reveal',
      answers: { me: 0, other: 1 },
      result: { gains: { me: 1, other: 0 }, missingIds: [] },
    };
  assert.deepEqual(outcomes(a, b), ['correct']);
  assert.deepEqual(outcomes(a, { ...b, result: { gains: { me: 0, other: 1 } } }), ['incorrect']);
  for (const change of [
    { phase: 'review' },
    { result: { gains: { me: 0, other: 0 } } },
    { answers: { other: 1 } },
    { result: { gains: { me: 0, other: 1 }, missingIds: ['me'] } },
    { cruel: { rules: 'teams' } },
    { cruel: { solo: true } },
    { cruel: { scoring: 'minority' } },
  ])
    assert.deepEqual(outcomes(a, { ...b, ...change }), []);
  assert.deepEqual(outcomes(b, b), []);
});
test('live controller avoids first-load, duplicate, background and stale catch-up playback', () => {
  let now = 1000;
  const oldNow = Date.now,
    oldDocument = global.document,
    oldAudio = global.AudioSettings;
  const calls = [],
    listeners = new Map();
  global.document = {
    hidden: false,
    addEventListener: (k, f) => listeners.set(k, f),
    removeEventListener() {},
  };
  global.AudioSettings = { playEffect: (k) => calls.push(k) };
  Date.now = () => now;
  const one = next({ ...result, djId: 'other', challenges: { me: 1 }, receiverId: 'me' });
  try {
    const c = create({ audio: global.AudioSettings });
    c.update(previous);
    c.update(one);
    c.update(one);
    assert.deepEqual(calls, ['correct']);
    c.dispose();
    const d = create({ audio: global.AudioSettings });
    d.update(one);
    assert.equal(calls.length, 1);
    d.update(previous);
    document.hidden = true;
    listeners.get('visibilitychange')();
    d.update(one);
    assert.equal(calls.length, 1);
    document.hidden = false;
    listeners.get('visibilitychange')();
    d.update(previous);
    now += 90000;
    d.update(one);
    assert.equal(calls.length, 2);
    d.dispose();
  } finally {
    Date.now = oldNow;
    global.document = oldDocument;
    global.AudioSettings = oldAudio;
  }
});

test('result helper and failure sample are served through real HTTP static routes', async () => {
  const fs = require('./helpers/browser-modules.cjs'),
    os = require('node:os'),
    path = require('node:path'),
    { createApp } = require('../src/app');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'result-audio-'));
  const app = createApp({
    host: '127.0.0.1',
    port: 0,
    dbFile: path.join(dir, 'test.sqlite'),
    historyDir: path.join(dir, 'history'),
    communityDir: path.join(dir, 'community'),
    musicDir: path.join(dir, 'music'),
    gameAudioDir: path.join(dir, 'audio'),
    externalSideEffectsEnabled: false,
    marketAutomationEnabled: false,
    githubClient: { configured: false },
  });
  try {
    const { port } = await app.listen();
    for (const resource of [
      'shared/game-result-sounds.js',
      'assets/game-sounds/incorrect-user.mp3',
      'assets/game-sounds/correct-user.mp3',
    ]) {
      const r = await fetch('http://127.0.0.1:' + port + '/' + resource);
      assert.equal(r.status, resource.endsWith('.js') ? 404 : 200, resource);
      if (resource.endsWith('.js')) continue;
      const b = Buffer.from(await r.arrayBuffer());
      if (resource.endsWith('.mp3')) {
        assert.ok(b.length > 1000);
        assert.match(r.headers.get('content-type'), /audio/);
      } else assert.match(b.toString(), /GameResultSounds/);
    }
  } finally {
    await app.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('full default music catalog can start and resolve within normal archive row limits', (t) => {
  const fs = require('./helpers/browser-modules.cjs'),
    os = require('node:os'),
    path = require('node:path'),
    { randomUUID } = require('node:crypto'),
    { HistoryStore } = require('../src/history/store'),
    { MusicQuizRoom } = require('../src/games/musicquiz');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'music-history-')),
    h = new HistoryStore(dir);
  t.after(() => {
    h.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });
  const r = new MusicQuizRoom('ABCDEF', 'full catalog', () => 0);
  h.attach(r);
  const p = h.transact(r, { action: 'join' }, () => r.add('player'));
  h.transact(r, { action: 'start' }, () => r.start());
  assert.ok(r.sequence.length > 1000);
  const act = (action, data = {}) =>
    h.transact(r, { action }, () =>
      r.act(p.id, action, { roundId: r.roundId, requestId: randomUUID(), ...data }),
    );
  act('listen');
  act('guess', { choiceId: r.correctChoiceId });
  act('place', { slot: 0 });
  assert.equal(r.results.length, 1);
  assert.equal(r.historyState().completedRounds, 1);
  assert.ok(r.historyState().sequence.every((id) => typeof id === 'string'));
  const archive = h.list()[0],
    rows = h.readRows(archive.id);
  assert.ok(rows.some((row) => row.kind === 'result' && row.after.phase === 'reveal'));
});

test('muted personal outcomes are consumed without suspending a playing song', () => {
  const oldDocument = global.document,
    oldAudio = global.AudioSettings;
  global.document = { hidden: false, addEventListener() {}, removeEventListener() {} };
  global.AudioSettings = {
    get: () => ({ effects: { enabled: false, volume: 0.5 } }),
    suspendMusic() {
      assert.fail('muted cue suspended music');
    },
    playEffect() {
      assert.fail('muted cue played');
    },
  };
  try {
    const c = create({ audio: global.AudioSettings });
    c.update(previous);
    c.update(next());
    c.dispose();
  } finally {
    global.document = oldDocument;
    global.AudioSettings = oldAudio;
  }
});

test('intro answer sounds once immediately, then insertion sounds independently at reveal', () => {
  const a = { ...previous, phase: 'intro', myAnswer: null };
  for (const titleCorrect of [true, false]) {
    const b = { ...a, version: 2, myAnswer: { choiceId: 'c', titleCorrect } };
    assert.deepEqual(outcomes(a, b), [titleCorrect ? 'correct' : 'incorrect']);
    assert.deepEqual(outcomes(b, b), []);
    assert.deepEqual(outcomes(b, { ...b, phase: 'timeline', version: 3 }), []);
    assert.deepEqual(outcomes(b, { ...next(), myAnswer: b.myAnswer }), ['correct']);
    assert.deepEqual(outcomes(null, b), []);
  }
  assert.deepEqual(
    outcomes(a, { ...a, version: 2, myAnswer: { choiceId: null, titleCorrect: null } }),
    [],
  );
  assert.deepEqual(
    outcomes(a, { ...next(), myAnswer: { choiceId: 'c', titleCorrect: true } }),
    ['correct'],
    'a coalesced reveal only plays the local placement verdict',
  );
  assert.deepEqual(
    outcomes(a, {
      ...next({ ...result, djId: 'other', challenges: {} }),
      myAnswer: { choiceId: 'c', titleCorrect: true },
    }),
    [],
    'reveal does not replay the intro or another player verdict',
  );
});
