'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { racers, twists, tracks, raceAwards } = require('../src/games/second-wind/catalog');
const { SecondWindDraft, rolloffWinner } = require('../src/games/second-wind/draft');
const {
  motion,
  simultaneousWarp,
  ResolutionChain,
  triggerOrder,
  mainMovePlan,
} = require('../src/games/second-wind/motion');
const {
  effectivePowers,
  rollConstraints,
  mandatoryDieStep,
} = require('../src/games/second-wind/powers');

const ids = ['one', 'two', 'three'];
const make = (playerIds = ids, seed = 1) => new SecondWindDraft({ playerIds, seed });
function act(game, id, action) {
  return game.act(id, action, game.view(id).revision);
}
function rolloff(game, playerIds = ids) {
  let rounds = 0;
  while (game.view(playerIds[0]).phase.endsWith('rolloff')) {
    assert.ok(rounds++ < 100, 'rolloff must resolve for these deterministic seeds');
    for (const id of playerIds) {
      const view = game.view(id);
      if (view.phase.endsWith('rolloff') && view.rolls[id] === undefined)
        act(game, id, { type: 'roll' });
    }
  }
}
function recruit(game, playerIds = ids) {
  rolloff(game, playerIds);
  while (game.view(playerIds[0]).phase === 'drafting') {
    const view = game.view(playerIds[0]);
    act(game, view.turnId, { type: 'draft', racerId: view.market[0] });
  }
  rolloff(game, playerIds);
}

test('Second Wind catalog records 36 original racers and 13 Twist effects with candidate implementation status and original-source awards', () => {
  assert.equal(racers.length, 36);
  assert.equal(twists.length, 13);
  assert.equal(new Set(racers.map((racer) => racer.id)).size, 36);
  assert.equal(new Set(twists.map((twist) => twist.id)).size, 13);
  for (const entry of [...racers, ...twists]) {
    assert.match(entry.source, /^user-rulebook:pdf-page-2[4-9]$/);
    assert.equal(entry.implementation, 'candidate');
    assert.ok(entry.summary.length > 10);
  }
  assert.deepEqual(
    raceAwards.map((award) => award && [award.first, award.second]),
    [[3, 1], null, null, null],
  );
  const portals = tracks['whirly-world'].portals.flat();
  assert.equal(portals.length, 12);
  assert.equal(new Set(portals).size, 12);
  assert.ok(portals.every((space) => space > 0 && space < 30));
  assert.deepEqual(tracks['twisty-twirl'].corners, [12, 15]);
});

test('rolloff discards tied values, accepts the next unique value and repeats when none exists', () => {
  assert.equal(rolloffWinner(ids, { one: 6, two: 6, three: 4 }), 'three');
  assert.equal(rolloffWinner(ids, { one: 2, two: 2, three: 2 }), null);
  assert.equal(rolloffWinner(['a', 'b', 'c', 'd'], { a: 6, b: 6, c: 4, d: 4 }), null);
  assert.equal(rolloffWinner(ids, { one: 1, two: 5, three: 3 }), 'two');
});

test('two snake drafts rotate the second starting seat and everyone recruits four distinct racers', () => {
  for (const count of [3, 4, 5, 6]) {
    const players = Array.from({ length: count }, (_, i) => 'player' + i),
      game = make(players);
    rolloff(game, players);
    let view = game.view(players[0]);
    const first = view.draftFirst,
      index = players.indexOf(first),
      order = [...players.slice(index), ...players.slice(0, index)];
    assert.deepEqual(view.draftOrder, [...order, ...order.toReversed()]);
    for (let i = 0; i < count * 2; i++) {
      view = game.view(players[0]);
      act(game, view.turnId, { type: 'draft', racerId: view.market[0] });
    }
    view = game.view(players[0]);
    assert.equal(view.draftRound, 2);
    assert.equal(view.turnId, players[(index + 1) % count]);
    const second = [...order.slice(1), order[0]];
    assert.deepEqual(view.draftOrder, [...second, ...second.toReversed()]);
    while (game.view(players[0]).phase === 'drafting') {
      view = game.view(players[0]);
      act(game, view.turnId, { type: 'draft', racerId: view.market[0] });
    }
    view = game.view(players[0]);
    assert.equal(view.phase, 'race-rolloff');
    assert.equal(view.remainingRacers, 36 - 4 * count);
    assert.ok(Object.values(view.teams).every((team) => team.length === 4));
    assert.equal(new Set(Object.values(view.teams).flat()).size, count * 4);
  }
});

test('secret selection locks without exposing other choices and reveals simultaneously in race order', () => {
  const game = make();
  recruit(game);
  const selected = game.view('one').teams.one[0];
  act(game, 'one', { type: 'select', racerId: selected });
  assert.equal(game.view('one').ownSelection, selected);
  for (const id of ['two', 'three']) {
    const view = game.view(id);
    assert.equal(view.ownSelection, null);
    assert.equal(view.lineup, null);
    assert.deepEqual(view.selectedIds, ['one']);
    assert.deepEqual(view.events.at(-1), {
      id: view.events.at(-1).id,
      type: 'selection-locked',
      playerId: 'one',
    });
    assert.equal(view.selections, undefined);
  }
  assert.throws(() => act(game, 'one', { type: 'select', racerId: selected }), {
    code: 'SELECTION_LOCKED',
  });
  for (const id of ['two', 'three'])
    act(game, id, { type: 'select', racerId: game.view(id).teams[id][1] });
  const view = game.view('one');
  assert.equal(view.phase, 'race-ready');
  assert.equal(view.lineup[0].playerId, view.raceFirst);
  assert.equal(view.lineup.find((racer) => racer.playerId === 'one').racerId, selected);
  assert.throws(() => act(game, 'one', { type: 'roll' }), { code: 'INVALID_PHASE' });
});

test('invalid/stale/out-of-turn operations preserve revision, deck, rolls and future randomness', () => {
  const game = make(),
    control = make();
  assert.throws(() => game.act('outsider', { type: 'roll' }, 0), { code: 'NOT_SEATED' });
  assert.throws(() => game.act('one', { type: 'roll' }, 8), { code: 'STALE_REVISION' });
  assert.throws(() => game.act('one', { type: 'draft', racerId: 'icarus' }, 0), {
    code: 'INVALID_PHASE',
  });
  act(game, 'one', { type: 'roll' });
  act(control, 'one', { type: 'roll' });
  assert.throws(() => act(game, 'one', { type: 'roll' }), { code: 'ALREADY_ROLLED' });
  rolloff(game);
  rolloff(control);
  let view = game.view('one');
  const wrong = ids.find((id) => id !== view.turnId);
  assert.throws(() => act(game, wrong, { type: 'draft', racerId: view.market[0] }), {
    code: 'NOT_YOUR_TURN',
  });
  assert.throws(() => act(game, view.turnId, { type: 'draft', racerId: 'missing' }), {
    code: 'RACER_UNAVAILABLE',
  });
  assert.deepEqual(game.view('one'), control.view('one'));
  assert.equal(JSON.stringify(view).includes('randomState'), false);
  assert.equal(JSON.stringify(view).includes('randomKey'), false);
  assert.equal(JSON.stringify(view).includes('randomIndex'), false);
  assert.equal(view.deck, undefined);
  view.teams.one.push('forged');
  view.market.length = 0;
  view.rolls.one = 100;
  assert.deepEqual(game.view('one'), control.view('one'));
});

test('240 seeded 3–6 player recruiting sessions keep cards conserved and choices private', () => {
  for (const count of [3, 4, 5, 6])
    for (let seed = 0; seed < 60; seed++) {
      const players = Array.from({ length: count }, (_, i) => 'p' + i),
        game = make(players, seed);
      recruit(game, players);
      for (const id of players) {
        const view = game.view(id);
        act(game, id, { type: 'select', racerId: view.teams[id][0] });
      }
      const view = game.view(players[0]);
      assert.equal(view.phase, 'race-ready');
      assert.equal(new Set(view.lineup.map((racer) => racer.racerId)).size, count);
      assert.equal(Object.values(view.teams).flat().length + view.remainingRacers, 36);
    }
});

test('recruiting rejects invalid player sets, seeds, foreign selections and unsupported commands atomically', () => {
  for (const players of [
    [],
    ['x', 'y'],
    ['a', 'a', 'b'],
    ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
    ['a', 'b', '../x'],
  ])
    assert.throws(() => make(players), { code: 'INVALID_PLAYERS' });
  for (const seed of [-1, 0x100000000, NaN, 1.5])
    assert.throws(() => make(ids, seed), { code: 'INVALID_SEED' });
  const game = make();
  recruit(game);
  const before = game.view('one');
  assert.throws(() => act(game, 'one', { type: 'select', racerId: before.teams.two[0] }), {
    code: 'RACER_NOT_OWNED',
  });
  assert.throws(() => act(game, 'one', { type: 'set-score', score: 999 }), {
    code: 'INVALID_ACTION',
  });
  assert.deepEqual(game.view('one'), before);
});

test('move, warp, zero distance and backwards passing have distinct trigger facts', () => {
  const racers = [
    { id: 'a', position: 5 },
    { id: 'b', position: 7 },
    { id: 'c', position: 10 },
    { id: 'd', position: 8, eliminated: true },
  ];
  const forward = motion(racers, 'a', 5);
  assert.deepEqual(forward.passed, ['b']); // Ending on c does not pass c.
  assert.equal(forward.arrival.space, 10);
  assert.equal(forward.arrival.sharedTriggers, true);
  assert.deepEqual(motion(racers, 'c', -6).passed, ['a', 'b']);
  const warp = motion(racers, 'a', 10, { kind: 'warp' });
  assert.deepEqual(warp.passed, []);
  assert.equal(warp.arrival.space, 10);
  assert.equal(motion(racers, 'a', 0).arrival, null);
  assert.equal(motion(racers, 'a', -20).to, 0);
  assert.equal(racers[0].position, 5);
});

test('finish is a boundary, simultaneous warp is atomic and never reports shared-space triggers', () => {
  const racers = [
    { id: 'a', position: 27 },
    { id: 'b', position: 28 },
  ];
  const finish = motion(racers, 'a', 6);
  assert.equal(finish.finished, true);
  assert.equal(finish.arrival, null);
  assert.deepEqual(finish.passed, ['b']);
  assert.throws(() => motion(finish.racers, 'a', 1), { code: 'RACER_INACTIVE' });
  const batch = simultaneousWarp(racers, { a: 28, b: 27 });
  assert.deepEqual(
    batch.racers.map((racer) => racer.position),
    [28, 27],
  );
  assert.ok(
    batch.operations.every(
      (operation) => !operation.arrival.sharedTriggers && operation.passed.length === 0,
    ),
  );
  assert.throws(() => simultaneousWarp(racers, { a: 1, b: 99 }), { code: 'INVALID_MOVEMENT' });
  assert.deepEqual(
    racers.map((racer) => racer.position),
    [27, 28],
  );
});

test('trip does not truncate current motion; next main move skips rolling except active Penguin', () => {
  const racer = { id: 'a', position: 4, tripped: true };
  const moved = motion([racer], 'a', 4).racers[0];
  assert.equal(moved.position, 8);
  assert.equal(moved.tripped, true);
  assert.deepEqual(mainMovePlan(moved), { roll: false, multiplier: 1, recoverAfterMainMove: true });
  assert.deepEqual(mainMovePlan(moved, { penguin: true }), {
    roll: true,
    multiplier: 2,
    recoverAfterMainMove: true,
  });
  assert.equal(moved.tripped, true, 'recovery must wait until main move is completed');
});

test('trigger order starts with track, then active seat, then clockwise peers; loops stop once per chain', () => {
  assert.deepEqual(triggerOrder(ids, 'two'), ['track', 'two', 'three', 'one']);
  const chain = new ResolutionChain(2);
  assert.deepEqual(chain.enter('portal:4:6'), { run: true });
  assert.deepEqual(chain.enter('portal:6:4'), { run: true });
  assert.deepEqual(chain.enter('portal:4:6'), { run: false, reason: 'loop-completed-once' });
  assert.deepEqual(chain.enter('other-effect'), {
    run: false,
    reason: 'resolution-budget',
    needsRuling: true,
  });
  assert.deepEqual(new ResolutionChain().enter('portal:4:6'), { run: true });
  assert.throws(() => new ResolutionChain(0), { code: 'INVALID_RESOLUTION_LIMIT' });
  assert.throws(() => triggerOrder(ids, 'unknown'), { code: 'INVALID_TRIGGER_ORDER' });
});

test('NULL suppresses powers immediately ahead, including copied NULL, but not same-space racers', () => {
  const racers = [
    { id: 'a', racerId: 'null', position: 5 },
    { id: 'b', racerId: 'icarus', position: 4 },
    { id: 'c', racerId: 'understudy', copiedPowers: ['null'], position: 8 },
    { id: 'd', racerId: 'hotel', position: 5 },
  ];
  assert.deepEqual(effectivePowers(racers, 'b'), ['icarus']);
  assert.deepEqual(effectivePowers(racers, 'c'), []);
  assert.deepEqual(effectivePowers(racers, 'd'), ['hotel']);
  const passed = motion(racers, 'b', 3).racers;
  assert.deepEqual(effectivePowers(passed, 'b'), []);
  assert.deepEqual(effectivePowers(racers, 'b'), ['icarus']);
});

test('Re-Runner keeps its own outside-race effect after finish, elimination and NULL but copies do not', () => {
  const racers = [
    { id: 'null', racerId: 'null', position: 1 },
    { id: 'original', racerId: 're-runner', position: 12, eliminated: true },
    {
      id: 'copy',
      racerId: 'understudy',
      copiedPowers: ['re-runner'],
      position: 30,
      finished: true,
    },
  ];
  assert.deepEqual(effectivePowers(racers, 'original'), []);
  assert.deepEqual(effectivePowers(racers, 'original', { outsideRace: true }), ['re-runner']);
  assert.deepEqual(effectivePowers(racers, 'copy', { outsideRace: true }), []);
});

test('Stunner and Party Pooper constraints respect active powers, distance, copies and end-of-race removal', () => {
  const racers = [
    { id: 'a', racerId: 'icarus', position: 10 },
    { id: 'b', racerId: 'stunner', position: 9 },
    { id: 'c', racerId: 'party-pooper', position: 6 },
    { id: 'd', racerId: 'understudy', copiedPowers: ['stunner'], position: 11, finished: true },
  ];
  assert.deepEqual(rollConstraints(racers, 'a'), {
    fixedValue: 1,
    stunnerIds: ['b'],
    rerollSixFor: ['c'],
  });
  const suppressed = [...racers, { id: 'e', racerId: 'null', position: 7 }];
  assert.deepEqual(rollConstraints(suppressed, 'a'), {
    fixedValue: null,
    stunnerIds: [],
    rerollSixFor: ['c'],
  });
  assert.deepEqual(
    rollConstraints(
      racers.map((racer) => (racer.id === 'c' ? { ...racer, eliminated: true } : racer)),
      'a',
    ).rerollSixFor,
    [],
  );
  assert.throws(() => effectivePowers([{ id: 'x', racerId: 'forged', position: 1 }], 'x'), {
    code: 'UNKNOWN_POWER',
  });
});

test('mandatory die resolution retracts six before Icarus can use it and defers replacement until reactions settle', () => {
  const racers = [
    { id: 'a', racerId: 'icarus', position: 0 },
    { id: 'b', racerId: 'party-pooper', position: 0 },
  ];
  assert.deepEqual(mandatoryDieStep(racers, 'a', 6), {
    racerId: 'a',
    rolledValue: 6,
    candidateValue: null,
    reroll: true,
    requiresOptionalRerollWindow: false,
    reactions: [{ type: 'move', racerId: 'b', distance: 1, source: 'party-pooper' }],
  });
  const replacement = mandatoryDieStep(racers, 'a', 4);
  assert.equal(replacement.candidateValue, 4);
  assert.equal(
    replacement.requiresOptionalRerollWindow,
    true,
    'Critic may still retract this candidate',
  );
  assert.equal(replacement.reactions.length, 0);
  const stunned = [...racers, { id: 'c', racerId: 'stunner', position: 1 }];
  assert.equal(mandatoryDieStep(stunned, 'a', 6).candidateValue, 1);
  assert.equal(mandatoryDieStep(stunned, 'a', 6).reroll, false);
  const disabled = [...racers, { id: 'null', racerId: 'null', position: 0 }].map((racer) =>
    racer.id === 'b' ? { ...racer, position: 2 } : racer,
  );
  assert.equal(mandatoryDieStep(disabled, 'a', 6).candidateValue, 6);
  assert.throws(() => mandatoryDieStep(racers, 'a', 7), { code: 'INVALID_DIE' });
});
