'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  { randomUUID } = require('node:crypto'),
  { createLobby } = require('../src/rooms/lobby');
test('lobby barrage broadcasts selected allowlisted frame once; cooldown, validation, TTL and conflicts remain bounded', () => {
  let time = 1000;
  const lobby = createLobby(() => time),
    a = { id: 'a', display_name: '<host>' },
    b = { id: 'b', display_name: 'peer' },
    request = {
      message: '<img onerror=evil()> 大家好',
      builtinFrameId: 'moon',
      requestId: randomUUID(),
    };
  lobby.view(a);
  lobby.view(b);
  lobby.barrage(a, request);
  lobby.barrage(a, request);
  const v = lobby.view(b);
  assert.equal(v.barrages.length, 1);
  assert.equal(v.barrages[0].frame.id, 'moon');
  assert.equal(v.barrages[0].name, '<host>');
  assert.equal(v.barrages[0].kind, 'barrage');
  assert.equal(v.barrages[0].playerId, a.id);
  assert.throws(
    () => lobby.barrage(a, { ...request, message: 'changed' }),
    (e) => e.code === 'REQUEST_CONFLICT',
  );
  assert.throws(
    () => lobby.barrage(a, { ...request, requestId: randomUUID() }),
    (e) => e.code === 'BARRAGE_RATE_LIMIT',
  );
  time += 1500;
  for (const patch of [
    { message: '' },
    { message: 'x'.repeat(161) },
    { message: 'line\nbreak' },
    { builtinFrameId: 'evil' },
    { requestId: 'bad' },
  ])
    assert.throws(() => lobby.barrage(a, { ...request, ...patch }));
  time += 8000;
  assert.equal(lobby.view(b).barrages.length, 0);
});
