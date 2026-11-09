'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createLobbyPickups, contact, travelTime, rules } = require('../src/rooms/lobby-pickups');
const { covers } = require('../src/rooms/lobby-arena');
const { createSceneCombat } = require('../src/rooms/scene-combat');
const { createLobby } = require('../src/rooms/lobby');
function fixture(random = () => 0, expanded = false) {
  let time = 1000,
    scope = 'fixture-match';
  const arena = {
    pickupScope: () => scope,
    canCollect: (id) => scope !== 'spectator-match' || id === 'a',
  };
  const pickups = createLobbyPickups(() => time, random, arena, covers, expanded);
  const actor = (id = 'a') => ({ id, x: 50, y: 50, health: 50, maxHealth: 100, seenAt: time });
  const a = actor();
  function at(t, bodies = [a]) {
    time = t;
    for (const body of bodies) body.seenAt = time;
    pickups.advance(bodies, time);
    return pickups.view();
  }
  return {
    pickups,
    a,
    actor,
    at,
    get time() {
      return time;
    },
    scope(value) {
      scope = value;
    },
    spawn() {
      return at(pickups.view().nextPickupAt).pickups[0];
    },
  };
}
test('pickups spawn at 8–12s intervals, cap at three, avoid covers and use a bounded lifetime', () => {
  let seed = 9345;
  const f = fixture(() => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  });
  let time = 1000;
  assert.equal(f.at(8999).pickups.length, 0);
  for (let i = 0; i < 30; i++) {
    const next = f.pickups.view().nextPickupAt;
    assert.ok(next - time >= 8000 && next - time <= 12000);
    const view = f.at(next);
    time = next;
    assert.ok(view.pickups.length <= 3);
    for (const p of view.pickups) {
      assert.equal(p.until - p.at, 30000);
      assert.ok(
        !covers.some(
          (c) =>
            p.x >= c.x - 4 &&
            p.x <= c.x + c.width + 4 &&
            p.y >= c.y - 4 &&
            p.y <= c.y + c.height + 4,
        ),
      );
    }
  }
});
test('health pickup follows a swept walking path, heals 25%, and cannot be claimed twice', () => {
  const f = fixture(),
    item = f.spawn();
  assert.equal(item.kind, 'health');
  const start = f.time;
  f.a.x = item.x + 10;
  f.a.y = item.y;
  f.pickups.record(f.a, { x: item.x - 10, y: item.y }, start, start + 1000);
  f.at(start + 1000);
  assert.equal(f.a.health, 75);
  assert.equal(f.pickups.view().pickups.length, 0);
  f.at(start + 1000);
  assert.equal(f.a.health, 75);
});
test('earliest contact wins independently of actor iteration order, with stable ties', () => {
  for (const tie of [false, true]) {
    const f = fixture(),
      item = f.spawn(),
      b = f.actor('b'),
      start = f.time;
    for (const [actor, distance] of [
      [f.a, 5],
      [b, tie ? 5 : 10],
    ]) {
      actor.x = item.x + distance;
      actor.y = item.y;
      f.pickups.record(actor, { x: item.x - distance, y: item.y }, start, start + 1000);
    }
    f.at(start + 1000, [b, f.a]);
    assert.equal(f.a.health, 75);
    assert.equal(b.health, 50);
  }
});
test('full HP, healing lock, dead, stale and non-participant actors cannot consume health pickups', () => {
  const f = fixture(),
    item = f.spawn();
  f.a.x = item.x;
  f.a.y = item.y;
  f.a.health = 100;
  f.at(f.time + 1);
  assert.equal(f.pickups.view().pickups.length, 1);
  f.a.health = 95;
  f.a.regenBlockedUntil = f.time + 5000;
  f.at(f.time + 1);
  assert.equal(f.pickups.view().pickups.length, 1);
  f.a.regenBlockedUntil = 0;
  f.a.health = 0;
  f.at(f.time + 1);
  assert.equal(f.pickups.view().pickups.length, 1);
  f.a.health = 95;
  f.a.seenAt = f.time - 16000;
  f.pickups.advance([f.a], f.time + 1);
  assert.equal(f.pickups.view().pickups.length, 1);
  f.at(f.time + 2);
  assert.equal(f.a.health, 100);
  assert.equal(f.pickups.view().pickups.length, 0);
});
test('speed and shield have six-second refresh durations; new match clears items and effects', () => {
  for (const [random, kind, field] of [
    [0.3, 'speed', 'pickupSpeedUntil'],
    [0.6, 'shield', 'pickupShieldUntil'],
    [0.99, 'sword', 'pickupAttackUntil'],
  ]) {
    const f = fixture(() => random),
      item = f.spawn();
    assert.equal(item.kind, kind);
    const time = f.time;
    f.a.x = item.x;
    f.a.y = item.y;
    f.at(time + 1);
    assert.equal(f.a[field], time + 1 + 6000);
    assert.equal(f.pickups.effects(f.a, time + 6001).pickupEffects, undefined);
    f.scope('next-match');
    f.at(time + 2);
    assert.equal(f.pickups.view().pickups.length, 0);
    assert.equal(f.a[field], 0);
  }
});
test('an active match prevents spectators from taking its items', () => {
  const f = fixture();
  f.scope('spectator-match');
  f.at(1001);
  const item = f.spawn(),
    b = f.actor('b');
  b.x = item.x;
  b.y = item.y;
  f.at(f.time + 1, [b, f.a]);
  assert.equal(b.health, 50);
  assert.equal(f.pickups.view().pickups.length, 1);
});
test('expiry and discontinuous teleports do not pick items crossed only by a screen-wide chord', () => {
  const f = fixture(),
    item = f.spawn(),
    start = f.time;
  f.a.x = item.x + 10;
  f.a.y = item.y;
  f.pickups.record(f.a, { x: item.x - 10, y: item.y }, start, start + 1, true);
  f.at(start + 1);
  assert.equal(f.a.health, 50);
  f.a.x = 50;
  f.a.y = 50;
  const view = f.at(item.until + 1);
  assert.ok(!view.pickups.some((p) => p.id === item.id));
});
test('no backlog spawn burst and empty scenes do not generate loot', () => {
  const f = fixture();
  const view = f.at(100000, []);
  assert.equal(view.pickups.length, 0);
  assert.ok(view.nextPickupAt > 100000);
  assert.equal(f.at(100001).pickups.length, 0);
});
test('contact and travel clocks honor tangents, exact expiry and speed expiring mid-path', () => {
  assert.equal(contact({ x: 0, y: 3 }, { x: 10, y: 3 }, { x: 5, y: 0 }), 0.5);
  assert.equal(contact({ x: 0, y: 4 }, { x: 10, y: 4 }, { x: 5, y: 0 }), null);
  assert.equal(travelTime(9, 1000, 1000, 7000), 7000);
  assert.equal(travelTime(11, 1000, 1000, 7000), 9000);
  assert.equal(travelTime(1, 1000, 1000, 1000), 2000);
  assert.equal(travelTime(4, 1000, 3000, 9000), 3000 + 2000 / 1.5);
});
test('pickup shield reduces real combat damage by 30% and stops exactly at expiry', () => {
  const combat = createSceneCombat(() => 0.5),
    a = { id: 'a' },
    b = { id: 'b' };
  combat.advance(a, 1000);
  combat.advance(b, 1000);
  b.pickupShieldUntil = 2000;
  const guarded = combat.hit(a, b, 1999, 'barrage').damage;
  const plain = combat.hit(a, b, 2000, 'barrage').damage;
  assert.equal(guarded, Math.round(plain * (1 - rules.reduction)));
  combat.reset(b, 2001);
  assert.equal(b.pickupShieldUntil, 0);
});
test('real lobby spawns pickups only while an arena round is active', () => {
  let time = 1000;
  const lobby = createLobby(
    () => time,
    undefined,
    () => 0.3,
  );
  const a = { id: 'x', display_name: 'X' },
    b = { id: 'y', display_name: 'Y' };
  lobby.view(a);
  lobby.view(b);
  time += 10000;
  const idle = lobby.view(a).arena;
  assert.deepEqual([idle.pickups, idle.covers, idle.hazards, idle.nextPickupAt], [[], [], [], 0]);
  lobby.arena(a, { action: 'team', team: 'red' });
  lobby.arena(b, { action: 'team', team: 'blue' });
  const started = lobby.arena(a, { action: 'start', mode: 'pk' }).arena;
  assert.ok(started.covers.length && started.hazards.length);
  time = started.nextPickupAt;
  const running = lobby.view(a).arena;
  assert.ok(running.pickups.length > 0);
  time = running.match.endsAt;
  const ended = lobby.view(a).arena;
  assert.equal(ended.match.phase, 'finished');
  assert.deepEqual(
    [ended.pickups, ended.covers, ended.hazards, ended.nextPickupAt],
    [[], [], [], 0],
  );
});
test('arrival time accounts for immobilization and paths that finish before the next update', () => {
  const f = fixture(),
    item = f.spawn(),
    start = f.time,
    b = f.actor('b');
  f.a.x = item.x + 2;
  f.a.y = item.y;
  b.x = item.x + 15;
  b.y = item.y;
  f.pickups.record(f.a, { x: item.x - 10, y: item.y }, start, start + 10000, false, {
    distance: 1,
    start,
    speedAt: 0,
    speedUntil: 0,
  });
  f.pickups.record(b, { x: item.x - 5, y: item.y }, start, start + 10000, false, {
    distance: 20 / 12,
    start: start + 2000,
    speedAt: 0,
    speedUntil: 0,
  });
  f.at(start + 10000, [b, f.a]);
  assert.equal(f.a.health, 75);
  assert.equal(b.health, 50);
});

test('expanded arena energy crystal grants 25 energy and stays available at full energy', () => {
  const f = fixture(() => 0.95, true);
  const item = f.spawn();
  assert.equal(item.kind, 'energy');
  Object.assign(f.a, { x: item.x, y: item.y, energy: 100 });
  f.at(f.time + 1);
  assert.equal(f.pickups.view().pickups.length, 1);
  f.a.energy = 40;
  f.at(f.time + 1);
  assert.equal(f.a.energy, 65);
  assert.equal(f.pickups.view().pickups.length, 0);
});
