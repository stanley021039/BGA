'use strict';
const test = require('node:test'),
  assert = require('node:assert/strict');
const { SecondWindGame } = require('../src/games/second-wind/game');
const { racers, twists } = require('../src/games/second-wind/catalog');
function fixture(ids = ['gloth', 'mole', 'nepo-baby']) {
  const g = new SecondWindGame({ playerIds: ['a', 'b', 'c'], seed: 1 });
  // Build through the real recruiting API, then replace only race fixture data.
  while (!g.state) {
    const v = g.view('a');
    let id, action;
    if (['draft-rolloff', 'race-rolloff'].includes(v.phase)) {
      id = v.players.find((p) => !Object.hasOwn(v.rolls, p));
      action = { type: 'roll' };
    } else if (v.phase === 'drafting') {
      id = v.turnId;
      action = { type: 'draft', racerId: v.market[0] };
    } else {
      id = v.players.find((p) => !v.selectedIds.includes(p));
      action = { type: 'select', racerId: v.teams[id][0] };
    }
    g.act(id, action, v.revision);
  }
  const s = g.state;
  s.phase = 'racing';
  s.race = 1;
  s.first = 'a';
  s.turnId = 'a';
  s.queue = [];
  s.pending = null;
  s.finished = [];
  s.eliminated = [];
  s.events = [];
  s.scores = { a: 0, b: 0, c: 0 };
  s.persistent = [];
  s.twistEffects = [];
  s.twistHistory = [];
  s.coins = [];
  s.monster = null;
  s.direction = 1;
  s.fixed = {};
  s.seen = [];
  s.doppelDone = false;
  s.trackId = 'whirly-world';
  s.racers = ids.map((racerId, i) => ({
    id: 'r' + i,
    racerId,
    playerId: s.players[i],
    position: 0,
    tripped: false,
    finished: false,
    eliminated: false,
    copiedPowers: [],
    transformed: false,
  }));
  s.context = {
    actor: 'r0',
    dice: [2],
    total: 2,
    extra: false,
    critics: [],
    nemeses: [],
    recover: false,
  };
  return g;
}
test('Whirl traverses a pair once and leaves the racer at its destination', () => {
  const g = fixture();
  g.move(g.racer('r0'), 4);
  g.drain();
  assert.equal(g.racer('r0').position, 6);
});
test('simultaneous warp does not charge Hotel while a single arrival does', () => {
  const g = fixture(['mole', 'hotel', 'gloth']);
  g.state.racers.forEach((r) => (r.position = 2));
  g.racer('r0').position = 0;
  g.state.scores.a = 2;
  g.warp({ r0: 2, r2: 2 });
  g.drain();
  assert.equal(g.state.scores.a, 2);
  g.state.seen = [];
  g.racer('r0').position = 0;
  g.warp({ r0: 2 });
  g.drain();
  assert.equal(g.state.scores.a, 1);
  assert.equal(g.state.scores.b, 1);
});
test('Stunner affects every die; mandatory Party Pooper reactions precede replacement rolls', () => {
  const g = fixture(['icarus', 'stunner', 'party-pooper']);
  g.racer('r1').position = 8;
  g.state.fixed.a = 6;
  g.run({ kind: 'die', racer: 'r0', purpose: 'main' });
  assert.equal(g.state.queue[0].kind, 'move');
  assert.equal(g.state.queue[0].racer, 'r2');
  g.state.queue = [];
  g.racer('r1').position = 0;
  g.run({ kind: 'die', racer: 'r0', purpose: 'hose' });
  assert.equal(g.state.queue[0].value, 1);
});
test('Icarus eliminates only after a final six; trip recovery skips a normal main move', () => {
  const g = fixture(['icarus', 'mole', 'gloth']);
  g.state.context.dice = [6];
  g.mainResult();
  assert.equal(g.racer('r0').eliminated, true);
  const h = fixture();
  h.racer('r0').tripped = true;
  h.main(h.racer('r0'));
  assert.equal(h.racer('r0').tripped, false);
  assert.equal(h.state.queue.length, 0);
});
test('Penguin doubles a tripped roll and recovers after main move', () => {
  const g = fixture(['penguin', 'mole', 'gloth']);
  g.racer('r0').tripped = true;
  g.state.context.recover = true;
  g.performMain(g.racer('r0'), 3);
  assert.equal(g.state.queue[0].distance, 6);
  g.state.queue = [];
  g.endRacer(g.racer('r0'));
  assert.equal(g.racer('r0').tripped, false);
});
test('Bite Mark cannot eliminate NULL when passing it, Streaker only scores once per movement', () => {
  const g = fixture(['bite-mark', 'null', 'gloth']);
  g.racer('r0').transformed = true;
  g.racer('r1').position = 2;
  g.racer('r2').position = 3;
  g.move(g.racer('r0'), 7);
  assert.equal(g.racer('r1').eliminated, false);
  assert.equal(g.racer('r2').eliminated, false);
  const h = fixture(['streaker', 'mole', 'gloth']);
  h.racer('r1').position = 2;
  h.racer('r2').position = 3;
  h.move(h.racer('r0'), 7);
  assert.equal(h.state.scores.a, 1);
});
test('Doppelgangster eliminates the first finisher and does not grant first place points', () => {
  const g = fixture(['mole', 'doppelgangster', 'gloth']);
  g.racer('r0').position = 30;
  g.finishRacer(g.racer('r0'));
  assert.equal(g.state.finished.length, 0);
  assert.equal(g.racer('r0').eliminated, true);
  assert.ok(g.racer('r1').copiedPowers.includes('mole'));
  assert.equal(g.state.scores.a, 0);
});
test('Hog can change rider; Soulmate and Tail warp without consuming the main move', () => {
  const g = fixture(['hog-knight', 'soulmate', 'tail']);
  g.setup(g.racer('r0'));
  assert.equal(g.racer('r0').hogs, 1);
  g.racer('r0').position = 2;
  g.warp({ r1: 2 });
  g.drain();
  assert.equal(g.racer('r1').hogs, 1);
  assert.equal(g.racer('r0').hogs, 0);
  g.racer('r1').soulmate = 'r0';
  g.racer('r0').position = 5;
  g.startPower(g.racer('r1'), 'soulmate');
  g.drain();
  assert.equal(g.racer('r1').position, 5);
  g.startPower(g.racer('r2'), 'tail');
  assert.equal(g.state.pending.kind, 'tail');
});
test('Understudy copies a before-race power but Re-Runner extras require the original card', () => {
  const g = fixture(['understudy', 'hog-knight', 'gloth']);
  g.setup(g.racer('r0'));
  g.choose(g.state.pending, 'r1');
  g.state.pending = null;
  g.drain();
  assert.equal(g.racer('r0').hogs, 1);
  const h = fixture(['understudy', 're-runner', 'gloth']);
  h.racer('r0').copiedPowers = ['re-runner'];
  h.endRace('fixture');
  assert.equal(h.state.persistent.length, 1);
  assert.equal(h.state.persistent[0].racerId, 're-runner');
});
test('Cheatah secret number and Swap Meet offers never appear in another player view', () => {
  const g = fixture(['cheatah', 'mole', 'gloth']);
  g.choose({ kind: 'cheatah-secret', racer: 'r0' }, '5');
  assert.equal(g.state.secretNumber, 5);
  for (const id of ['a', 'b', 'c']) {
    const v = g.view(id);
    assert.equal('secretNumber' in v, false);
    assert.equal('swapOffers' in v, false);
  }
  assert.equal(g.view('b').pending.options.length, 0);
});
test('Switcharoo exchanges owners and preserves Mush accumulated powers', () => {
  const g = fixture(['switcharoo', 'mush', 'gloth']);
  g.racer('r1').copiedPowers = ['icarus'];
  g.choose({ kind: 'control', racer: 'r0' }, 'r1');
  assert.equal(g.racer('r0').playerId, 'b');
  assert.equal(g.racer('r1').playerId, 'a');
  assert.deepEqual(g.racer('r1').copiedPowers, ['icarus']);
});
test('Speed Demon, Spoilsport and Gloth apply their race outcome rules', () => {
  const g = fixture(['speed-demon', 'mole', 'gloth']);
  g.racer('r0').position = 8;
  g.startPower(g.racer('r0'), 'speed-demon');
  assert.equal(g.racer('r0').eliminated, true);
  const h = fixture(['spoilsport', 'mole', 'gloth']);
  h.racer('r1').position = 10;
  h.racer('r2').position = 10;
  h.startPower(h.racer('r0'), 'spoilsport');
  assert.equal(h.state.phase, 'race-result');
  assert.equal(h.state.scores.a, 3);
  assert.equal(h.state.scores.c, 3);
});
test('Show-Off bust does not move; Mr Dice Guy offers only duplicated numbers', () => {
  const g = fixture(['show-off', 'mole', 'gloth']);
  g.state.context.dice = [4];
  g.dieResult({ purpose: 'show-off', racer: 'r0', value: 3 });
  g.drain();
  assert.equal(g.racer('r0').position, 0);
  const h = fixture(['mr-dice-guy', 'mole', 'gloth']);
  h.state.context.dice = [1, 2, 2, 4, 5, 5];
  h.reviewRoll();
  assert.deepEqual(
    h.state.pending.options.map((o) => o.value),
    ['2', '5'],
  );
});
test('Kingtripper tied leaders require a choice, Kraken moves simultaneously and is once per race', () => {
  const g = fixture(['kingtripper', 'mole', 'gloth']);
  g.racer('r1').position = 5;
  g.racer('r2').position = 5;
  g.startPower(g.racer('r0'), 'kingtripper');
  assert.equal(g.state.pending.options.length, 3);
  const h = fixture(['kraken', 'hotel', 'gloth']);
  h.state.scores.b = 3;
  h.choose({ kind: 'kraken', racer: 'r0' }, 'yes');
  h.drain();
  assert.equal(h.racer('r0').krakenUsed, true);
  assert.equal(h.racer('r1').tripped, true);
  assert.equal(h.state.scores.b, 3);
});
for (const card of twists)
  test('Twist ' + card.id + ' produces its concrete effect', () => {
    const g = fixture(),
      s = g.state;
    s.racers.forEach((r, i) => (r.position = 2 + i * 3));
    g.applyTwist(card.id, 'r0');
    assert.ok(s.twistHistory.includes(card.id));
    if (['bonkbug', 'curse-wands', 'conveyor', 'scrying-pool', 'season-finale'].includes(card.id))
      assert.ok(s.twistEffects.includes(card.id));
    if (card.id === 'mirror-world') assert.equal(s.direction, -1);
    if (card.id === 'pinata') assert.equal(s.coins.length, 17);
    if (card.id === 'alchemy-lab') assert.equal(s.monster, 0);
    if (card.id === 'fans-demand-chaos') assert.equal(s.queue.length, 2);
    if (card.id === 'conveyor') assert.equal(s.queue[0].kind, 'warp');
    if (card.id === 'time-imp') {
      assert.equal(g.racer('r0').eliminated, true);
      assert.equal(s.persistent.length, 1);
    }
    if (card.id === 'randomness-ceased')
      assert.equal(s.queue.filter((o) => o.purpose === 'fixed').length, 3);
    if (card.id === 'roast-chicken') assert.equal(s.queue[0].distance, 7);
    if (card.id === 'swap-meet') {
      assert.equal(s.pending.kind, 'swap-meet');
      assert.equal(Object.keys(s.swapOffers).length, 3);
    }
  });
test('Understudy may copy another racer controlled by its own player', () => {
  const g = fixture(['understudy', 'hog-knight', 'gloth']);
  g.racer('r1').playerId = 'a';
  g.setup(g.racer('r0'));
  assert.ok(g.state.pending.options.some((option) => option.value === 'r1'));
});
test('all 36 catalog racers are distinct and each retains source and timing information', () => {
  assert.equal(racers.length, 36);
  assert.equal(new Set(racers.map((r) => r.id)).size, 36);
  for (const r of racers) {
    assert.match(r.source, /pdf-page/);
    assert.ok(r.trigger && r.summary);
  }
});
test('Blunderdog reverses the entire modified move and Saboteur cancels a second reversal', () => {
  const g = fixture(['blunderdog', 'stepdad', 'gloth']);
  g.racer('r0').position = 10;
  g.racer('r1').position = 0;
  g.racer('r2').position = 0;
  // Stepdad sits immediately before the actor in the fixture's clockwise order.
  g.racer('r2').racerId = 'stepdad';
  g.performMain(g.racer('r0'), 3);
  assert.equal(g.state.queue[0].distance, -5);
  const h = fixture(['blunderdog', 'le-saboteur', 'gloth']);
  h.racer('r0').position = 10;
  h.state.context.dice = [3];
  h.performMain(h.racer('r0'), 3);
  assert.equal(h.state.queue[0].distance, 3);
});
test('Overtaker counts active racers ahead, Hopfrog gives an extra turn and Hose only trips racers ahead', () => {
  const g = fixture(['overtaker', 'mole', 'gloth']);
  g.racer('r1').position = 2;
  g.racer('r2').position = 5;
  g.performMain(g.racer('r0'), 2);
  assert.equal(g.state.queue[0].distance, 4);
  const h = fixture(['hopfrog', 'mole', 'gloth']);
  h.racer('r1').position = 1;
  h.endPower(h.racer('r0'), 'hopfrog');
  assert.equal(h.state.context.extra, true);
  const k = fixture(['the-hose', 'mole', 'gloth']);
  k.racer('r1').position = 2;
  k.racer('r2').position = 6;
  k.dieResult({ racer: 'r0', purpose: 'hose', value: 3 });
  assert.deepEqual(k.state.queue, [{ kind: 'trip', racer: 'r1' }]);
});
test('Mush obtains its new power before moving, Nepo Baby starts at first corner', () => {
  const g = fixture(['mush', 'mole', 'gloth']);
  g.state.reserve = ['icarus'];
  g.state.context.dice = [1];
  g.state.context.total = 1;
  g.mainResult();
  assert.deepEqual(g.racer('r0').copiedPowers, ['icarus']);
  assert.equal(g.state.queue[0].distance, 4);
  const h = fixture(['nepo-baby', 'mole', 'gloth']);
  h.setup(h.racer('r0'));
  assert.equal(h.racer('r0').position, 12);
});
test('Critic offers an optional reroll to its owner before main result, Nemesis follows dice rather than modified distance', () => {
  const g = fixture(['icarus', 'critic', 'nemesis']);
  g.racer('r0').position = 5;
  g.reviewRoll();
  assert.equal(g.state.pending.playerId, 'b');
  assert.equal(g.state.pending.kind, 'critic');
  const h = fixture(['icarus', 'nemesis', 'gloth']);
  h.state.context.dice = [2];
  h.state.context.total = 5;
  h.run({ kind: 'nemesis-move', racer: 'r1', value: 2 });
  assert.equal(h.state.queue[0].distance, 2);
});
test('Magical Athlete applies alternate movement results and Season Finale awards the pooled prize to the winner', () => {
  const g = fixture(['magical-athlete', 'mole', 'gloth']);
  g.state.context.dice = [4];
  g.mainResult();
  assert.equal(g.state.context.extra, true);
  assert.equal(g.state.queue[0].distance, 4);
  const h = fixture(['mole', 'nepo-baby', 'gloth']);
  h.state.twistEffects = ['season-finale'];
  h.racer('r0').position = 30;
  h.finishRacer(h.racer('r0'));
  h.racer('r1').position = 30;
  h.finishRacer(h.racer('r1'));
  assert.equal(h.state.finale, true);
  assert.equal(h.racer('r0').position, 15);
  assert.equal(h.state.phase, 'racing');
  h.racer('r1').position = 30;
  h.finishRacer(h.racer('r1'));
  assert.equal(h.state.scores.b, 4);
  assert.equal(h.state.scores.a, 0);
});
test('fixed-die repeated states ask for a ruling rather than silently inventing a winner', () => {
  const g = fixture();
  g.state.fixed = { a: 1, b: 2, c: 3 };
  g.state.loopStates = [];
  for (let i = 0; i < 3; i++) {
    g.state.queue = [];
    g.beginPlayerTurn();
  }
  assert.equal(g.state.pending.kind, 'deadlock');
  assert.equal(g.state.pending.playerId, 'a');
  g.choose(g.state.pending, 'end');
  assert.equal(g.state.phase, 'race-result');
  assert.equal(g.state.results[0].ranking.length, 0);
  // Points earned inside the loop (e.g. Loveable Loser each lap) must not mask it.
  const h = fixture();
  h.state.fixed = { a: 1, b: 2, c: 3 };
  h.state.loopStates = [];
  for (let i = 0; i < 3; i++) {
    h.state.queue = [];
    h.state.scores.c = (h.state.scores.c || 0) + 2;
    h.beginPlayerTurn();
  }
  assert.equal(h.state.pending.kind, 'deadlock');
});
test('the chain budget spans a whole player turn, so answered choices cannot restart it', () => {
  // A forced Hopfrog extra turn that rolls 1 asks Critic every lap; each answer
  // resumes the chain in a new drain, which used to reset a per-call budget.
  const g = fixture();
  const noop = { kind: 'end-power', racer: 'missing', power: 'none' };
  g.state.chainSteps = 0;
  g.state.queue = [noop];
  g.drain();
  assert.equal(g.state.chainSteps, 1);
  g.state.chainSteps = 256;
  g.state.queue = [noop];
  g.drain();
  assert.equal(g.state.pending.kind, 'ruling');
  g.state.pending = null;
  g.state.queue = [];
  g.beginPlayerTurn(false);
  assert.equal(g.state.chainSteps, 0);
});
test('Curse Wands counts extra and eliminated racers, and eliminated racers still roll', () => {
  const g = fixture();
  g.state.twistEffects = ['curse-wands'];
  g.state.racers.push({ ...structuredClone(g.racer('r0')), id: 'r3', racerId: 're-runner' });
  g.nextPlayer(0);
  assert.equal(g.state.nextRacerId, 'r3');
  g.state.context = { actor: 'r0' };
  g.racer('r1').eliminated = true;
  g.state.fixed.b = 2;
  g.nextPlayer(1);
  assert.equal(g.state.turnId, 'b');
  g.drain();
  assert.equal(g.state.nextRacerId, 'r3');
  assert.ok(g.state.events.some((e) => e.purpose === 'curse' && e.value === 2));
});
