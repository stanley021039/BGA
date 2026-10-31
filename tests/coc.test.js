const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomUUID, createHash } = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const { createAuth } = require('../src/auth');
const { openDatabase, SCHEMA_VERSION } = require('../src/db');
const { COC_TABLES } = require('../src/coc/schema');
const rules = require('../src/coc/rules');
const { revealedMedia } = require('../src/coc/media');
const { appFixture } = require('./helpers/app-fixture.cjs');

test('COC percentile thresholds, bonus dice, opposed ties and luck preserve rules', () => {
  for (const [roll, target, level] of [
    [18, 37, 2],
    [19, 37, 1],
    [7, 37, 3],
    [8, 37, 2],
    [38, 37, 0],
    [96, 49, -1],
    [96, 50, 0],
    [100, 99, -1],
    [1, 0, 4],
  ])
    assert.equal(rules.successLevel(roll, target), level, `${roll}/${target}`);
  let sequence = [0, 0, 4];
  const bonus = rules.percentile(50, 1, () => sequence.shift());
  assert.deepEqual(bonus.tens, [0, 4]);
  assert.equal(bonus.roll, 40); // 00 is 100, not a zero-valued automatic success.
  sequence = [0, 0, 4];
  assert.equal(rules.percentile(50, -1, () => sequence.shift()).roll, 100);
  assert.equal(rules.melee({ level: 2 }, { level: 2 }, 'dodge'), 'defender');
  assert.equal(rules.melee({ level: 2 }, { level: 2 }, 'fightBack'), 'attacker');
  const original = { roll: 38, target: 37, level: 0 };
  const adjusted = rules.spendLuck({ luck: 70 }, original, 1);
  assert.equal(adjusted.roll, 37);
  assert.equal(adjusted.originalRoll, 38);
  assert.equal(original.roll, 38);
  assert.throws(
    () => rules.spendLuck({ luck: 70 }, { roll: 100, target: 37, level: -1 }, 5),
    (e) => e.code === 'COC_LUCK',
  );
  assert.throws(
    () => rules.spendLuck({ luck: 70 }, original, 1, { pushed: true }),
    (e) => e.code === 'COC_LUCK',
  );
  assert.equal(rules.secondary({ STR: 60, CON: 85, SIZ: 65, DEX: 65, POW: 60 }).maxHp, 30);
});

test('COC schema 20 upgrade preserves prior records and rejects partial schema 21', (t) => {
  const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'bga-coc-migration-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true, maxRetries: 5 }));
  const file = path.join(root, 'app.sqlite');
  let db = openDatabase(file);
  db.prepare(
    'INSERT INTO users(id,username,display_name,password_hash,role,created_at) VALUES(?,?,?,?,?,?)',
  ).run(
    'migration-user',
    'migration-user',
    '既有帳號',
    'synthetic-unused-password-hash',
    'member',
    '2026-01-01T00:00:00Z',
  );
  const tables = db
    .prepare(
      "SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'coc_%' ORDER BY name",
    )
    .all()
    .map((r) => r.name);
  const snapshot = () =>
    Object.fromEntries(
      tables.map((name) => [name, db.prepare('SELECT * FROM "' + name + '" ORDER BY rowid').all()]),
    );
  const before = snapshot();
  db.exec('PRAGMA foreign_keys=OFF');
  for (const name of [...COC_TABLES].reverse()) db.exec('DROP TABLE ' + name);
  db.exec('PRAGMA user_version=20');
  db.close();
  db = openDatabase(file);
  assert.equal(db.prepare('PRAGMA user_version').get().user_version, SCHEMA_VERSION);
  assert.deepEqual(snapshot(), before);
  for (const table of COC_TABLES)
    assert.equal(db.prepare('SELECT COUNT(*) n FROM ' + table).get().n, 0);
  assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
  db.exec('DROP TABLE coc_receipts');
  db.close();
  assert.throws(() => openDatabase(file), /COC|coc|Incomplete/);
  db = new DatabaseSync(file);
  assert.equal(db.prepare('PRAGMA user_version').get().user_version, 21);
  assert.equal(
    db.prepare("SELECT COUNT(*) n FROM sqlite_schema WHERE name='coc_receipts'").get().n,
    0,
  );
  db.close();
});

test('COC HTTP keeps character ownership, idempotency, point budgets and private media access', async (t) => {
  const password = 'synthetic-coc-test-password';
  const { base, config } = await appFixture(t, {
    seed: (db) => createAuth(db).bootstrap('coc_owner', password),
  });
  async function post(route, cookie, data = {}, status = 200) {
    const response = await fetch(base + '/api/' + route, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: base,
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: JSON.stringify(data),
    });
    const body = await response.json();
    assert.equal(response.status, status, JSON.stringify(body));
    return { body, cookie: response.headers.get('set-cookie')?.split(';')[0] };
  }
  const owner = (await post('auth/login', null, { username: 'coc_owner', password })).cookie;
  const invite = (await post('admin/invites', owner)).body.code;
  const peer = (
    await post('auth/register', null, {
      username: 'coc_peer',
      displayName: '同伴',
      password,
      confirmPassword: password,
      invite,
    })
  ).cookie;
  await post('coc/characters/create', null, {}, 401);
  await post('coc/ai/probe', peer, { scope: 'cli', provider: 'openai' }, 403);
  const request = { requestId: randomUUID(), pregen: true, occupation: 'investigator' };
  const character = (await post('coc/characters/create', owner, request)).body;
  assert.equal(character.status, 'ready');
  assert.equal((await post('coc/characters/create', owner, request)).body.id, character.id);
  await post('coc/characters/create', owner, { ...request, name: 'different' }, 409);
  const saved = {
    name: character.name,
    age: character.draft.age,
    talents: character.draft.talents,
    background: character.draft.background,
    equipment: character.draft.equipment,
    allocations: character.draft.allocations,
    ready: true,
  };
  await post(
    'coc/characters/save',
    peer,
    { requestId: randomUUID(), id: character.id, revision: 1, character: saved },
    404,
  );
  await post(
    'coc/characters/save',
    owner,
    {
      requestId: randomUUID(),
      id: character.id,
      revision: 1,
      character: { ...saved, allocations: { ...saved.allocations, interest: { drive: 1000 } } },
    },
    400,
  );
  const savedCharacter = (
    await post('coc/characters/save', owner, {
      requestId: randomUUID(),
      id: character.id,
      revision: 1,
      character: saved,
    })
  ).body;
  assert.equal(savedCharacter.revision, 2);
  assert.deepEqual(savedCharacter.draft.attributes, character.draft.attributes);
  await post(
    'coc/characters/save',
    owner,
    { requestId: randomUUID(), id: character.id, revision: 1, character: saved },
    409,
  );
  const ordinary = (await post('create', peer, { type: 'trpg' })).body;
  await post(
    'change-game',
    peer,
    { code: ordinary.code, gameType: 'trpg', gameRevision: 0, targetType: 'coc' },
    400,
  );
  const { code } = (await post('create', owner, { type: 'coc' })).body;
  const stateResponse = await fetch(base + '/api/state?code=' + code, {
    headers: { Cookie: owner },
  });
  assert.equal(stateResponse.status, 200);
  const projected = await stateResponse.json();
  assert.equal(projected.type, 'coc');
  assert.ok(!Object.hasOwn(projected, 'truthHash'));
  const syntheticKey = 'synthetic-coc-key-never-used-for-network-ABCD';
  const configured = (
    await post('coc/ai/save', owner, { scope: 'user', provider: 'openai', key: syntheticKey })
  ).body;
  assert.equal(configured.keys[0].suffix, 'ABCD');
  assert.ok(!JSON.stringify(configured).includes(syntheticKey));
  await post('coc/ai/save', peer, { scope: 'station', provider: 'openai', key: syntheticKey }, 403);
  const peerSettings = await (
    await fetch(base + '/api/coc/ai/settings', { headers: { Cookie: peer } })
  ).json();
  assert.deepEqual(peerSettings.keys, []);
  const db = openDatabase(config.dbFile);
  try {
    const encrypted = db.prepare('SELECT encrypted_key FROM coc_provider_keys').get().encrypted_key;
    assert.match(encrypted, /^v1\./);
    assert.ok(!encrypted.includes(syntheticKey));
    const master = config.dbFile + '.coc-private/master.key';
    if (process.platform !== 'win32') assert.equal(fs.statSync(master).mode & 0o777, 0o600);

    const row = db.prepare('SELECT * FROM coc_campaigns WHERE room_code=?').get(code);
    const state = JSON.parse(row.state_json);
    state.module = 'poisoned-soup-pulp-1';
    state.scene = 'soup';
    state.status = 'playing';
    state.visitedScenes = ['soup'];
    state.clues = [];
    db.prepare("UPDATE coc_campaigns SET status='playing',state_json=? WHERE id=?").run(
      JSON.stringify(state),
      row.id,
    );
    const art = revealedMedia(state).illustrations[0];
    const get = (url, cookie = owner, headers = {}) =>
      fetch(base + url, { headers: { ...(cookie ? { Cookie: cookie } : {}), ...headers } });
    assert.match(art.url, /\?size=1024&v=[a-f0-9]{64}$/);
    for (const [url, width] of [
      [art.url, 1024],
      [art.mediumUrl, 512],
      [art.smallUrl, 256],
    ]) {
      const image = await get(url);
      assert.equal(image.status, 200);
      assert.equal(image.headers.get('content-type'), 'image/webp');
      assert.equal(image.headers.get('cache-control'), 'private, no-cache');
      assert.match(image.headers.get('vary'), /Cookie/);
      const bytes = Buffer.from(await image.arrayBuffer());
      assert.ok(bytes.length <= 262144);
      const metadata = await require('sharp')(bytes).metadata();
      assert.equal(metadata.width, width);
      const etag = '"' + createHash('sha256').update(bytes).digest('hex') + '"';
      assert.equal(image.headers.get('etag'), etag);
      const warm = await get(url, owner, { 'If-None-Match': etag });
      assert.equal(warm.status, 304);
      assert.equal((await warm.arrayBuffer()).byteLength, 0);
      assert.equal((await get(url, peer, { 'If-None-Match': etag })).status, 404);
      assert.equal((await get(url, null, { 'If-None-Match': etag })).status, 401);
    }
    assert.equal((await get(art.url.replace('size=1024', 'size=4096'))).status, 404);
    assert.equal((await get(art.url.replace('soup-chamber', 'walnut-dusk'))).status, 404);
    assert.equal((await get('/assets/coc/soup-chamber-v1-1024.webp')).status, 404);
    db.prepare('UPDATE coc_members SET active=0 WHERE campaign_id=?').run(row.id);
    const denied = await get(art.url, owner, {
      'If-None-Match': '"' + new URL(art.url, base).searchParams.get('v') + '"',
    });
    assert.equal(denied.status, 404);
  } finally {
    db.close();
  }
});
