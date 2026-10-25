'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  { randomUUID } = require('node:crypto');
const { RoomPings, scene, target } = require('../src/rooms/pings'),
  M = require('../frontend/src/engines/ping-model.js').default;
const room = (code = 'ABCDEF') => ({
  code,
  type: 'draw',
  phase: 'drawing',
  roundId: 'round-1',
  canvas: { epoch: 'canvas-1' },
  players: [{ id: 'a' }, { id: 'b' }],
});
function setup() {
  let time = 10000;
  const hub = new RoomPings({ now: () => time }),
    r = room(),
    ctx = hub.context(r),
    input = {
      ...ctx,
      type: 'attention',
      requestId: 'request-001',
      target: { kind: 'viewport', x: 0.25, y: 0.75 },
    };
  return {
    hub,
    r,
    input,
    advance(n) {
      time += n;
    },
  };
}
test('four directional slices and center dead zone are deterministic', () => {
  assert.equal(M.pick(0, 0), 'ping');
  assert.equal(M.pick(23, 0), 'ping');
  assert.equal(M.pick(24, 0), 'look');
  assert.equal(M.pick(-30, 0), 'question');
  assert.equal(M.pick(0, -30), 'attention');
  assert.equal(M.pick(0, 30), 'help');
});
test('wheel geometry keeps square tracks and the backdrop rings centered on the selected cell', () => {
  const css = require('./helpers/browser-modules.cjs').readFileSync(
    require('node:path').join(__dirname, '../public/shared/room-pings.css'),
    'utf8',
  );
  const rule = [...css.replace(/\s+/g, '').matchAll(/\.room-ping-wheel\{([^}]+)\}/g)].at(-1)[1];
  const grid = /grid-template:repeat\(3,([\d.]+)px\)\/repeat\(3,([\d.]+)px\)/.exec(rule);
  assert.ok(grid);
  assert.equal(
    Number(grid[1]),
    Number(grid[2]),
    'equal tracks prevent an elliptical wheel and selection ring',
  );
  const center = /radial-gradient\(circleat([\d.]+)%([\d.]+)%/.exec(rule);
  assert.ok(center);
  assert.equal(Number(center[1]), 50);
  assert.equal(Number(center[2]), 50);
});
test('personal media defaults to built-in images and sounds, accepts only known asset references', () => {
  for (const [type, p] of Object.entries(M.preferences()))
    assert.deepEqual(p, {
      sound: {
        effect:
          'ping-' +
          (['ping', 'attention', 'question', 'help', 'look'].includes(type) ? type : 'ping'),
      },
    });
  const p = M.preferences({
    ping: { imageUrl: 'https://example.com/private.png', sound: { effect: 'unknown' } },
    help: {
      sound: {
        url: '/assets/characters/sounds/12345678-1234-1234-1234-123456789abc/happy',
        durationMs: 320,
      },
    },
    look: { sound: { url: 'javascript:bad', durationMs: 320 } },
  });
  assert.deepEqual(p.ping, {});
  assert.equal(p.help.sound.durationMs, 320);
  assert.deepEqual(p.look, {});
  assert.equal(p.help.imageUrl, undefined);
  assert.deepEqual(M.preferences({ look: { sound: { effect: 'ping-voice-look' } } }).look, {
    sound: { effect: 'ping-voice-look' },
  });
});
test('component coordinates survive different layout sizes and offscreen targets get edge guidance', () => {
  const p = M.point({ left: 100, top: 50, width: 400, height: 200 }, 200, 100);
  assert.deepEqual(p, { x: 0.25, y: 0.25 });
  const q = M.place({ left: 20, top: 30, width: 200, height: 100 }, p, 390, 844);
  assert.equal(q.x, 70);
  assert.equal(q.y, 55);
  assert.equal(q.edge, false);
  const outside = M.place({ left: 800, top: 20, width: 100, height: 100 }, p, 390, 844);
  assert.equal(outside.edge, true);
  assert.equal(outside.x, 358);
});
test('targets allow only public ids, finite unit points and current logical surface scenes', () => {
  const r = room();
  for (const x of [NaN, Infinity, -0.1, 1.1, '0.5'])
    assert.throws(() => target(r, { kind: 'viewport', x, y: 0.5 }));
  assert.throws(() => target(r, { kind: 'element', key: '#privateHand', x: 0, y: 0 }));
  assert.throws(() => target(r, { kind: 'element', key: 'player:unknown', x: 0, y: 0 }));
  assert.equal(
    target(r, { kind: 'element', key: 'player:a', x: 0.2, y: 0.3, private: 'discard' }).private,
    undefined,
  );
  assert.equal(
    target(r, { kind: 'surface', key: 'draw-canvas', epoch: scene(r), x: 1, y: 0 }).key,
    'draw-canvas',
  );
  assert.throws(() => target(r, { kind: 'surface', key: 'draw-canvas', epoch: 'old', x: 0, y: 0 }));
  r.type = 'thunder';
  r.tiles = [{ start: 8 }];
  assert.equal(
    target(r, { kind: 'surface', key: 'race-cell:2:10', epoch: scene(r), x: 0.5, y: 0.5 }).key,
    'race-cell:2:10',
  );
  assert.throws(() =>
    target(r, { kind: 'surface', key: 'race-cell:2:99', epoch: scene(r), x: 0.5, y: 0.5 }),
  );
});
test('server assigns identity, expiry and ids; duplicate is not broadcast or charged twice', () => {
  const { hub, r, input } = setup(),
    events = [];
  hub.subscribe(r, { userId: 'u', send: (kind, x) => events.push(x) });
  const before = JSON.stringify(r);
  const a = hub.post(r, 'a', '玩家', input),
    b = hub.post(r, 'a', '玩家', input);
  assert.equal(a.event.id, b.event.id);
  assert.equal(b.duplicate, true);
  assert.equal(events.length, 1);
  assert.equal(a.event.expiresAt - a.event.at, 5000);
  assert.equal(JSON.stringify(r), before);
  assert.throws(
    () => hub.post(r, 'a', '玩家', { ...input, type: 'help' }),
    (e) => e.status === 409,
  );
  assert.throws(
    () => hub.post(r, 'a', '玩家', { ...input, requestId: 'request-002' }),
    (e) => e.status === 429,
  );
});
test('stale room/scene, unknown type and invalid request ids cannot broadcast', () => {
  const { hub, r, input } = setup();
  for (const bad of [
    { roomInstanceId: 'old' },
    { scene: 'old' },
    { type: '<script>' },
    { requestId: '' },
  ])
    assert.throws(() => hub.post(r, 'a', 'a', { ...input, ...bad }));
  assert.equal(hub.get(r).events.length, 0);
  r.roundId = 'round-2';
  assert.throws(
    () => hub.post(r, 'a', 'a', input),
    (e) => e.status === 409,
  );
});
test('an expired retry reports current server time instead of reviving an old effect', () => {
  const f = setup();
  const first = f.hub.post(f.r, 'a', 'a', f.input);
  f.advance(6000);
  const retry = f.hub.post(f.r, 'a', 'a', f.input);
  assert.equal(retry.event.id, first.event.id);
  assert.ok(retry.serverNow > retry.event.expiresAt);
  assert.equal(retry.duplicate, true);
});
test('room budgets and receipt memory are bounded, expiry does not affect game state', () => {
  const f = setup();
  for (let i = 0; i < 180; i++) {
    f.hub.post(f.r, 'a', 'a', { ...f.input, requestId: 'request-' + i });
    f.advance(1500);
  }
  const s = f.hub.get(f.r);
  assert.equal(s.receipts.size, 128);
  assert.ok(s.events.length <= 4);
  const g = setup();
  for (let i = 0; i < 12; i++)
    g.hub.post(g.r, 'p' + i, 'n', { ...g.input, requestId: 'request-' + i });
  assert.throws(
    () => g.hub.post(g.r, 'next', 'n', { ...g.input, requestId: 'request-next' }),
    (e) => e.status === 429,
  );
});
test('stream caps, unsubscribe, room reuse and shutdown dispose old clients', () => {
  const { hub, r } = setup();
  let closed = 0;
  for (let i = 0; i < 3; i++)
    hub.subscribe(r, {
      userId: 'a',
      send() {},
      close() {
        closed++;
      },
    });
  assert.throws(
    () => hub.subscribe(r, { userId: 'a' }),
    (e) => e.status === 429,
  );
  const old = hub.context(r).roomInstanceId;
  const next = room();
  assert.notEqual(hub.context(next).roomInstanceId, old);
  assert.equal(closed, 3);
  const drop = hub.subscribe(next, {
    userId: 'b',
    close() {
      closed++;
    },
  });
  drop();
  hub.clear();
  assert.equal(closed, 3);
  assert.equal(hub.rooms.size, 0);
});
test('lobby supports all 80 visitors with three tabs while game rooms retain their smaller stream cap', () => {
  const hub = new RoomPings(),
    lobby = { ...room('__LOBBY__'), type: 'lobby' };
  for (let i = 0; i < 80; i++)
    for (let tab = 0; tab < 3; tab++) hub.subscribe(lobby, { userId: 'user-' + i, close() {} });
  assert.equal(hub.get(lobby).clients.size, 240);
  assert.throws(
    () => hub.subscribe(lobby, { userId: 'extra' }),
    (e) => e.status === 429,
  );
  const table = room();
  for (let i = 0; i < 32; i++) hub.subscribe(table, { userId: 'table-' + i, close() {} });
  assert.throws(
    () => hub.subscribe(table, { userId: 'extra' }),
    (e) => e.status === 429,
  );
  hub.clear();
});

test('authenticated HTTP and live SSE are isolated, ephemeral and cleanly drained on shutdown', async () => {
  const fs = require('./helpers/browser-modules.cjs'),
    os = require('node:os'),
    path = require('node:path'),
    { openDatabase } = require('../src/db'),
    { createAuth } = require('../src/auth'),
    { createApp } = require('../src/app');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bga-pings-')),
    config = {
      host: '127.0.0.1',
      port: 0,
      dbFile: path.join(root, 'app.sqlite'),
      communityDir: path.join(root, 'community'),
      musicDir: path.join(root, 'music'),
      externalSideEffectsEnabled: false,
      marketAutomationEnabled: false,
      achievementPurpose: 'test',
    };
  const db = openDatabase(config.dbFile);
  await createAuth(db).bootstrap('pinghost', 'synthetic-password');
  db.close();
  const app = createApp(config),
    aborts = [];
  try {
    const { port } = await app.listen(),
      base = 'http://127.0.0.1:' + port;
    const post = async (route, cookie, data) => {
      const res = await fetch(base + '/api/' + route, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) },
        body: JSON.stringify(data),
      });
      return {
        status: res.status,
        data: await res.json(),
        cookie: res.headers.get('set-cookie')?.split(';')[0],
      };
    };
    const get = async (route, cookie) => {
      const res = await fetch(base + '/api/' + route, { headers: cookie ? { cookie } : {} });
      return { status: res.status, data: await res.json() };
    };
    const host = (
        await post('auth/login', null, { username: 'pinghost', password: 'synthetic-password' })
      ).cookie,
      invite = (await post('admin/invites', host, {})).data.code;
    const guest = (
      await post('auth/register', null, {
        username: 'pingguest',
        password: 'synthetic-password',
        confirmPassword: 'synthetic-password',
        invite,
      })
    ).cookie;
    assert.equal((await get('pings/events?code=__LOBBY__', guest)).status, 403);
    const lobbyHost = (await get('lobby', host)).data;
    const lobbyGuest = (await get('lobby', guest)).data;
    assert.equal(lobbyHost.pingContext.roomInstanceId, lobbyGuest.pingContext.roomInstanceId);
    const lobbyAbort = new AbortController();
    aborts.push(lobbyAbort);
    const lobbyStream = await fetch(base + '/api/pings/events?code=__LOBBY__', {
        headers: { cookie: guest },
        signal: lobbyAbort.signal,
      }),
      lobbyReader = lobbyStream.body.getReader();
    assert.match(new TextDecoder().decode((await lobbyReader.read()).value), /event: ready/);
    const lobbyPing = {
      code: '__LOBBY__',
      ...lobbyHost.pingContext,
      type: 'look',
      target: { kind: 'element', key: 'lobby-stage', x: 0.2, y: 0.4 },
      requestId: randomUUID(),
    };
    const lobbySent = await post('pings', host, lobbyPing);
    assert.equal(lobbySent.status, 200);
    assert.ok(
      new TextDecoder().decode((await lobbyReader.read()).value).includes(lobbySent.data.event.id),
    );
    await lobbyReader.cancel();
    lobbyAbort.abort();
    const code = (await post('create', host, { type: 'quacks' })).data.code;
    assert.equal((await get('pings/events?code=' + code)).status, 401);
    assert.equal((await get('pings/events?code=' + code, guest)).status, 403);
    await post('join', guest, { code });
    const before = (await get('state?code=' + code, host)).data;
    const controllers = [new AbortController(), new AbortController()];
    aborts.push(...controllers);
    const streams = await Promise.all(
      [host, guest].map((cookie, i) =>
        fetch(base + '/api/pings/events?code=' + code, {
          headers: { cookie },
          signal: controllers[i].signal,
        }),
      ),
    );
    const readers = streams.map((r) => r.body.getReader());
    for (const reader of readers)
      assert.match(new TextDecoder().decode((await reader.read()).value), /event: ready/);
    const request = {
      code,
      ...before.pingContext,
      type: 'help',
      target: { kind: 'element', key: 'player:' + before.me, x: 0.5, y: 0.5 },
      requestId: randomUUID(),
    };
    assert.notEqual(before.pingContext.roomInstanceId, lobbyHost.pingContext.roomInstanceId);
    assert.equal((await post('pings', host, { ...lobbyPing, code })).status, 409);
    assert.equal(
      (
        await post('pings', host, {
          ...request,
          target: { kind: 'element', key: 'lobby-stage', x: 0.5, y: 0.5 },
        })
      ).status,
      400,
    );
    const sent = await post('pings', host, request);
    assert.equal(sent.status, 200);
    for (const reader of readers) {
      const text = new TextDecoder().decode((await reader.read()).value);
      assert.match(text, /event: ping/);
      assert.ok(text.includes(sent.data.event.id));
    }
    assert.equal((await post('pings', host, request)).data.duplicate, true);
    assert.equal(
      (
        await post('pings', host, {
          ...request,
          requestId: randomUUID(),
          target: { kind: 'element', key: '#hand', x: 0.5, y: 0.5 },
        })
      ).status,
      400,
    );
    assert.equal(
      (await post('pings', host, { ...request, requestId: randomUUID(), type: 'question' })).status,
      429,
    );
    assert.equal((await post('pings', host, { ...request, scene: 'stale' })).status, 409);
    const after = (await get('state?code=' + code, host)).data;
    assert.equal(after.version, before.version);
    assert.equal(after.phase, before.phase);
    const guestState = (await get('state?code=' + code, guest)).data;
    await post('kick', host, { code, playerId: guestState.me, confirmed: true });
    assert.equal(
      (
        await post('pings', guest, {
          ...request,
          ...guestState.pingContext,
          requestId: randomUUID(),
        })
      ).status,
      403,
    );
    for (const asset of ['ping-model.js', 'room-pings.css'])
      assert.equal(
        (await fetch(base + '/shared/' + asset)).status,
        asset.endsWith('.js') ? 404 : 200,
      );
    for (const type of ['ping', 'attention', 'question', 'help', 'look']) {
      const asset = 'ping-' + type + '.wav',
        res = await fetch(base + '/assets/game-sounds/' + asset);
      assert.equal(res.status, 200, asset);
      assert.equal(res.headers.get('content-type'), 'audio/mpeg');
      const bytes = Buffer.from(await res.arrayBuffer());
      assert.deepEqual(
        bytes,
        fs.readFileSync(
          path.join(__dirname, '../public/assets/game-sounds', asset.replace(/\.wav$/, '.mp3')),
        ),
      );
    }
    assert.equal((await fetch(base + '/assets/game-sounds/ping-voice-amazing.mp3')).status, 401);
    assert.equal(
      (
        await fetch(base + '/assets/game-sounds/ping-voice-amazing.mp3', {
          headers: { Cookie: guest },
        })
      ).status,
      403,
    );
    assert.equal((await post('achievements/redeem', host, { code: '我愛士憲' })).status, 200);
    for (const name of [
      'amazing',
      'bad',
      'card-check',
      'sleep',
      'look',
      'legacy',
      'no-bluff',
      'cry',
      'coward',
      'goodnight',
      'senior',
      'practice',
      'huh',
      'what',
    ]) {
      const asset = 'ping-voice-' + name + '.mp3';
      const res = await fetch(base + '/assets/game-sounds/' + asset, { headers: { Cookie: host } });
      if (!fs.existsSync(path.join(__dirname, '../public/assets/game-sounds', asset))) {
        assert.equal(res.status, 404, 'user clips are supplied separately from Git');
        continue;
      }
      assert.equal(res.status, 200, asset);
      assert.equal(res.headers.get('content-type'), 'audio/mpeg');
      assert.deepEqual(
        Buffer.from(await res.arrayBuffer()),
        fs.readFileSync(
          path.join(__dirname, '../public/assets/game-sounds', asset.replace(/\.wav$/, '.mp3')),
        ),
      );
    }
    await app.close(); // Active SSE streams must not make shutdown wait forever.
    for (const reader of readers) await reader.cancel().catch(() => {});
  } finally {
    for (const a of aborts) a.abort();
    await app.close();
    assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep));
    fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});

test('ten symbols support an account-owned five-slot wheel with safe fallback and strict slot validation', () => {
  const { validatePingPreferences } = require('../src/profiles/pings');
  const chosen = ['angry', 'sleep', 'speechless', 'surprised', 'admire'];
  const input = Object.fromEntries(chosen.map((type, wheelSlot) => [type, { wheelSlot }]));
  const saved = validatePingPreferences({}, 'test', input),
    prefs = M.preferences(saved);
  assert.deepEqual(M.wheel(prefs), chosen);
  assert.equal(M.pick(0, 0, 24, prefs), 'angry');
  assert.equal(M.pick(0, -100, 24, prefs), 'sleep');
  assert.equal(M.pick(-100, 0, 24, prefs), 'speechless');
  assert.equal(M.pick(0, 100, 24, prefs), 'surprised');
  assert.equal(M.pick(100, 0, 24, prefs), 'admire');
  assert.equal(
    prefs.angry.sound.effect,
    'ping-ping',
    'new symbols reuse an actual available default sound',
  );
  assert.throws(() => validatePingPreferences({}, 'test', { angry: { wheelSlot: 0 } }));
  assert.throws(() => validatePingPreferences({}, 'test', { ...input, admire: { wheelSlot: 0 } }));
  assert.deepEqual(M.wheel({ angry: { wheelSlot: 0 } }), [
    'ping',
    'attention',
    'question',
    'help',
    'look',
  ]);
});

test('native ping icons are independent of voice cues and reject unknown icon identifiers', () => {
  const { validatePingPreferences } = require('../src/profiles/pings');
  const value = { ping: { iconType: 'admire', sound: { effect: 'ping-voice-amazing' } } };
  const db = {
    prepare: (sql) =>
      sql.includes('user_achievements')
        ? { all: () => [{ achievement_id: 'draw-fastest-correct' }] }
        : { get: () => ({ appearance: null }) },
  };
  const saved = validatePingPreferences(db, 'test', value);
  assert.equal(saved.ping.iconType, 'admire');
  assert.equal(saved.ping.sound.effect, 'ping-voice-amazing');
  assert.equal(M.preferences(saved).ping.iconType, 'admire');
  assert.equal(
    M.preferences({ ping: { ...saved.ping, sound: { effect: 'ping-voice-bad' } } }).ping.iconType,
    'admire',
  );
  assert.throws(() =>
    validatePingPreferences({}, 'test', { ping: { iconType: '<svg onload=alert(1)>' } }),
  );
  assert.equal(M.preferences({ ping: { iconType: 'unknown' } }).ping.iconType, undefined);
});

test('all ten native ping symbols have distinct colors independent of their wheel slot', () => {
  const model = require('../frontend/src/engines/ping-model.js').default;
  assert.equal(Object.keys(model.colors).length, 10);
  assert.equal(new Set(Object.values(model.colors)).size, 10);
  for (const type of Object.keys(model.types)) assert.match(model.colors[type], /^#[a-f0-9]{6}$/i);
});
