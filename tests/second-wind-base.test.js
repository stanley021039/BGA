'use strict';
const test = require('node:test'),
  assert = require('node:assert/strict');
const { SecondWindGame } = require('../src/games/second-wind/game');
const { racers, baseRacers, allRacers, racerSet } = require('../src/games/second-wind/catalog');
const { effectivePowers } = require('../src/games/second-wind/powers');
const base = require('../src/games/second-wind/base-powers');
function fixture(ids) {
  const players = ids.map((_, i) => String.fromCharCode(97 + i));
  const g = new SecondWindGame({ playerIds: players, seed: 1, racerSet: 'mixed' });
  g.state = {
    selections: {},
    revision: 0,
    phase: 'racing',
    race: 1,
    players,
    first: players[0],
    turnId: players[0],
    teams: Object.fromEntries(players.map((p) => [p, []])),
    scores: Object.fromEntries(players.map((p) => [p, 0])),
    racers: ids.map((racerId, i) => ({
      id: 'r' + i,
      racerId,
      playerId: players[i],
      position: 0,
      tripped: false,
      finished: false,
      eliminated: false,
      copiedPowers: [],
      transformed: false,
    })),
    finished: [],
    eliminated: [],
    queue: [],
    pending: null,
    events: [],
    eventId: 0,
    results: [],
    reserve: ['legs', 'gunk', 'blimp'],
    persistent: [],
    trackId: 'twisty-twirl',
    direction: 1,
    twistUsed: true,
    twistEffects: [],
    twistHistory: [],
    twistDeck: [],
    coins: [],
    monster: null,
    fixed: {},
    seen: [],
    playerTurn: [],
    context: {
      actor: 'r0',
      dice: [2],
      total: 2,
      extra: false,
      critics: [],
      nemeses: [],
      recover: false,
      startPosition: 0,
      rollStyle: 'normal',
    },
  };
  return g;
}
function settle(g, select = () => null) {
  g.drain();
  let budget = 0;
  while (g.state.pending && g.state.phase === 'racing') {
    assert.ok(++budget < 80, 'bounded decision chain');
    const p = g.state.pending;
    const value =
      select(p, g) ??
      (
        p.options.find((o) => o.value === 'skip') ||
        p.options.find((o) => o.value === 'stop') ||
        p.options[0]
      ).value;
    g.act(p.playerId, { type: 'choice', choiceId: p.id, value }, g.state.revision);
  }
}
function roll(g, value) {
  g.state.context.dice = [value];
  g.state.context.total = value;
  g.mainResult();
}

test('base and Second Wind catalogs are separate complete rosters with a selectable 72-card union', () => {
  assert.equal(racers.length, 36);
  assert.equal(baseRacers.length, 36);
  assert.equal(allRacers.length, 72);
  assert.equal(new Set(allRacers.map((r) => r.id)).size, 72);
  assert.equal(racerSet('base'), baseRacers);
  assert.equal(racerSet('mixed'), allRacers);
  assert.equal(racerSet(), racers);
  assert.throws(() => racerSet('fan-made'), /牌庫/);
});
test('Alchemist, Blimp, Hare, Gunk, Coach and Party Animal modify main movement without rewriting the die', () => {
  const a = fixture(['alchemist', 'legs', 'blimp']);
  roll(a, 1);
  settle(a, (p) => (p.kind === 'base-alchemist' ? 'yes' : null));
  assert.equal(a.racer('r0').position, 4);
  assert.deepEqual(a.state.context.dice, [1]);
  const b = fixture(['blimp', 'legs', 'alchemist']);
  b.startPower(b.racer('r0'), 'blimp');
  b.performMain(b.racer('r0'), 2);
  settle(b);
  assert.equal(b.racer('r0').position, 5);
  const h = fixture(['hare', 'legs', 'alchemist']);
  h.performMain(h.racer('r0'), 2);
  settle(h);
  assert.equal(h.racer('r0').position, 4);
  const lead = fixture(['hare', 'legs', 'alchemist']);
  lead.racer('r0').position = 4;
  lead.startPower(lead.racer('r0'), 'hare');
  lead.main(lead.racer('r0'));
  settle(lead);
  assert.equal(lead.racer('r0').position, 4);
  const g = fixture(['legs', 'gunk', 'blimp']);
  g.performMain(g.racer('r0'), 2);
  settle(g);
  assert.equal(g.racer('r0').position, 1);
  const c = fixture(['legs', 'coach', 'blimp']);
  c.performMain(c.racer('r0'), 2);
  settle(c);
  assert.equal(c.racer('r0').position, 3);
  const p = fixture(['party-animal', 'legs', 'blimp']);
  p.performMain(p.racer('r0'), 2);
  settle(p);
  assert.equal(p.racer('r0').position, 4);
});
test('Cheerleader moves all tied last racers then herself; Hypnotist and Third Wheel warp without replacing main move', () => {
  const g = fixture(['cheerleader', 'legs', 'blimp']);
  g.racer('r0').position = 5;
  g.racer('r1').position = g.racer('r2').position = 1;
  g.startPower(g.racer('r0'), 'cheerleader');
  settle(g, (p) => (p.kind === 'base-cheer' ? 'yes' : null));
  assert.deepEqual(
    g.state.racers.map((r) => r.position),
    [6, 3, 3],
  );
  const h = fixture(['hypnotist', 'legs', 'blimp']);
  h.racer('r0').position = 5;
  h.startPower(h.racer('r0'), 'hypnotist');
  settle(h, (p) => (p.kind === 'base-hypnotist' ? 'r1' : null));
  assert.equal(h.racer('r1').position, 5);
  const t = fixture(['third-wheel', 'legs', 'blimp']);
  t.racer('r1').position = t.racer('r2').position = 4;
  t.startPower(t.racer('r0'), 'third-wheel');
  settle(t, (p) => (p.kind === 'base-third' ? '4' : null));
  assert.equal(t.racer('r0').position, 4);
});
test('Legs and Flip Flop replace the main roll; swapping is simultaneous and does not trigger Romantic', () => {
  const g = fixture(['legs', 'alchemist', 'blimp']);
  g.choose({ kind: 'main-mode', racer: 'r0' }, 'legs');
  settle(g);
  assert.equal(g.racer('r0').position, 5);
  assert.equal(
    g.state.events.some((e) => e.type === 'die'),
    false,
  );
  const f = fixture(['flip-flop', 'legs', 'romantic']);
  f.racer('r0').position = 2;
  f.racer('r1').position = 5;
  f.racer('r2').position = 8;
  f.choose({ kind: 'main-mode', racer: 'r0' }, 'flip-flop');
  settle(f, (p) => (p.kind === 'base-flip' ? 'r1' : null));
  assert.deepEqual(
    f.state.racers.map((r) => r.position),
    [5, 2, 8],
  );
});
test('Rocket Scientist doubles after the roll and trips; Sisyphus grants four once and loses at most one on a six', () => {
  const g = fixture(['rocket-scientist', 'legs', 'blimp']);
  roll(g, 3);
  settle(g, (p) => (p.kind === 'base-rocket' ? 'yes' : null));
  assert.equal(g.racer('r0').position, 6);
  assert.equal(g.racer('r0').tripped, true);
  const s = fixture(['sisyphus', 'legs', 'blimp']);
  s.setup(s.racer('r0'));
  s.setup(s.racer('r0'));
  assert.equal(s.state.scores.a, 4);
  s.racer('r0').position = 8;
  roll(s, 6);
  settle(s);
  assert.equal(s.racer('r0').position, 0);
  assert.equal(s.state.scores.a, 3);
  const zero = fixture(['sisyphus', 'legs', 'blimp']);
  roll(zero, 6);
  settle(zero);
  assert.equal(zero.state.scores.a, 0);
});
test('Banana trips passers while Centaur pushes passed racers back with a start boundary', () => {
  const b = fixture(['legs', 'banana', 'blimp']);
  b.racer('r1').position = 2;
  b.move(b.racer('r0'), 5);
  settle(b);
  assert.equal(b.racer('r0').position, 5);
  assert.equal(b.racer('r0').tripped, true);
  const c = fixture(['centaur', 'legs', 'blimp']);
  c.racer('r1').position = 2;
  c.racer('r2').position = 3;
  c.move(c.racer('r0'), 5);
  settle(c);
  assert.deepEqual(
    c.state.racers.map((r) => r.position),
    [5, 0, 1],
  );
});
test('Leaptoad skips occupied spaces in both directions; Stickler rejects overshoots by opponents only', () => {
  const f = fixture(['leaptoad', 'legs', 'blimp']);
  f.racer('r1').position = 1;
  f.racer('r2').position = 2;
  f.move(f.racer('r0'), 2);
  settle(f);
  assert.equal(f.racer('r0').position, 4);
  const b = fixture(['leaptoad', 'legs', 'blimp']);
  b.racer('r0').position = 5;
  b.racer('r1').position = 4;
  b.racer('r2').position = 3;
  b.move(b.racer('r0'), -2);
  settle(b);
  assert.equal(b.racer('r0').position, 1);
  const s = fixture(['legs', 'stickler', 'blimp']);
  s.move(s.racer('r0'), 31);
  settle(s);
  assert.equal(s.racer('r0').position, 0);
  const own = fixture(['stickler', 'legs', 'blimp']);
  own.racer('r0').position = 28;
  own.move(own.racer('r0'), 5);
  settle(own);
  assert.equal(own.racer('r0').finished, true);
});
test('Baba Yaga trips on either landing direction; MOUTH eliminates only when exactly one opponent shares the stop', () => {
  const b = fixture(['baba-yaga', 'legs', 'blimp']);
  b.racer('r1').position = 3;
  b.move(b.racer('r0'), 3);
  settle(b);
  assert.equal(b.racer('r1').tripped, true);
  const other = fixture(['legs', 'baba-yaga', 'blimp']);
  other.racer('r1').position = 3;
  other.move(other.racer('r0'), 3);
  settle(other);
  assert.equal(other.racer('r0').tripped, true);
  const mouth = fixture(['mouth', 'legs', 'blimp']);
  mouth.racer('r1').position = 3;
  mouth.move(mouth.racer('r0'), 3);
  settle(mouth);
  assert.equal(mouth.racer('r1').eliminated, true);
  const crowded = fixture(['mouth', 'legs', 'blimp']);
  crowded.racer('r1').position = crowded.racer('r2').position = 3;
  crowded.move(crowded.racer('r0'), 3);
  settle(crowded);
  assert.equal(crowded.state.eliminated.length, 0);
});
test('Huge Baby displaces arrivals as stops rather than movements and stays shareable on Start', () => {
  const g = fixture(['legs', 'huge-baby', 'blimp']);
  g.racer('r1').position = 5;
  g.move(g.racer('r0'), 5);
  settle(g);
  assert.equal(g.racer('r0').position, 4);
  assert.equal(g.state.events.filter((e) => e.type === 'move' && e.racer === 'r0').length, 1);
  const start = fixture(['legs', 'huge-baby', 'blimp']);
  start.racer('r0').position = 2;
  start.move(start.racer('r0'), -2);
  settle(start);
  assert.equal(start.racer('r0').position, 0);
});
test('Duelist resolves two non-main dice and wins ties even while tripped by Baba Yaga', () => {
  const g = fixture(['duelist', 'baba-yaga', 'blimp']);
  g.racer('r1').position = 3;
  g.state.fixed = { a: 4, b: 4 };
  g.move(g.racer('r0'), 3);
  settle(g, (p) => (p.kind === 'base-duel' ? 'yes' : null));
  assert.equal(g.racer('r0').position, 5);
  assert.equal(g.racer('r0').tripped, true);
  assert.equal(g.state.events.filter((e) => e.type === 'die').length, 2);
});
test('Loveable Loser awards only a unique last racer and Heckler checks the entire turn displacement', () => {
  const l = fixture(['loveable-loser', 'legs', 'blimp']);
  l.racer('r1').position = l.racer('r2').position = 3;
  l.startPower(l.racer('r0'), 'loveable-loser');
  settle(l);
  assert.equal(l.state.scores.a, 1);
  const tied = fixture(['loveable-loser', 'legs', 'blimp']);
  tied.startPower(tied.racer('r0'), 'loveable-loser');
  settle(tied);
  assert.equal(tied.state.scores.a, 0);
  const h = fixture(['legs', 'heckler', 'blimp']);
  h.racer('r0').position = 1;
  h.endRacer(h.racer('r0'));
  settle(h);
  assert.equal(h.racer('r1').position, 2);
});
test('Lackey reacts to a committed six before main movement; Inchworm cancels a one and Skipper takes the next seat', () => {
  const l = fixture(['legs', 'lackey', 'blimp']);
  roll(l, 6);
  settle(l);
  assert.equal(l.racer('r1').position, 2);
  const moves = l.state.events.filter((e) => e.type === 'move');
  assert.equal(moves[0].racer, 'r1');
  const w = fixture(['legs', 'inchworm', 'skipper']);
  roll(w, 1);
  settle(w);
  assert.equal(w.racer('r0').position, 0);
  assert.equal(w.racer('r1').position, 1);
  assert.equal(w.state.skipperNext, 'r2');
  w.nextPlayer(0);
  assert.equal(w.state.turnId, 'c');
});
test('Magician permits at most two rerolls and Scoocher reacts even to unused rerolls; Dicemonger permits one', () => {
  const m = fixture(['magician', 'scoocher', 'blimp']);
  m.state.fixed.a = 5;
  m.reviewRoll();
  settle(m, (p) => (p.kind === 'base-reroll' ? 'yes' : null));
  assert.equal(m.state.context.magicianRerolls, 2);
  assert.equal(m.racer('r1').position, 2);
  assert.deepEqual(m.state.context.dice, [5]);
  const d = fixture(['legs', 'dicemonger', 'blimp']);
  d.state.fixed.a = 4;
  d.reviewRoll();
  settle(d, (p) => (p.kind === 'base-reroll' ? 'yes' : null));
  assert.equal(d.state.context.dealerUsed, true);
  assert.equal(d.racer('r1').position, 1);
  assert.equal(d.racer('r0').position, 4);
});
test('Genius marks a correct prediction for an extra turn; a Skipper handoff overrides it', () => {
  const g = fixture(['genius', 'legs', 'skipper']);
  g.startPower(g.racer('r0'), 'genius');
  settle(g, (p) => (p.kind === 'base-genius' ? '1' : null));
  roll(g, 1);
  settle(g);
  assert.equal(g.state.context.extra, true);
  g.run({ kind: 'extra-or-next', racer: 'r0' });
  settle(g);
  assert.equal(g.state.turnId, 'c');
});
test('Egg chooses only its three drawn cards and Twin can reuse a previous winner including before-race powers', () => {
  const e = fixture(['egg', 'legs', 'blimp']);
  e.setup(e.racer('r0'));
  assert.deepEqual(
    e.state.pending.options.map((o) => o.value),
    ['legs', 'gunk', 'blimp'],
  );
  assert.throws(
    () => e.act('a', { type: 'choice', choiceId: e.state.pending.id, value: 'centaur' }, 0),
    /選項/,
  );
  settle(e, (p) => (p.kind === 'base-egg' ? 'legs' : null));
  assert.ok(e.racer('r0').copiedPowers.includes('legs'));
  assert.equal(e.state.reserve.length, 0);
  const t = fixture(['twin', 'legs', 'blimp']);
  t.state.results = [{ ranking: [{ racerId: 'sisyphus', rank: 1 }] }];
  t.setup(t.racer('r0'));
  settle(t, (p) => (p.kind === 'base-twin' ? 'sisyphus' : null));
  assert.ok(t.racer('r0').copiedPowers.includes('sisyphus'));
  assert.equal(t.state.scores.a, 4);
});
test('Mastermind ends the race as silver and may receive both first and second when predicting itself', () => {
  for (const winner of ['r0', 'r1']) {
    const g = fixture(['mastermind', 'legs', 'blimp']);
    g.startPower(g.racer('r0'), 'mastermind');
    settle(g, (p) => (p.kind === 'base-mastermind' ? winner : null));
    g.racer(winner).position = 29;
    g.move(g.racer(winner), 1);
    settle(g);
    assert.equal(g.state.phase, 'race-result');
    assert.equal(g.state.results[0].ranking[1].playerId, 'a');
    if (winner === 'r0') assert.equal(g.state.scores.a, 4);
  }
});
test('Copy Cat follows the current lead dynamically, chooses ties, avoids copy loops, and does not gain setup bonuses', () => {
  const g = fixture(['copy-cat', 'gunk', 'legs']);
  g.racer('r1').position = 5;
  g.racer('r2').position = 3;
  base.prepare(g, { kind: 'main' });
  assert.ok(g.powers(g.racer('r0')).includes('gunk'));
  g.racer('r2').position = 6;
  base.prepare(g, { kind: 'main' });
  assert.ok(g.powers(g.racer('r0')).includes('legs'));
  const tie = fixture(['copy-cat', 'sisyphus', 'legs']);
  tie.racer('r1').position = tie.racer('r2').position = 5;
  base.prepare(tie, { kind: 'base-end', racer: 'r0' });
  assert.equal(tie.state.pending.kind, 'base-copy');
  settle(tie, (p) => (p.kind === 'base-copy' ? 'r1' : null));
  tie.setup(tie.racer('r0'));
  assert.equal(tie.state.scores.a, 0);
  const cyc = fixture(['copy-cat', 'copy-cat', 'legs']);
  cyc.racer('r0').copyTarget = 'r1';
  cyc.racer('r1').copyTarget = 'r0';
  assert.ok(effectivePowers(cyc.state.racers, 'r0').length <= 2);
});
test('Suckerfish follows the full movement after its source, can finish second, and does not create a Romantic stop', () => {
  const g = fixture(['legs', 'suckerfish', 'romantic']);
  g.racer('r2').position = 7;
  g.move(g.racer('r0'), 3);
  settle(g, (p) => (p.kind === 'base-follow' ? 'yes' : null));
  assert.deepEqual(
    g.state.racers.map((r) => r.position),
    [3, 3, 7],
  );
  const finish = fixture(['legs', 'suckerfish', 'blimp']);
  finish.move(finish.racer('r0'), 30);
  settle(finish, (p) => (p.kind === 'base-follow' ? 'yes' : null));
  assert.deepEqual(
    finish.state.results[0].ranking.map((r) => r.playerId),
    ['a', 'b'],
  );
});
test('Scoocher observes base passive modifiers and copied-Scoocher feedback remains bounded', () => {
  const g = fixture(['legs', 'gunk', 'scoocher']);
  g.performMain(g.racer('r0'), 2);
  settle(g);
  assert.equal(g.racer('r2').position, 1);
  const cyc = fixture(['scoocher', 'scoocher', 'gunk']);
  base.effect(cyc, cyc.racer('r2'), 'gunk');
  settle(cyc);
  assert.equal(cyc.state.pending, null);
  assert.ok(cyc.state.events.some((e) => e.type === 'loop'));
  assert.ok(cyc.state.racers.every((r) => r.position <= 3));
});

test('Leaptoad still obeys Stickler after skipping an occupied final approach', () => {
  const g = fixture(['leaptoad', 'stickler', 'legs']);
  g.racer('r0').position = 27;
  g.racer('r2').position = 28;
  g.move(g.racer('r0'), 3);
  settle(g);
  assert.equal(g.racer('r0').position, 27);
});
test('Scoocher and Suckerfish can repeatedly follow to the finish rather than being cut off as a loop', () => {
  const g = fixture(['scoocher', 'suckerfish', 'gunk']);
  g.racer('r0').position = g.racer('r1').position = 24;
  base.effect(g, g.racer('r2'), 'gunk');
  settle(g, (p) => (p.kind === 'base-follow' ? 'yes' : null));
  assert.equal(g.state.phase, 'race-result');
  assert.deepEqual(
    g.state.results[0].ranking.map((r) => r.playerId),
    ['a', 'b'],
  );
});
