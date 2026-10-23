'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createRoomSpace } = require('../src/rooms/space');
function room(code = 'AAAAAA') {
  return {
    code,
    version: 7,
    players: [
      { id: 'one', name: 'One', avatar: '/one.svg', bag: ['private'] },
      { id: 'two', name: 'Two', avatar: '/two.svg' },
    ],
  };
}
test('movement is isolated by room instance, including reused room codes', () => {
  let now = 1000;
  const space = createRoomSpace(() => now),
    a = room(),
    b = room();
  space.move(a, 'one', { x: 70, y: 80 });
  now += 10000;
  assert.equal(space.view(a, 'one').visitors[0].x, 70);
  assert.equal(space.view(b, 'one').visitors[0].x, 12);
  assert.equal(a.version, 7);
});
test('mid-walk retargeting starts at the current position without teleporting', () => {
  let now = 1000;
  const space = createRoomSpace(() => now),
    a = room();
  space.move(a, 'one', { x: 72, y: 38 });
  now += 1000;
  const middle = space.view(a, 'one').visitors[0];
  assert.equal(middle.x, 24);
  assert.equal(middle.moving, true);
  space.move(a, 'one', { x: 0, y: 100 });
  assert.equal(space.view(a, 'one').visitors[0].x, 24);
  now += 20000;
  const end = space.view(a, 'one').visitors[0];
  assert.equal(end.x, 0);
  assert.equal(end.y, 100);
  assert.equal(end.moving, false);
});
test('departed members disappear and room projections do not expose private state', () => {
  const space = createRoomSpace(),
    a = room();
  const first = space.view(a, 'one');
  assert.equal(first.visitors.length, 2);
  assert.equal('bag' in first.visitors[0], false);
  a.players[1].kicked = true;
  assert.equal(space.view(a, 'one').visitors.length, 1);
  assert.throws(() => space.move(a, 'two', { x: 20, y: 20 }), { code: 'NOT_SEATED' });
});
test('invalid coordinates and attempts to control another member are rejected', () => {
  const space = createRoomSpace(),
    a = room();
  for (const input of [
    { x: NaN, y: 0 },
    { x: 0, y: Infinity },
    { x: -1, y: 50 },
    { x: 101, y: 50 },
    { x: '2', y: 50 },
    { x: 50, y: 50, playerId: 'two' },
    [],
  ])
    assert.throws(() => space.move(a, 'one', input), { code: 'INVALID_MOVEMENT' });
  assert.throws(() => space.move(a, 'outsider', { x: 50, y: 50 }), { code: 'NOT_SEATED' });
});

test('room avatar expressions stay with their actor and expire without moving anyone', () => {
  let now = 1000;
  const space = createRoomSpace(() => now),
    a = room();
  const events = [
    { id: 'older', playerId: 'one', image: '/sad.gif', label: '難過', at: 800 },
    {
      id: 'newer',
      playerId: 'one',
      image: '/happy.gif',
      label: '開心',
      at: 900,
      private: 'not-public',
    },
    { id: 'outsider', playerId: 'outside', image: '/other.gif', label: '其他', at: 950 },
  ];
  const active = space.view(a, 'two', a.players, events);
  assert.equal(active.visitors.length, 2);
  assert.deepEqual(active.visitors[0].emote, {
    id: 'newer',
    image: '/happy.gif',
    label: '開心',
    at: 900,
    until: 5900,
  });
  assert.equal(active.visitors[1].emote, null);
  assert.deepEqual([active.visitors[0].x, active.visitors[0].y], [12, 38]);
  assert.equal(a.version, 7);
  now = 5900;
  assert.equal(space.view(a, 'two', a.players, events).visitors[0].emote, null);
});
