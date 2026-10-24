const { test } = require('node:test'),
  assert = require('node:assert/strict');
const fs = require('node:fs'),
  os = require('node:os'),
  path = require('node:path');
const { openDatabase } = require('../src/db/index'),
  { createAuth } = require('../src/auth/index'),
  { createApp } = require('../src/app');
const {
  createCharacter,
  addExpression,
  editExpression,
  removeExpression,
  setSharing,
} = require('../src/profiles/uploads');
const png = fs.readFileSync(
  path.join(__dirname, '../public/assets/characters/traveler-neutral.png'),
);
const gif = fs.readFileSync(path.join(__dirname, '../public/assets/characters/traveler-happy.gif'));
const image = { mime: 'image/png', base64: png.toString('base64') };
test('expression edits keep identity and sounds; deleting cleans owner and shared avatar references atomically', async () => {
  const db = openDatabase(':memory:');
  try {
    const owner = await createAuth(db).bootstrap('editowner', 'test-password-123');
    db.prepare(
      'INSERT INTO users(id,username,display_name,password_hash,role,created_at) VALUES(?,?,?,?,?,?)',
    ).run('follower', 'editfriend', '朋友', 'unused', 'member', new Date().toISOString());
    const c = createCharacter(db, owner, { name: '角色', ...image }),
      id = c.id.slice(5),
      e = addExpression(db, owner, id, { name: '大笑', ...image }).expression;
    db.prepare(
      'INSERT INTO character_sounds(character_id,expression,mime,bytes,duration_ms) VALUES(?,?,?,?,?)',
    ).run(id, e, 'audio/wav', Buffer.from('sound'), 1);
    editExpression(db, owner, id, e, { name: '微笑' });
    assert.equal(
      Buffer.from(
        db.prepare('SELECT bytes FROM character_images WHERE expression=?').get(e).bytes,
      ).equals(png),
      true,
    );
    editExpression(db, owner, id, e, { mime: 'image/gif', base64: gif.toString('base64') });
    assert.equal(
      db.prepare('SELECT label,mime FROM character_images WHERE expression=?').get(e).label,
      '微笑',
    );
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM character_sounds').get().n, 1);
    assert.throws(() =>
      editExpression(db, owner, id, e, { name: '不應保存', base64: 'bm90LWltYWdl' }),
    );
    assert.equal(
      db.prepare('SELECT label FROM character_images WHERE expression=?').get(e).label,
      '微笑',
    );
    assert.throws(() => editExpression(db, owner, id, e, { name: '平常' }), {
      code: 'DUPLICATE_EXPRESSION_NAME',
    });
    assert.throws(() => editExpression(db, 'follower', id, e, { name: '盜改' }), {
      code: 'CHARACTER_NOT_FOUND',
    });
    assert.throws(() => removeExpression(db, 'follower', id, e), { code: 'CHARACTER_NOT_FOUND' });
    assert.throws(() => removeExpression(db, owner, id, 'neutral'), {
      code: 'MAIN_IMAGE_REQUIRED',
    });
    assert.throws(() => editExpression(db, owner, id, e, { name: '字'.repeat(21) }), {
      code: 'INVALID_EXPRESSION_NAME',
    });
    editExpression(db, owner, id, 'neutral', { name: '主形象' });
    setSharing(db, owner, id, true);
    const own = {
      version: 5,
      characterId: c.id,
      expression: e,
      avatar: { kind: 'character', characterId: c.id, expression: e },
    };
    const friend = {
      version: 5,
      characterId: 'builtin:traveler',
      expression: 'happy',
      avatar: { kind: 'character', characterId: c.id, expression: e },
    };
    for (const [user, value] of [
      [owner, own],
      ['follower', friend],
    ])
      db.prepare('UPDATE users SET appearance=? WHERE id=?').run(JSON.stringify(value), user);
    removeExpression(db, owner, id, e);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM character_sounds').get().n, 0);
    assert.equal(db.prepare('SELECT 1 FROM character_images WHERE expression=?').get(e), undefined);
    const get = (u) =>
      JSON.parse(db.prepare('SELECT appearance FROM users WHERE id=?').get(u).appearance);
    assert.deepEqual(get(owner), {
      ...own,
      expression: 'neutral',
      avatar: { ...own.avatar, expression: 'neutral' },
    });
    assert.deepEqual(get('follower'), {
      ...friend,
      avatar: { ...friend.avatar, expression: 'neutral' },
    });
    assert.throws(() => removeExpression(db, owner, id, e), { code: 'EXPRESSION_NOT_FOUND' });
    for (let i = 0; i < 15; i++) addExpression(db, owner, id, { name: '表情' + i, ...image });
    assert.throws(() => addExpression(db, owner, id, { name: '第16個', ...image }), {
      code: 'EXPRESSION_LIMIT',
    });
    const old = db
      .prepare("SELECT expression FROM character_images WHERE expression LIKE 'emote-%' LIMIT 1")
      .get().expression;
    removeExpression(db, owner, id, old);
    assert.ok(addExpression(db, owner, id, { name: '可重用名額', ...image }).expression);
  } finally {
    db.close();
  }
});
test('HTTP edit/delete enforce ownership, accept the 4 MB image budget and invalidate assets and room avatars', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bga-expression-edit-')),
    config = {
      port: 0,
      host: '127.0.0.1',
      dbFile: path.join(root, 'app.sqlite'),
      historyDir: path.join(root, 'history'),
      communityDir: path.join(root, 'community'),
    };
  const db = openDatabase(config.dbFile);
  await createAuth(db).bootstrap('emoteeditor', 'test-password-123');
  db.close();
  const app = createApp(config);
  try {
    const { port } = await app.listen(),
      base = 'http://127.0.0.1:' + port;
    const post = async (route, cookie, data = {}) => {
      const res = await fetch(base + '/api/' + route, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
        body: JSON.stringify(data),
      });
      return {
        status: res.status,
        data: await res.json(),
        cookie: res.headers.get('set-cookie')?.split(';')[0],
      };
    };
    const login = await post('auth/login', null, {
        username: 'emoteeditor',
        password: 'test-password-123',
      }),
      cookie = login.cookie;
    const invite = await post('admin/invites', cookie, { days: 1 }),
      friend = await post('auth/register', null, {
        username: 'emoteviewer',
        password: 'test-password-123',
        confirmPassword: 'test-password-123',
        invite: invite.data.code,
      });
    assert.equal(friend.status, 200);
    const c = await post('profile/characters', cookie, { name: '測試角色', ...image }),
      id = c.data.id.slice(5),
      e = (await post('profile/characters/' + id + '/emotes', cookie, { name: '揮手', ...image }))
        .data.expression;
    const route = 'profile/characters/' + id + '/expressions/' + e;
    assert.equal((await post(route + '/edit', friend.cookie, { name: '越權' })).status, 404);
    assert.equal((await post(route + '/delete', friend.cookie)).status, 404);
    assert.equal((await post(route + '/delete', null)).status, 401);
    const large = Buffer.concat([png, Buffer.alloc(1100000)]);
    const edited = await post(route + '/edit', cookie, {
      name: '打招呼',
      base64: large.toString('base64'),
      mime: 'image/png',
    });
    assert.equal(edited.status, 200, JSON.stringify(edited.data));
    assert.equal(
      (await post('profile/characters/' + id + '/sharing', cookie, { shared: true })).status,
      200,
    );
    const opts = await (
      await fetch(base + '/api/profile/options', { headers: { Cookie: friend.cookie } })
    ).json();
    assert.equal(opts.characters.find((x) => x.id === c.data.id).labels[e], '打招呼');
    assert.equal(
      (
        await post('profile/appearance', cookie, {
          version: 5,
          characterId: c.data.id,
          expression: e,
        })
      ).status,
      200,
    );
    const room = (await post('create', cookie, { type: 'poker', roomName: '表情測試' })).data;
    const social = await post('social', cookie, {
      code: room.code,
      kind: 'expression',
      expression: e,
    });
    assert.equal(social.status, 200);
    const asset = '/assets/characters/user/' + id + '/' + e;
    assert.equal((await fetch(base + asset, { headers: { Cookie: cookie } })).status, 200);
    assert.equal((await post(route + '/delete', cookie)).status, 200);
    assert.equal((await fetch(base + asset, { headers: { Cookie: cookie } })).status, 404);
    const me = await (await fetch(base + '/api/auth/me', { headers: { Cookie: cookie } })).json();
    assert.equal(me.appearance.expression, 'neutral');
    const state = await (
      await fetch(base + '/api/state?code=' + room.code, { headers: { Cookie: cookie } })
    ).json();
    assert.match(
      state.players.find((p) => p.name === 'emoteeditor').avatar,
      new RegExp(`^/characters/${login.data.id}\\?v=[\\w-]{16}&size=256$`),
    );
    assert.equal(
      (await post('profile/characters/' + id + '/expressions/neutral/delete', cookie)).data.code,
      'MAIN_IMAGE_REQUIRED',
    );
  } finally {
    await app.close();
    fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});
