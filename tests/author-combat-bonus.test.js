const test = require('node:test');
const assert = require('node:assert/strict');
const { appFixture } = require('./helpers/app-fixture.cjs');
const { createAuth } = require('../src/auth');
test('author code activates the bonus in existing lobby and room scenes without stacking or fake achievements', async (t) => {
  const { base } = await appFixture(t, {
    seed: (db) => createAuth(db).bootstrap('bonus_owner', 'test-password-123'),
  });
  let cookie;
  async function request(route, body) {
    const r = await fetch(base + '/api/' + route, {
      method: body ? 'POST' : 'GET',
      headers: {
        ...(cookie ? { Cookie: cookie } : {}),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (r.headers.get('set-cookie')) cookie = r.headers.get('set-cookie').split(';')[0];
    const data = await r.json();
    assert.equal(r.status, 200, JSON.stringify(data));
    return data;
  }
  await request('auth/login', { username: 'bonus_owner', password: 'test-password-123' });
  const before = await request('lobby');
  const self = (v) => v.visitors.find((x) => x.id === v.selfId);
  const normalMax = self(before).maxHealth;
  const { code } = await request('create', { type: 'quacks', roomName: 'combat bonus test' });
  const roomBefore = await request('state?code=' + code);
  const roomMax = self(roomBefore.roomSpace).maxHealth;
  const achievements = await request('achievements');
  await request('achievements/redeem', { code: '我愛士憲' });
  assert.equal(self(await request('lobby')).maxHealth, normalMax);
  await request('achievements/redeem', { code: '我愛作者' });
  assert.equal(self(await request('lobby')).maxHealth, normalMax * 1.5);
  assert.equal(self((await request('state?code=' + code)).roomSpace).maxHealth, roomMax * 1.5);
  await request('achievements/redeem', { code: '我愛作者' });
  assert.equal(self(await request('lobby')).maxHealth, normalMax * 1.5);
  assert.deepEqual(
    (await request('achievements')).achievements.map((a) => a.unlockedAt),
    achievements.achievements.map((a) => a.unlockedAt),
  );
  const forged = await fetch(base + '/api/lobby/attack', {
    method: 'POST',
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      slot: 'q',
      aspectRatio: 1.6,
      requestId: 'forged-bonus-test',
      authorBonus: true,
    }),
  });
  assert.equal(forged.status, 400);
});
