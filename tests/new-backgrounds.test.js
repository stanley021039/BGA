'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID, createHash } = require('node:crypto');
const { openDatabase } = require('../src/db');
const { GachaStore } = require('../src/gacha/store');
const { catalog, poolItems } = require('../src/gacha/catalog');
const { AchievementStore } = require('../src/achievements/store');
const { GACHA_TABLES } = require('../src/gacha/schema');
const { validateGachaDatabase } = require('../src/gacha/validation');
const scenes = require('../public/shared/lobby-background-live.json');
const backgrounds = require('../public/shared/lobby-backgrounds.json');
const additions = {
  cinema: 'common',
  bathroom: 'common',
  sakura: 'rare',
  onsen: 'rare',
  moonlit_lake: 'epic',
  presidential: 'epic',
  mars: 'legendary',
  battlefield: 'legendary',
};
const { appFixture } = require('./helpers/app-fixture.cjs');
const { createAuth } = require('../src/auth');
const at = '2026-11-24T00:00:00.000Z';
const digest = (value) => createHash('sha256').update(value).digest('hex');
function fixture(t) {
  const db = openDatabase(':memory:');
  t.after(() => db.close());
  const user = randomUUID();
  db.prepare(
    'INSERT INTO users(id,username,display_name,password_hash,role,created_at) VALUES(?,?,?,?,?,?)',
  ).run(user, 'background-owner', '玩家', 'unused', 'member', at);
  return { db, user, store: new GachaStore(db, { choose: (n) => n - 1 }) };
}
test('eight approved backgrounds have exact tiers, prices and production SVG provenance in both pools', () => {
  const manifest = require('../docs/design/candidates/407/production/manifest.json');
  for (const [id, tier] of Object.entries(additions)) {
    const item = catalog.find((i) => i.key === 'backgrounds:' + id);
    assert.equal(item.rarity, tier, id);
    assert.equal(item.exchangeCost, { common: 40, rare: 160, epic: 320, legendary: 560 }[tier]);
    assert.equal(item.legacy, false);
    assert.equal(item.gachaExclusive, true);
    for (const pool of ['all', 'combat', 'backgrounds'])
      assert.ok(poolItems(pool).some((i) => i.key === item.key));
    assert.equal(backgrounds.find((b) => b.id === id).gachaOnly, true);
    const art = scenes.find((s) => s.id === id).svg;
    const file = fs.readFileSync(
      path.join(__dirname, '../docs/design/candidates/407/production', id + '.svg'),
    );
    assert.equal(art, file.toString());
    assert.ok(file.length <= 256 * 1024);
    assert.equal(digest(file), manifest.scenes.find((s) => s.id === id).sha256);
    assert.doesNotMatch(
      art,
      /<script|<image|<foreignObject|<animate|<set\b|\son\w+=|(?:href|src)=["']https?:|@keyframes/i,
    );
  }
});
test('new accounts and every legacy author/starter path do not receive the eight gacha-only backgrounds', (t) => {
  const { db, user } = fixture(t);
  const achievements = new AchievementStore(db);
  assert.deepEqual(achievements.list(user).bonusRewards.backgrounds, ['default', 'castle']);
  for (const saved of [
    { achievementRewardCodes: { other: at } },
    { achievementRewardCodeAt: at },
    {
      starterRewardPack: {
        version: 1,
        redeemedAt: at,
        grants: { backgrounds: Object.keys(additions) },
      },
    },
  ]) {
    db.prepare('UPDATE users SET appearance=? WHERE id=?').run(JSON.stringify(saved), user);
    for (const id of Object.keys(additions))
      assert.ok(!achievements.list(user).bonusRewards.backgrounds.includes(id), id);
  }
  db.prepare('UPDATE users SET appearance=? WHERE id=?').run('{}', user);
  achievements.redeem(user, '我愛作者我愛作者');
  for (const id of Object.keys(additions))
    assert.ok(!achievements.list(user).bonusRewards.backgrounds.includes(id));
  for (const table of GACHA_TABLES) db.exec('DROP TABLE ' + table);
  db.prepare('UPDATE users SET appearance=? WHERE id=?').run(
    JSON.stringify({ achievementRewardCodes: { other: at } }),
    user,
  );
  for (const id of Object.keys(additions))
    assert.ok(
      !require('../src/achievements/bonus-rewards')
        .owned(achievements, user)
        .backgrounds.includes(id),
    );
});
test('new legendary backgrounds can be drawn and all eight can be exchanged with persistent ownership', (t) => {
  const { db, user, store } = fixture(t);
  store.ledger('background-test-fund', user, 'login', 1000, 10000, digest('fund'), at);
  const draw = store.draw(user, { pool: 'backgrounds', count: 1, requestId: randomUUID() });
  assert.equal(draw.results[0].id, 'battlefield');
  assert.equal(draw.results[0].rarity, 'legendary');
  for (const id of Object.keys(additions)) {
    if (id !== 'battlefield') {
      const input = { key: 'backgrounds:' + id, requestId: randomUUID() };
      const r = store.exchange(user, input);
      assert.deepEqual(store.exchange(user, input), r);
    }
    assert.ok(new GachaStore(db).owned(user).backgrounds.has(id));
  }
  assert.doesNotThrow(() => validateGachaDatabase(db));
});

test('HTTP background selection rejects locked scenes and accepts an exchanged or drawn new scene', async (t) => {
  const { base } = await appFixture(t, {
    config: { gachaChoose: (n) => n - 1 },
    seed: async (db) => {
      await createAuth(db).bootstrap('background_http', 'test-password-123');
      const user = db.prepare('SELECT id FROM users WHERE username=?').get('background_http').id;
      new GachaStore(db).ledger(
        'background-http-fund',
        user,
        'login',
        1000,
        1000,
        digest('http-fund'),
        at,
      );
    },
  });
  let cookie;
  const call = async (route, body) => {
    const response = await fetch(base + '/api/' + route, {
      method: body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (response.headers.has('set-cookie'))
      cookie = response.headers.get('set-cookie').split(';')[0];
    return { status: response.status, body: await response.json() };
  };
  assert.equal(
    (await call('auth/login', { username: 'background_http', password: 'test-password-123' }))
      .status,
    200,
  );
  assert.equal((await call('lobby/background', { id: 'mars' })).status, 403);
  const exchange = await call('gacha/exchange', {
    key: 'backgrounds:mars',
    requestId: randomUUID(),
  });
  assert.equal(exchange.status, 200);
  assert.equal(exchange.body.cost, 560);
  const selected = await call('lobby/background', { id: 'mars' });
  assert.equal(selected.status, 200);
  assert.equal(selected.body.background.id, 'mars');
  const draw = await call('gacha/draw', { pool: 'backgrounds', count: 1, requestId: randomUUID() });
  assert.equal(draw.status, 200);
  assert.equal(draw.body.results[0].id, 'battlefield');
  const owned = (await call('achievements')).body.bonusRewards.backgrounds;
  assert.ok(owned.includes('mars'));
  assert.ok(owned.includes('battlefield'));
  assert.ok(!owned.includes('sakura'));
});
