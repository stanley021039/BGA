'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  vm = require('node:vm'),
  crypto = require('node:crypto');
const { QuacksRoom } = require('../src/games/quacks');
test('successful bag draws get private bounded audio IDs; empty draws do not, and extra looks preserve normal draw count', () => {
  const r = new QuacksRoom('ABCDEF', 'cue', (n) => 0),
    a = r.add('A'),
    b = r.add('B');
  r.start();
  const normal = a.draws;
  r.look(a, 3);
  assert.equal(a.draws, normal);
  assert.equal(a.drawEvents.length, 3);
  assert.equal(new Set(a.drawEvents.map((e) => e.id)).size, 3);
  assert.equal(r.view(a.id).mine.drawEvents.length, 3);
  assert.equal(r.view(b.id).mine.drawEvents.length, 0);
  assert.equal(
    Object.hasOwn(
      r.view(b.id).recipes.find((p) => p.id === a.id),
      'drawEvents',
    ),
    false,
  );
  a.bag = [];
  const count = a.drawEvents.length;
  assert.equal(r.drawOne(a), null);
  assert.equal(a.drawEvents.length, count);
  for (let n = 0; n < 70; n++) r.recordDraw(a);
  assert.equal(a.drawEvents.length, 64);
  r.nextRound();
  assert.equal(a.drawEvents.length, 0);
});
test('essence advances to the computed maximum without awarding before confirmation, and a lower choice remains valid', () => {
  const r = new QuacksRoom('ABCDEF', 'auto', (n) => 0),
    a = r.add('A'),
    b = r.add('B');
  r.configure(a.id, { alchemists: true });
  r.start();
  for (const p of [a, b]) {
    p.alchemy.patientId = 'eyes';
    p.pot = [r.chip('orange'), r.chip('red')];
    p.ready = false;
  }
  r.phase = 'settlement';
  r.round = 1;
  r.fortune = { id: 'test' };
  r.beginAlchemy();
  assert.equal(a.alchemy.essence, 2);
  assert.equal(a.alchemy.max, 2);
  assert.equal(a.alchemy.confirmed, false);
  const rubies = a.rubies,
    bag = a.bag.length;
  assert.equal(a.rubies, rubies);
  assert.equal(a.bag.length, bag);
  r.act(a.id, 'essence', { position: 1, roundId: r.roundId, requestId: crypto.randomUUID() });
  assert.equal(a.alchemy.essence, 1);
  assert.equal(a.alchemy.confirmed, true);
  assert.equal(a.rubies, rubies + 1);
  assert.equal(a.bag.length, bag);
  assert.equal(b.alchemy.confirmed, false);
});
function audioFixture({ controlledClip = false, capacity = true, enabled = true } = {}) {
  let now = 100000,
    id = 0;
  const timers = new Map(),
    handlers = new Set(),
    calls = [],
    bursts = [];
  const document = {
    hidden: false,
    addEventListener: (_, f) => handlers.add(f),
    removeEventListener: (_, f) => handlers.delete(f),
  };
  const window = {
    document,
    AudioSettings: { get: () => ({ effects: { enabled, volume: 0.25 } }) },
  };
  vm.runInNewContext(fs.readFileSync('public/quacks-fx.js', 'utf8'), {
    window,
    Date: { now: () => now },
    setTimeout(fn, ms) {
      timers.set(++id, { fn, at: now + ms });
      return id;
    },
    clearTimeout: (id) => timers.delete(id),
  });
  const cues = window.QuacksFx.createAudio(
    {
      epoch: () => 4,
      hasCapacity: () => capacity,
      play: (cue, key, options) => {
        calls.push({ cue, key, options });
        if (controlledClip && enabled) return {};
      },
    },
    { onExplosion: (events) => bursts.push({ at: now, events }) },
  );
  const state = (events, extra = {}) => ({
    code: 'ABCDEF',
    roundId: 'r1',
    mine: { drawEvents: events },
    ...extra,
  });
  return {
    cues,
    calls,
    bursts,
    state,
    timers,
    freeCapacity() {
      capacity = true;
    },
    events: (n) =>
      Array.from({ length: n }, (_, i) => ({
        id: 'draw' + i,
        at: now,
        decision: true,
        step: i + 1,
      })),
    tick(ms) {
      now += ms;
      for (const [id, t] of [...timers]) if (t.at <= now && timers.delete(id)) t.fn();
    },
    hide() {
      document.hidden = true;
      for (const fn of handlers) fn();
    },
  };
}
test('card cue is separate and a burst of unseen voluntary draws yields one voice without backlog', () => {
  const f = audioFixture();
  f.cues.update(f.state([]), false);
  const state = f.state(f.events(3), { fortuneRevealId: 'card1' });
  f.cues.update(state, true);
  assert.deepEqual(
    f.calls.map((x) => x.cue),
    ['card-draw', 'ingredient-draw'],
  );
  f.cues.update(state, true);
  f.tick(240);
  f.tick(240);
  assert.equal(f.calls.filter((x) => x.cue === 'ingredient-draw').length, 1);
  assert.equal(new Set(f.calls.map((x) => x.key)).size, 2);
  assert.equal(f.calls[1].options.epoch, 4);
  f.cues.destroy();
  assert.equal(f.timers.size, 0);
});
test('baseline, reconnection, hidden pages and round changes consume events without old queued playback', () => {
  const f = audioFixture(),
    old = f.state(f.events(2), { fortuneRevealId: 'old' });
  f.cues.update(old, false);
  f.cues.update(old, true);
  assert.equal(f.calls.length, 0);
  f.cues.update(f.state(f.events(5)), true);
  assert.equal(f.calls.length, 1);
  f.hide();
  f.tick(1000);
  assert.equal(f.calls.length, 1);
  f.cues.update(f.state(f.events(6)), true);
  f.cues.update(f.state(f.events(6), { roundId: 'r2' }), false);
  assert.equal(f.calls.length, 1);
  f.cues.destroy();
});
test('user-supplied cue waveforms match their manifest and have finite bounded samples and faded edges', () => {
  const manifest = JSON.parse(
    fs.readFileSync('public/assets/game-sounds/quacks-manifest.json', 'utf8'),
  );
  for (const [cue, ms] of [
    ['ingredient', 580],
    ['card', 1500],
  ]) {
    const meta = manifest[cue],
      buf = fs.readFileSync('public/assets/game-sounds/' + meta.file);
    assert.equal(meta.durationMs, ms);
    assert.equal(buf.length, 44 + ms * 48);
    assert.equal(buf.toString('ascii', 0, 4), 'RIFF');
    assert.equal(meta.sha256, crypto.createHash('sha256').update(buf).digest('hex'));
    assert.equal(buf.readInt16LE(44), 0);
    assert.equal(buf.readInt16LE(buf.length - 2), 0);
    assert.ok(meta.peak > 1000 && meta.peak < 15000);
  }
});

test('rapid valid draws do not queue voices and late callbacks cannot restart a cleared queue', () => {
  const f = audioFixture({ controlledClip: true });
  f.cues.update(f.state([]), false);
  f.cues.update(f.state(f.events(3)), true);
  assert.equal(f.calls.length, 1);
  f.tick(240);
  assert.equal(f.calls.length, 1);
  f.cues.update(f.state(f.events(4)), true);
  f.calls[0].options.onStop();
  f.tick(25);
  assert.equal(f.calls.length, 1);
  f.cues.update(f.state(f.events(5)), true);
  assert.equal(f.calls.length, 2);
  f.hide();
  f.calls[1].options.onStop();
  f.tick(1500);
  assert.equal(f.calls.length, 2);
  assert.equal(f.timers.size, 0);
  f.cues.destroy();
});

test('potion returns a real chip, records a private one-shot cue, deduplicates retries and resets on new rounds', () => {
  const r = new QuacksRoom('ABCDEF', 'potion', (n) => 0),
    a = r.add('A'),
    b = r.add('B');
  r.start();
  r.drawFortune();
  r.place(a, r.drawOne(a));
  const bag = a.bag.length,
    request = { roundId: r.roundId, requestId: crypto.randomUUID() };
  r.act(a.id, 'potion', request);
  r.act(a.id, 'potion', request);
  assert.equal(a.bag.length, bag + 1);
  assert.equal(r.view(a.id).mine.potionEvents.length, 1);
  assert.equal(r.view(b.id).mine.potionEvents.length, 0);
  assert.equal(Object.hasOwn(r.view(b.id).recipes[0], 'potionEvents'), false);
  assert.throws(() => r.act(a.id, 'potion', { ...request, requestId: crypto.randomUUID() }));
  assert.equal(a.potionEvents.length, 1);
  r.nextRound();
  assert.equal(a.potionEvents.length, 0);
});
test('potion sounds once after a live action, waits for draw cleanup and never replays on initial load or reconnect', () => {
  const f = audioFixture({ controlledClip: true });
  const old = { potionEvents: [{ id: 'old', at: 100000 }] };
  f.cues.update(f.state([], { mine: old }), false);
  f.cues.update(f.state([], { mine: old }), true);
  assert.equal(f.calls.length, 0);
  f.cues.update(f.state(f.events(1)), true);
  assert.equal(f.calls[0].cue, 'ingredient-draw');
  const next = f.state(f.events(1));
  next.mine.potionEvents = [{ id: 'fresh', at: 100000 }];
  f.cues.update(next, true);
  assert.equal(f.calls.length, 1);
  f.calls[0].options.onStop();
  f.tick(25);
  assert.equal(f.calls[1].cue, 'potion-drink');
  f.cues.update(next, true);
  assert.equal(f.calls.length, 2);
  f.cues.update(next, false);
  f.tick(2000);
  assert.equal(f.calls.length, 2);
  f.cues.destroy();
});
test('current real-drink MP3 matches manifest digest and excludes retired synthesized WAVs', () => {
  const m = JSON.parse(fs.readFileSync('public/assets/game-sounds/quacks-manifest.json')).potion,
    b = fs.readFileSync('public/assets/game-sounds/' + m.file);
  assert.equal(m.file, 'quacks-drink-real.mp3');
  assert.equal(m.bytes, b.length);
  assert.equal(m.sha256, crypto.createHash('sha256').update(b).digest('hex'));
  assert.ok(m.durationMs > 0 && m.durationMs < 3000);
  assert.ok(b.length > 1000);
  for (const name of ['quacks-potion.wav', 'quacks-potion-synth.wav'])
    assert.equal(fs.existsSync('public/assets/game-sounds/' + name), false);
});

test('settlement acknowledgements are private, bounded, retry-safe and exclude rejected commands', () => {
  const r = new QuacksRoom('ABCDEF', 'settle', (n) => 0),
    a = r.add('A'),
    b = r.add('B');
  r.start();
  r.phase = 'settlement';
  r.stage = 'witches';
  const req = { roundId: r.roundId, requestId: crypto.randomUUID() };
  r.act(a.id, 'settle-ready', req);
  r.act(a.id, 'settle-ready', req);
  assert.equal(a.settlementEvents.length, 1);
  assert.equal(r.view(b.id).mine.settlementEvents.length, 0);
  assert.equal(Object.hasOwn(r.view(b.id).recipes[0], 'settlementEvents'), false);
  assert.throws(() =>
    r.act(a.id, 'reward', { roundId: r.roundId, requestId: crypto.randomUUID(), mode: 'bad' }),
  );
  assert.equal(a.settlementEvents.length, 1);
  for (let n = 0; n < 40; n++) {
    a.ready = false;
    r.phase = 'settlement';
    r.stage = 'witches';
    r.act(a.id, 'settle-ready', { roundId: r.roundId, requestId: crypto.randomUUID() });
  }
  assert.equal(a.settlementEvents.length, 32);
  r.nextRound();
  assert.equal(a.settlementEvents.length, 0);
});
test('only settlement stage transitions sound once, regardless of same-stage confirmations', () => {
  const f = audioFixture();
  f.cues.update(f.state([], { phase: 'brewing', version: 1 }), false);
  const stages = [
    'witches',
    'essence',
    'bonus',
    'effects',
    'effects-confirm',
    'rewards',
    'shopping',
  ];
  stages.forEach((stage, i) => {
    const s = f.state([], {
      phase: 'settlement',
      stage,
      version: i + 2,
      mine: { settlementEvents: [{ id: 'ack' + i, at: 100000 }] },
    });
    f.cues.update(s, true);
    f.cues.update(s, true);
    f.tick(30);
  });
  assert.equal(f.calls.length, 6);
  assert.ok(f.calls.every((c) => c.cue === 'quacks-settlement'));
  f.cues.update(f.state([], { phase: 'between', version: 10 }), true);
  assert.equal(f.calls.length, 6);
  f.cues.destroy();
});
test('settlement load, reconnect and hidden transitions do not replay historical acknowledgements', () => {
  const f = audioFixture(),
    s = f.state([], {
      phase: 'settlement',
      stage: 'shopping',
      version: 1,
      mine: { settlementEvents: [{ id: 'old', at: 100000 }] },
    });
  f.cues.update(s, false);
  f.cues.update(s, true);
  assert.equal(f.calls.length, 0);
  f.cues.update(
    { ...s, version: 2, mine: { settlementEvents: [{ id: 'new', at: 100000 }] } },
    true,
  );
  assert.equal(f.calls.length, 0);
  f.hide();
  f.cues.update({ ...s, phase: 'between', version: 3 }, true);
  f.tick(1000);
  assert.equal(f.calls.length, 0);
  f.cues.destroy();
});
test('settlement WAV has faded bounds and reproducible manifest checksum', () => {
  const m = JSON.parse(
      fs.readFileSync('public/assets/game-sounds/quacks-manifest.json'),
    ).settlement,
    b = fs.readFileSync('public/assets/game-sounds/' + m.file);
  assert.equal(m.durationMs, 420);
  assert.equal(b.length, 20204);
  assert.equal(m.sha256, crypto.createHash('sha256').update(b).digest('hex'));
  assert.equal(b.readInt16LE(44), 0);
  assert.equal(b.readInt16LE(b.length - 2), 0);
  assert.ok(m.peak > 1000 && m.peak < 15000);
});
test('settlement waits for an occupied game audio slot, then plays once', () => {
  const f = audioFixture({ capacity: false });
  f.cues.update(f.state([], { phase: 'brewing' }), false);
  f.cues.update(f.state([], { phase: 'settlement', stage: 'bonus', version: 2 }), true);
  assert.equal(f.calls.length, 0);
  f.tick(100);
  assert.equal(f.calls.length, 0);
  f.freeCapacity();
  f.tick(50);
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].cue, 'quacks-settlement');
  f.cues.destroy();
});
test('settlement glow marks actual outcomes, includes upgrade and dice results, and resets every round', () => {
  const r = new QuacksRoom('ABCDEF', 'glow', (n) => 0),
    a = r.add('A'),
    b = r.add('B');
  r.start();
  r.phase = 'settlement';
  r.round = 3;
  r.fortune = { id: 'test' };
  const chip = (color, value = 1) => ({
    ...r.chip(color, value),
    effectColor: color,
    effectValue: value,
    position: 1,
  });
  a.pot = [chip('black'), chip('purple'), chip('green')];
  b.pot = [];
  r.beginEffects();
  assert.ok(a.effectSummary.some((e) => e.color === 'black' && e.triggered));
  assert.ok(a.effectSummary.some((e) => e.color === 'green' && e.triggered));
  assert.ok(!a.effectSummary.some((e) => e.color === 'purple' && e.triggered));
  const q = a.pending[0];
  r.act(a.id, 'choice', {
    choiceId: q.id,
    optionId: q.options[0].id,
    roundId: r.roundId,
    requestId: crypto.randomUUID(),
  });
  assert.ok(a.effectSummary.some((e) => e.color === 'purple' && e.triggered));
  assert.ok(!b.effectSummary.some((e) => e.triggered));
  const before = r.effectSnapshot(a);
  a.pot[0].value = 2;
  r.effectRecord(a, 'purple', before);
  assert.equal(a.effectSummary.at(-1).triggered, true);
  const diceBefore = r.effectSnapshot(a);
  a.dice.push(0);
  r.effectRecord(a, 'green', diceBefore);
  assert.equal(a.effectSummary.at(-1).triggered, true);
  r.nextRound();
  assert.deepEqual(a.effectSummary, []);
});

test('stop cue is private, once per confirmed transition, and never replayed on baseline or reconnect', () => {
  const f = audioFixture(),
    s = (stopped) =>
      f.state([], {
        mine: { stopEvents: stopped ? [{ id: 'stop1', at: 100000 }] : [] },
        me: 'a',
        recipes: [
          { id: 'a', stopped },
          { id: 'b', stopped: true },
        ],
      });
  f.cues.update(s(false), false);
  f.cues.update(s(false), true);
  assert.equal(f.calls.length, 0);
  f.cues.update(s(true), true);
  f.cues.update(s(true), true);
  assert.deepEqual(
    f.calls.map((c) => c.cue),
    ['quacks-stop'],
  );
  f.cues.update(s(false), false);
  f.cues.update(s(true), false);
  f.cues.update(s(true), true);
  f.tick(3000);
  assert.equal(f.calls.length, 1);
  f.cues.destroy();
});
test('replacement stop and settlement sources retain normalized, faded PCM with matching checksums', () => {
  const manifest = JSON.parse(fs.readFileSync('public/assets/game-sounds/quacks-manifest.json'));
  for (const key of ['stopUser', 'settlementUser']) {
    const m = manifest[key],
      b = fs.readFileSync('public/assets/game-sounds/' + m.file);
    assert.equal(m.sha256, crypto.createHash('sha256').update(b).digest('hex'));
    assert.equal(b.readUInt32LE(24), 24000);
    assert.equal(b.length, 44 + b.readUInt32LE(40));
    assert.equal(b.readInt16LE(44), 0);
    assert.equal(b.readInt16LE(b.length - 2), 0);
    assert.ok(m.durationMs > 500 && m.durationMs < 2000);
    let peak = 0;
    for (let i = 44; i < b.length; i += 2) peak = Math.max(peak, Math.abs(b.readInt16LE(i)));
    assert.equal(peak, m.peak);
    assert.ok(peak <= 13200 && peak > 5000);
  }
});

test('only accepted voluntary stops emit a private cue; explosions and automatic stops stay silent', () => {
  const r = new QuacksRoom('ABCDEF', 'stop', () => 0),
    a = r.add('A'),
    b = r.add('B');
  r.start();
  r.drawFortune();
  const request = { roundId: r.roundId, requestId: crypto.randomUUID(), step: r.step };
  r.act(a.id, 'stop', request);
  r.act(a.id, 'stop', request);
  assert.equal(r.view(a.id).mine.stopEvents.length, 1);
  assert.equal(r.view(b.id).mine.stopEvents.length, 0);
  assert.equal(Object.hasOwn(r.view(b.id).recipes[0], 'stopEvents'), false);
  assert.throws(() => r.act(a.id, 'stop', { ...request, requestId: crypto.randomUUID() }));
  assert.equal(a.stopEvents.length, 1);
  b.pot = [r.chip('white', 4), r.chip('white', 4)];
  r.exploded(b);
  assert.equal(b.exploded, true);
  assert.equal(b.stopEvents.length, 0);
  r.nextRound();
  assert.equal(a.stopEvents.length, 0);
});
test('buy, undo, refill and pending choices do not emit settlement cues until the stage actually changes', () => {
  const f = audioFixture(),
    s = { phase: 'settlement', stage: 'shopping', version: 1, mine: { settlementEvents: [] } };
  f.cues.update(f.state([], s), false);
  for (let i = 2; i < 7; i++) {
    f.cues.update(
      f.state([], {
        ...s,
        version: i,
        mine: { settlementEvents: [{ id: 'action' + i, at: 100000 }] },
      }),
      true,
    );
    f.tick(30);
  }
  assert.equal(f.calls.length, 0);
  f.cues.update(f.state([], { ...s, phase: 'between', version: 7 }), true);
  assert.deepEqual(
    f.calls.map((c) => c.cue),
    [],
  );
  f.cues.destroy();
});

test('an explosive draw finishes, pauses, then shows/sounds the burst without an extra settlement cue', () => {
  const f = audioFixture({ controlledClip: true });
  f.cues.update(f.state([], { phase: 'brewing' }), false);
  const s = f.state(f.events(1), {
    phase: 'settlement',
    stage: 'witches',
    recipes: [{ id: 'a', name: '甲', explosionId: 'boom' }],
  });
  f.cues.update(s, true);
  f.cues.update(s, true);
  assert.deepEqual(
    f.calls.map((x) => x.cue),
    ['ingredient-draw'],
  );
  assert.equal(f.bursts.length, 0);
  f.tick(1600);
  assert.equal(f.bursts.length, 0, 'slow loading still waits for draw cleanup');
  f.calls[0].options.onStop();
  f.tick(25);
  f.tick(179);
  assert.equal(f.bursts.length, 0);
  f.tick(1);
  assert.deepEqual(
    f.calls.map((x) => x.cue),
    ['ingredient-draw', 'quacks-explosion'],
  );
  assert.equal(f.bursts.length, 1);
  assert.equal(f.bursts[0].events[0].playerId, 'a');
  f.cues.update(s, true);
  assert.equal(f.bursts.length, 1);
  f.calls[1].options.onStop();
  f.tick(25);
  assert.equal(f.calls.length, 2);
  f.cues.destroy();
});
test('other viewers and muted/rejected audio still receive the delayed public explosion once', () => {
  for (const enabled of [true, false]) {
    const f = audioFixture({ enabled }),
      s = f.state([], { recipes: [{ id: 'b', name: '乙', explosionId: 'public' }] });
    f.cues.update(f.state([]), false);
    f.cues.update(s, true);
    f.tick(179);
    assert.equal(f.bursts.length, 0);
    f.tick(1);
    assert.equal(f.bursts.length, 1);
    f.tick(25);
    f.cues.update(s, true);
    assert.equal(f.bursts.length, 1);
    f.cues.destroy();
  }
});
test('pending explosion is cancelled on clear, disconnect, hidden or a new round and is never caught up', () => {
  for (const cancel of ['clear', 'disconnect', 'hide', 'round']) {
    const f = audioFixture(),
      s = f.state([], { recipes: [{ id: 'a', name: '甲', explosionId: 'cancel' }] });
    f.cues.update(f.state([]), false);
    f.cues.update(s, true);
    if (cancel === 'clear') f.cues.clear();
    if (cancel === 'disconnect') f.cues.update(s, false);
    if (cancel === 'hide') f.hide();
    if (cancel === 'round') f.cues.update({ ...s, roundId: 'r2' }, true);
    f.tick(2500);
    assert.equal(f.bursts.length, 0, cancel);
    f.cues.update(s, false);
    f.cues.update(s, true);
    f.tick(2500);
    assert.equal(f.bursts.length, 0, cancel);
    f.cues.destroy();
  }
});

test('crow previews and all effect draws are consumed silently across repeated snapshots and choices', () => {
  const f = audioFixture({ controlledClip: true });
  f.cues.update(f.state([]), false);
  const events = [
    { id: 'root', at: 100000, decision: true, step: 1 },
    ...Array.from({ length: 4 }, (_, i) => ({ id: 'look' + i, at: 100000, decision: false })),
  ];
  const s = f.state(events);
  f.cues.update(s, true);
  assert.equal(f.calls.length, 1);
  f.calls[0].options.onStop();
  for (let i = 0; i < 8; i++) {
    f.tick(400);
    f.cues.update(s, true);
  }
  assert.equal(f.calls.length, 1);
  f.cues.update(f.state([...events, { id: 'choice-look', at: 100000, decision: false }]), true);
  f.tick(1000);
  assert.equal(f.calls.length, 1);
  f.cues.destroy();
});
test('crow, potion and fortune previews never produce a voluntary draw cue by themselves', () => {
  const f = audioFixture();
  f.cues.update(f.state([]), false);
  f.cues.update(
    f.state([
      { id: 'crow', at: 100000, decision: false },
      { id: 'legacy', at: 100000 },
    ]),
    true,
  );
  f.tick(3000);
  assert.equal(f.calls.length, 0);
  f.cues.destroy();
});
test('one valid manual draw including crow previews is voiced once; retried intents and choices add no voice events', () => {
  const r = new QuacksRoom('ABCDEF', 'crow', () => 0),
    a = r.add('A'),
    b = r.add('B');
  r.start();
  r.drawFortune();
  a.bag = [r.chip('blue', 2), r.chip('green'), r.chip('white')];
  b.bag = [r.chip('orange')];
  const data = { roundId: r.roundId, requestId: crypto.randomUUID(), step: r.step };
  r.act(a.id, 'draw', data);
  r.act(a.id, 'draw', data);
  assert.throws(() => r.act(a.id, 'draw', { ...data, requestId: crypto.randomUUID() }));
  r.act(b.id, 'draw', { ...data, requestId: crypto.randomUUID() });
  assert.equal(a.drawEvents.length, 3);
  assert.equal(a.drawEvents.filter((e) => e.decision).length, 1);
  assert.equal(a.drawEvents[0].step, 1);
  const q = r.view(a.id).mine.pending,
    o = q.options.find((o) => o.label === '全部放回');
  r.act(a.id, 'choice', {
    roundId: r.roundId,
    requestId: crypto.randomUUID(),
    choiceId: q.id,
    optionId: o.id,
  });
  assert.equal(a.drawEvents.filter((e) => e.decision).length, 1);
  assert.equal(Object.hasOwn(r.view(b.id).recipes[0], 'drawEvents'), false);
});

test('stopping at settlement entry voices the stop once without an appended settlement cue', () => {
  const f = audioFixture({ controlledClip: true });
  f.cues.update(f.state([], { phase: 'brewing', stage: 'drawing' }), false);
  const state = f.state([], {
    phase: 'settlement',
    stage: 'witches',
    mine: { stopEvents: [{ id: 'manual-stop', at: 100000 }] },
  });
  f.cues.update(state, true);
  assert.deepEqual(
    f.calls.map((c) => c.cue),
    ['quacks-stop'],
  );
  f.calls[0].options.onStop();
  for (let i = 0; i < 4; i++) {
    f.tick(1000);
    f.cues.update(state, true);
  }
  assert.deepEqual(
    f.calls.map((c) => c.cue),
    ['quacks-stop'],
  );
  f.cues.update({ ...state, stage: 'bonus' }, true);
  assert.deepEqual(
    f.calls.map((c) => c.cue),
    ['quacks-stop', 'quacks-settlement'],
  );
  f.cues.destroy();
});
