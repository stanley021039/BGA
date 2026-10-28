const { test } = require('node:test');
const assert = require('node:assert/strict');
const { selectAttackTargets } = require('../src/rooms/attack-targets');
const { createLobby } = require('../src/rooms/lobby');
const { createRoomSpace } = require('../src/rooms/space');
const effects = require('../public/shared/attack-effects.json').filter((effect) => effect.area);
const rules = require('../public/shared/scene-rules.json');
const { createSceneCombat } = require('../src/rooms/scene-combat');

test('area damage is exactly twice normal before the existing author, critical and shield factors', () => {
  for (const author of [false, true])
    for (const critical of [false, true])
      for (const shield of [false, true]) {
        let rolls = [];
        const combat = createSceneCombat(
          () => rolls.shift() ?? 0.5,
          () => author,
        );
        const caster = { id: 'a', x: 0, y: 0 },
          victim = { id: 'b', x: 1, y: 0 };
        combat.advance(caster, 0);
        combat.advance(victim, 0);
        if (shield) combat.protect(victim, 0);
        rolls = [0.5, critical ? 0.1 : 0.9, 0.5];
        const normal = combat.hit(caster, victim, 100, 'barrage');
        rolls = [0.5, critical ? 0.1 : 0.9, 0.5];
        const area = combat.hit(caster, victim, 100, 'giant_orange_cat');
        assert.equal(area.damage, normal.damage * 2, JSON.stringify({ author, critical, shield }));
        assert.equal(area.critical, normal.critical);
      }
});

test('all nine area geometries include multiple forward targets, not self, dead, behind or distant actors', () => {
  const self = { id: 'self', x: 20, y: 20, health: 1 };
  const actors = [
    self,
    { id: 'near', x: 30, y: 20, health: 1 },
    { id: 'second', x: 40, y: 20, health: 1 },
    { id: 'behind', x: 100, y: 100, health: 1 },
    { id: 'side', x: 100, y: 100, health: 1 },
    { id: 'dead', x: 25, y: 20, health: 0 },
  ];
  assert.equal(effects.length, 9);
  for (const { id } of effects)
    for (const aspect of [0.5, 1, 2])
      assert.deepEqual(
        selectAttackTargets(self, actors, id, aspect).map((actor) => actor.id),
        ['near', 'second'],
      );
  assert.deepEqual(
    selectAttackTargets(self, actors, 'beam', 1).map((actor) => actor.id),
    ['near'],
  );
  assert.deepEqual(selectAttackTargets(self, actors, 'shield', 1), [self]);
});

test('only area attacks reach 65 percent of the longer edge inclusively in portrait and landscape', () => {
  for (const aspect of [0.5, 2]) {
    const self = { id: 'a', x: 20, y: 20, health: 1 };
    const axis = aspect > 1 ? 'x' : 'y';
    const target = { ...self, id: 'b', [axis]: 85 };
    for (const { id } of effects.filter((e) => e.id !== 'excalibur')) {
      assert.equal(selectAttackTargets(self, [self, target], id, aspect).length, 1);
      assert.equal(
        selectAttackTargets(self, [self, { ...target, [axis]: 85.001 }], id, aspect).length,
        0,
      );
    }
    assert.equal(selectAttackTargets(self, [self, target], 'barrage', aspect).length, 0);
  }
});

test('different area shapes distinguish side targets and fan width, with a bounded target payload', () => {
  const self = { id: 'a', x: 20, y: 50, health: 1 };
  const front = { id: 'b', x: 30, y: 50, health: 1 };
  const flank = { id: 'c', x: 40, y: 80, health: 1 };
  assert.equal(selectAttackTargets(self, [self, front, flank], 'solar_phoenix', 1).length, 1);
  assert.equal(selectAttackTargets(self, [self, front, flank], 'dimension_cleave', 1).length, 1);
  const crowd = Array.from({ length: 80 }, (_, i) => ({
    id: String(i),
    x: 35 + i / 100,
    y: 50,
    health: 1,
  }));
  assert.equal(
    selectAttackTargets(self, crowd, 'guanyin_barrage', 1).length,
    rules.maximumAreaTargets,
  );
});

for (const { id: effect } of effects)
  test(`${effect} settles two room targets once, excludes other rooms and honours the 1.6-second boundary`, () => {
    let now = 1000;
    const space = createRoomSpace(
      () => now,
      () => 0.5,
    );
    const room = { players: ['a', 'b', 'c', 'back'].map((id) => ({ id, name: id })) };
    const other = { players: room.players.map((p) => ({ ...p })) };
    space.view(room, 'a');
    space.view(other, 'a');
    for (const [id, x] of [
      ['a', 25],
      ['b', 35],
      ['c', 45],
      ['back', 100],
    ])
      space.move(room, id, { x, y: id === 'back' ? 100 : 50 });
    now += 10000;
    const input = { action: 'attack', slot: 'q', aspectRatio: 1, requestId: 'area-room-0001' };
    space.move(room, 'a', input, effect);
    let snapshot = space.view(room, 'a');
    assert.equal(snapshot.attacks.length, 1, 'one cast, not one VFX canvas per victim');
    assert.ok(snapshot.attacks[0].hits.every((hit) => hit.pending && hit.damage === 0));
    space.move(room, 'a', input, effect);
    assert.equal(space.view(room, 'a').visitors.find((v) => v.id === 'b').health, 1200000);
    assert.equal(space.view(other, 'a').attacks.length, 0);
    now += 1599;
    assert.throws(() => space.move(room, 'a', { ...input, requestId: 'area-room-0002' }, effect), {
      code: 'ATTACK_COOLDOWN',
    });
    now++;
    space.move(room, 'a', { ...input, requestId: 'area-room-0002' }, effect);
    now += 2500; // first cast age 4100; all five Guanyin stages have arrived.
    snapshot = space.view(room, 'a');
    for (const id of ['b', 'c']) {
      const first = snapshot.attacks[0].hits.filter((hit) => hit.toId === id && !hit.pending);
      assert.equal(
        first.reduce((sum, hit) => sum + hit.damage, 0),
        effect === 'solar_phoenix'
          ? 480000
          : effect === 'explosion'
            ? 600000
            : effect === 'gate_of_babylon'
              ? 843478
              : effect === 'guanyin_barrage'
                ? 408000
                : 400000,
      );
      const total = snapshot.attacks
        .flatMap((event) => event.hits || [])
        .filter((hit) => hit.toId === id)
        .reduce((sum, hit) => sum + hit.damage, 0);
      assert.equal(snapshot.visitors.find((v) => v.id === id).health, 1200000 - total);
    }
  });

test('lobby victims independently roll critical and author shield mitigation without repeated damage on retries', () => {
  let now = 1000,
    rolls = [];
  const lobby = createLobby(
    () => now,
    undefined,
    () => rolls.shift() ?? 0.5,
    (id) => id === 'b',
  );
  const users = ['a', 'b', 'c', 'back'].map((id) => ({ id, display_name: id }));
  for (const [i, x] of [25, 35, 45, 10].entries()) lobby.move(users[i], { x, y: 50 });
  now += 10000;
  users.forEach((user) => lobby.view(user));
  lobby.attack(users[1], {
    slot: 'q',
    effect: 'shield',
    aspectRatio: 1,
    requestId: 'area-shield-001',
  });
  rolls = [0.5, 0.1, 0.5, 0.5, 0.9];
  const input = {
    slot: 'q',
    effect: 'guanyin_barrage',
    aspectRatio: 1,
    requestId: 'area-lobby-0001',
  };
  lobby.attack(users[0], input);
  now += 1960;
  let snapshot = lobby.view(users[0]);
  const hits = snapshot.attacks.at(-1).hits;
  assert.deepEqual(
    hits
      .filter((hit) => !hit.pending)
      .map(({ toId, damage, critical }) => ({ toId, damage, critical })),
    [
      { toId: 'b', damage: 72600, critical: true },
      { toId: 'c', damage: 88000, critical: false },
    ],
  );
  const health = snapshot.visitors.map((v) => [v.id, v.health]);
  snapshot = lobby.attack(users[0], input);
  assert.deepEqual(
    snapshot.visitors.map((v) => [v.id, v.health]),
    health,
  );
  assert.throws(
    () => lobby.attack(users[0], { ...input, requestId: 'forged-area-001', hits: [] }),
    { code: 'INVALID_ATTACK' },
  );
});

test('explosion is a burst around the nearest target, not an all-direction caster attack', () => {
  const self = { id: 'self', x: 30, y: 50, health: 1 };
  const centre = { id: 'centre', x: 45, y: 50, health: 1 };
  const edge = { id: 'edge', x: 80, y: 50, health: 1 };
  const outside = { id: 'outside', x: 80.001, y: 50, health: 1 };
  const behind = { id: 'behind', x: 0, y: 50, health: 1 };
  assert.deepEqual(
    selectAttackTargets(self, [self, centre, edge, outside, behind], 'explosion', 1).map(
      (a) => a.id,
    ),
    ['centre', 'edge'],
  );
});
