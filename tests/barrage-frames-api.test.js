const { test } = require('node:test'),
  assert = require('node:assert/strict');
const fs = require('node:fs'),
  os = require('node:os'),
  path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');
const { createApp } = require('../src/app'),
  { openDatabase } = require('../src/db'),
  { createAuth } = require('../src/auth');
const password = 'synthetic-barrage-test-password';

async function fixture(t) {
  const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'bga-barrage-api-'));
  const config = {
    host: '127.0.0.1',
    port: 0,
    dbFile: path.join(root, 'app.sqlite'),
    historyDir: path.join(root, 'history'),
    communityDir: path.join(root, 'community'),
    externalSideEffectsEnabled: false,
  };
  const db = openDatabase(config.dbFile);
  await createAuth(db).bootstrap('frame_host', password);
  const hash = db
    .prepare("SELECT password_hash FROM users WHERE username='frame_host'")
    .get().password_hash;
  require('../src/db').transaction(db, () => {
    const insert = db.prepare(
      'INSERT INTO users(id,username,display_name,password_hash,role,created_at) VALUES(?,?,?,?,?,?)',
    );
    for (const name of ['paper', 'comic', 'pixel', 'outsider'])
      insert.run(
        require('node:crypto').randomUUID(),
        'frame_' + name,
        name,
        hash,
        'member',
        new Date().toISOString(),
      );
  });
  db.close();
  const app = createApp(config),
    { port } = await app.listen(),
    base = 'http://127.0.0.1:' + port,
    users = {};
  t.after(async () => {
    await app.close();
    const absolute = fs.realpathSync(root);
    assert.equal(path.dirname(absolute), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(absolute).startsWith('bga-barrage-api-'));
    fs.rmSync(absolute, { recursive: true, force: true, maxRetries: 5 });
  });
  async function request(route, who, options = {}) {
    const response = await fetch(base + '/api/' + route, {
      ...options,
      headers: { ...(users[who] ? { Cookie: users[who] } : {}), ...options.headers },
    });
    return {
      status: response.status,
      body: await response.json(),
      cookie: response.headers.get('set-cookie')?.split(';')[0],
    };
  }
  const post = (route, who, data = {}) =>
    request(route, who, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  const loggedIn = await post('auth/login', null, { username: 'frame_host', password });
  assert.equal(loggedIn.status, 200);
  users.host = loggedIn.cookie;
  for (const name of ['paper', 'comic', 'pixel', 'outsider']) {
    const registered = await post('auth/login', null, { username: 'frame_' + name, password });
    assert.equal(registered.status, 200);
    users[name] = registered.cookie;
  }
  async function create(type = 'poker') {
    const created = await post('create', 'host', { type });
    assert.equal(created.status, 200);
    const code = created.body.code;
    for (const who of ['paper', 'comic', 'pixel'])
      assert.equal((await post('join', who, { code })).status, 200);
    return code;
  }
  return { base, users, request, post, create };
}

for (const type of ['poker', 'thunder', 'majority', 'gift', 'draw'])
  test(type + ': catalog and four legacy frame variants reach confirmed text events', async (t) => {
    const f = await fixture(t),
      options = await f.request('social/options', 'paper');
    assert.equal(options.status, 200);
    assert.deepEqual(
      options.body.barrageFrames.filter((o) => !o.achievementId),
      [
        { id: 'default', label: '預設' },
        { id: 'paper', label: '紙張' },
        { id: 'comic', label: '漫畫' },
        { id: 'pixel', label: '像素' },
        { id: 'neon', label: '電流霓虹' },
        { id: 'orbit', label: '星際軌道' },
        { id: 'holo', label: '全息故障' },
        { id: 'arcade', label: '街機像素' },
        { id: 'mech', label: '機械核心' },
        { id: 'berry', label: '奶油草莓' },
        { id: 'cat', label: '貓咪肉球' },
        { id: 'cloud', label: '軟糖雲朵' },
        { id: 'jelly', label: '深海水母' },
        { id: 'shiba', label: '柴犬吐司' },
        { id: 'forest', label: '森林精靈' },
        { id: 'dragon', label: '龍焰寶藏' },
        { id: 'frost', label: '冰晶王冠' },
        { id: 'moon', label: '月光魔法' },
        { id: 'potion', label: '蘑菇藥釜' },
        { id: 'ink', label: '水墨游魚' },
        { id: 'sakura', label: '御守櫻花' },
        { id: 'steam', label: '蒸汽郵件' },
        { id: 'burst', label: '漫畫爆擊' },
        { id: 'royal', label: '皇家劇院' },
      ],
    );
    assert.ok(options.body.emojis.includes('🎉'));
    const selections = [
      ['host', 'default'],
      ['paper', 'paper'],
      ['comic', 'comic'],
      ['pixel', 'pixel'],
    ];

    const code = await f.create(type);
    for (const [who, id] of selections) {
      const sent = await f.post('social', who, {
        code,
        kind: 'barrage',
        message: type + ' ' + id,
        builtinFrameId: id,
      });
      assert.equal(sent.status, 200, type + ' ' + id);
      const event = sent.body.barrages.at(-1);
      assert.deepEqual(event.frame, { kind: 'builtin', id, version: 1 });
      assert.equal(event.kind, 'barrage');
      assert.equal(event.message, type + ' ' + id);
      assert.equal(typeof event.id, 'string');
      assert.equal(typeof event.at, 'number');
      assert.equal(Object.hasOwn(event.frame, 'url'), false);
      assert.equal(Object.hasOwn(event.frame, 'style'), false);
    }
    const state = await f.request('state?code=' + code, 'paper');
    assert.equal(state.status, 200);
    assert.deepEqual(
      state.body.barrages.map((event) => event.frame.id),
      selections.map(([, id]) => id),
    );
    const outsider = await f.post('social', 'outsider', {
      code,
      kind: 'barrage',
      message: 'not a room member',
      builtinFrameId: 'paper',
    });
    assert.equal(outsider.status, 403);
    assert.equal(outsider.body.code, 'NOT_SEATED');
    assert.equal((await f.request('social/options', null)).status, 401);
  });

test('invalid frame payloads fail before event insertion and retain the existing successful-send rate limit', async (t) => {
  const f = await fixture(t),
    code = await f.create();
  for (const builtinFrameId of [
    'unknown',
    '',
    42,
    ['paper'],
    { id: 'paper' },
    'https://example.com/frame.png',
    'url(https://example.com/frame.png)',
    'paper ',
    { style: 'background:red' },
  ]) {
    const rejected = await f.post('social', 'comic', {
      code,
      kind: 'barrage',
      message: 'rejected',
      builtinFrameId,
    });
    assert.equal(rejected.status, 400);
    assert.equal(rejected.body.code, 'INVALID_BARRAGE_FRAME');
  }
  const baseline = await f.request('state?code=' + code, 'host');
  assert.deepEqual(baseline.body.barrages, []);
  const first = await f.post('social', 'comic', {
    code,
    kind: 'barrage',
    message: 'accepted',
    builtinFrameId: 'comic',
  });
  assert.equal(first.status, 200);
  const next = await f.post('social', 'comic', {
    code,
    kind: 'barrage',
    message: 'too soon',
    builtinFrameId: 'pixel',
  });
  assert.equal(next.status, 429);
  assert.equal(next.body.code, 'SOCIAL_RATE_LIMIT');
  const state = await f.request('state?code=' + code, 'host');
  assert.equal(state.body.barrages.length, 1);
  assert.equal(state.body.barrages[0].message, 'accepted');
  assert.deepEqual(state.body.barrages[0].frame, { kind: 'builtin', id: 'comic', version: 1 });
});

test('old clients get default frames, later selection cannot rewrite a previous event, and emojis stay unframed', async (t) => {
  const f = await fixture(t),
    code = await f.create();
  const legacy = await f.post('social', 'host', { code, kind: 'barrage', message: 'old client' });
  assert.equal(legacy.status, 200);
  const original = legacy.body.barrages[0];
  assert.deepEqual(original.frame, { kind: 'builtin', id: 'default', version: 1 });
  const nullFrame = await f.post('social', 'paper', {
    code,
    kind: 'barrage',
    message: 'null client',
    builtinFrameId: null,
  });
  assert.equal(nullFrame.status, 200);
  assert.deepEqual(nullFrame.body.barrages.at(-1).frame, original.frame);
  const emoji = await f.post('social', 'host', {
    code,
    kind: 'emoji',
    emoji: '🎉',
    builtinFrameId: 'paper',
  });
  assert.equal(emoji.status, 200);
  const emojiEvent = emoji.body.barrages.at(-1);
  assert.equal(emojiEvent.kind, 'emoji');
  assert.equal(emojiEvent.emoji, '🎉');
  assert.equal(Object.hasOwn(emojiEvent, 'frame'), false);
  const expression = await f.post('social', 'host', {
    code,
    kind: 'expression',
    expression: 'happy',
    builtinFrameId: 'comic',
  });
  assert.equal(expression.status, 200);
  assert.equal(Object.hasOwn(expression.body.expressions.at(-1), 'frame'), false);
  await delay(1501);
  const changed = await f.post('social', 'host', {
    code,
    kind: 'barrage',
    message: 'new choice',
    builtinFrameId: 'pixel',
  });
  assert.equal(changed.status, 200);
  assert.deepEqual(
    changed.body.barrages.find((event) => event.id === original.id),
    original,
  );
  assert.deepEqual(changed.body.barrages.at(-1).frame, {
    kind: 'builtin',
    id: 'pixel',
    version: 1,
  });
});

test('new frame assets use exact public routes, canonical bytes, correct MIME and revalidation', async (t) => {
  const f = await fixture(t);
  for (const extension of ['js', 'css']) {
    const asset = '/shared/barrage-frames.' + extension,
      response = await fetch(f.base + asset);
    assert.equal(response.status, extension === 'js' ? 404 : 200);
    if (extension === 'js') continue;
    assert.match(
      response.headers.get('content-type'),
      extension === 'js' ? /^text\/javascript; charset=utf-8$/ : /^text\/css$/,
    );
    assert.equal(response.headers.get('cache-control'), 'private, no-cache');
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.deepEqual(
      Buffer.from(await response.arrayBuffer()),
      fs.readFileSync(path.join(__dirname, '../public', asset.slice(1))),
    );
    for (const suffix of ['.extra', '/extra'])
      assert.equal((await fetch(f.base + asset + suffix)).status, 404);
  }
});
