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
  assert.equal(self(await request('lobby')).maxHealth, normalMax);
  await request('achievements/redeem', { code: '我愛作者我愛作者' });
  assert.equal(self(await request('lobby')).maxHealth, normalMax * 1.5);
  assert.equal(self((await request('state?code=' + code)).roomSpace).maxHealth, roomMax * 1.5);
  await request('achievements/redeem', { code: '我愛作者我愛作者' });
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

test('old author holders can claim the new gift without stacking the existing combat bonus', async (t) => {
  const { base } = await appFixture(t, {
    seed: async (db) => {
      await createAuth(db).bootstrap('old_bonus_owner', 'test-password-123');
      const id = db.prepare('SELECT id FROM users WHERE username=?').get('old_bonus_owner').id;
      require('../src/achievements/code-packs').redeem(
        new (require('../src/achievements/store').AchievementStore)(db),
        id,
        'author',
      );
    },
  });
  const login = await fetch(base + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'old_bonus_owner', password: 'test-password-123' }),
  });
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const call = async (route, body) => {
    const res = await fetch(base + '/api/' + route, {
      method: body ? 'POST' : 'GET',
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    assert.equal(res.status, 200);
    return res.json();
  };
  const self = (v) => v.visitors.find((p) => p.id === v.selfId);
  const maxHealth = self(await call('lobby')).maxHealth;
  assert.equal((await call('gacha')).rewardTickets, 300);
  const claimed = await call('achievements/redeem', { code: '我愛作者我愛作者' });
  assert.equal(claimed.redemption.alreadyRedeemed, false);
  assert.equal((await call('gacha')).rewardTickets, 600);
  assert.equal(self(await call('lobby')).maxHealth, maxHealth);
  assert.equal(
    (await call('achievements/redeem', { code: '我愛作者我愛作者' })).redemption.alreadyRedeemed,
    true,
  );
  assert.equal((await call('gacha')).rewardTickets, 600);
});
