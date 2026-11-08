'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, createHash } = require('node:crypto');
const { EventEmitter } = require('node:events');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { createAuth } = require('../src/auth');
const { createGachaAnnouncements } = require('../src/gacha/announcements');
const { GachaStore } = require('../src/gacha/store');
const { appFixture } = require('./helpers/app-fixture.cjs');
const { versionFor } = require('../src/http/static-cache');

test('opt-in spectator stream follows the owner and exposes only the current revealed card', async (t) => {
  const { base } = await appFixture(t, {
    config: { gachaChoose: () => 0 },
    seed: async (db) => {
      await createAuth(db).bootstrap('watch_host', 'test-password-123');
      db.prepare(
        "INSERT INTO users(id,username,display_name,password_hash,role,created_at) SELECT ?,?, ?,password_hash,'member',created_at FROM users WHERE username='watch_host'",
      ).run(randomUUID(), 'watch_viewer', '觀眾');
      const { id } = db.prepare("SELECT id FROM users WHERE username='watch_host'").get();
      new GachaStore(db).wallet(id);
      db.prepare('UPDATE gacha_wallets SET coins=1000 WHERE user_id=?').run(id);
    },
  });
  const send = (route, body, cookie) =>
    fetch(base + route, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
      body: JSON.stringify(body),
    });
  async function login(username) {
    const response = await send('/api/auth/login', { username, password: 'test-password-123' });
    assert.equal(response.status, 200);
    return response.headers.get('set-cookie').split(';')[0];
  }
  const host = await login('watch_host');
  const viewer = await login('watch_viewer');
  const route = '/api/gacha/spectate';
  const controller = new AbortController();
  async function watchState(path, cookie = viewer, signal = controller.signal) {
    const response = await fetch(base + path, {
      headers: { Cookie: cookie },
      signal: AbortSignal.any([controller.signal, signal, AbortSignal.timeout(10000)]),
    });
    assert.equal(response.status, 200);
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffered = '';
    return async () => {
      while (true) {
        const boundary = buffered.indexOf('\n\n');
        if (boundary >= 0) {
          const block = buffered.slice(0, boundary);
          buffered = buffered.slice(boundary + 2);
          if (block.startsWith('event: state\n')) return JSON.parse(block.split('\ndata: ')[1]);
          continue;
        }
        const { done, value } = await reader.read();
        assert.equal(done, false);
        buffered += decoder.decode(value, { stream: true });
      }
    };
  }
  try {
    assert.equal((await fetch(base + route)).status, 401);
    const listing = await watchState(route);
    assert.deepEqual((await listing()).rooms, []);
    const requestId = randomUUID();
    const draw = await send('/api/gacha/draw', { requestId, pool: 'all', count: 10 }, host);
    assert.equal(draw.status, 200);
    const receipt = await draw.json();
    const start = { action: 'start', requestId, market: true };
    assert.equal((await send(route, start, viewer)).status, 404);
    const response = await send(route, start, host);
    assert.equal(response.status, 200);
    const { id } = await response.json();
    const listed = await listing();
    assert.equal(listed.rooms[0].id, id);
    assert.equal(listed.hosted, undefined);
    const hostListing = await watchState(route, host);
    assert.deepEqual((await hostListing()).hosted, { id, viewerNames: [] });
    const firstView = new AbortController();
    const stream = await watchState(route + '/' + id, viewer, firstView.signal);
    assert.deepEqual((await hostListing()).hosted, { id, viewerNames: ['觀眾'] });
    const initial = await stream();
    assert.equal(initial.phase, 'market');
    assert.equal(initial.item, undefined);
    assert.equal(initial.ending, undefined);
    assert.equal(initial.wallet, undefined);
    const update = (action, owner = host) => send(route, { id, action }, owner);
    assert.equal((await update('card', viewer)).status, 404);
    assert.equal((await update('card')).status, 400);
    assert.equal((await update('settle')).status, 200);
    const settled = await stream();
    assert.equal(settled.ending, 'fall');
    assert.equal(settled.item, undefined);
    assert.equal((await update('board')).status, 200);
    assert.equal((await stream()).phase, 'back');
    assert.equal((await update('card')).status, 200);
    const late = await watchState(route + '/' + id);
    const revealed = await late();
    assert.equal(revealed.phase, 'card');
    assert.deepEqual(revealed.item, receipt.results[0]);
    assert.equal(revealed.items, undefined);
    firstView.abort();
    assert.equal((await update('next')).status, 200);
    const next = await late();
    assert.equal(next.index, 1);
    assert.equal(next.phase, 'back');
    assert.equal(next.item, undefined);
    assert.equal((await update('spotlight')).status, 200);
    assert.deepEqual((await late()).item, receipt.results[1]);
    assert.equal((await update('card')).status, 200);
    assert.equal((await late()).phase, 'card');
    assert.equal((await update('summary')).status, 200);
    assert.deepEqual((await late()).items, receipt.results);
    assert.equal((await update('close')).status, 200);
    assert.equal((await late()).phase, 'closed');
    assert.deepEqual((await listing()).rooms, []);
    assert.equal((await hostListing()).hosted, undefined);
  } finally {
    controller.abort();
  }
});

test('new gacha voices require ownership to download and equip as a Ping cue', async (t) => {
  const voices = require('../public/shared/ping-voices.json').filter(({ gachaOnly }) => gachaOnly);
  const effect = 'ping-voice-wings';
  const key = 'sounds:' + effect;
  const { base } = await appFixture(t, {
    seed: async (db) => {
      await createAuth(db).bootstrap('voice_owner', 'test-password-123');
      const { id } = db.prepare('SELECT id FROM users WHERE username=?').get('voice_owner');
      const store = new GachaStore(db);
      store.wallet(id);
      db.prepare('UPDATE gacha_wallets SET fragments=400 WHERE user_id=?').run(id);
    },
  });
  const asset = '/assets/game-sounds/' + effect + '.mp3';
  assert.equal((await fetch(base + asset)).status, 401);
  const login = await fetch(base + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'voice_owner', password: 'test-password-123' }),
  });
  assert.equal(login.status, 200);
  const Cookie = login.headers.get('set-cookie').split(';')[0];
  const get = (route) => fetch(base + route, { headers: { Cookie } });
  const post = (route, body) =>
    fetch(base + route, {
      method: 'POST',
      headers: { Cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  const state = await (await get('/api/gacha')).json();
  const { poolItems } = require('../src/gacha/catalog');
  const arrival = new Set(poolItems('arrival').map((item) => item.key));
  for (const { id, label } of voices) {
    const itemKey = 'sounds:ping-voice-' + id;
    const item = state.items.find((row) => row.key === itemKey);
    assert.equal(item?.label, label);
    assert.ok(arrival.has(itemKey), itemKey);
  }
  const wings = state.items.find((item) => item.key === key);
  assert.equal(wings?.label, '夢的翅膀');
  assert.equal(wings?.rarity, 'epic');
  assert.equal(wings?.exchangeCost, 320);
  const settings = await (await get('/api/profile/settings')).json();
  settings.pings.ping = { ...settings.pings.ping, sound: { effect } };
  assert.equal((await get(asset)).status, 403);
  assert.equal((await post('/api/profile/settings', settings)).status, 403);
  const exchange = await post('/api/gacha/exchange', { requestId: randomUUID(), key });
  assert.equal(exchange.status, 200);
  assert.equal((await exchange.json()).wallet.fragments, 80);
  const saved = await post('/api/profile/settings', settings);
  assert.equal(saved.status, 200);
  assert.equal((await (await get('/api/profile/settings')).json()).pings.ping.sound.effect, effect);
  const playable = await get(asset);
  assert.equal(playable.status, 200);
  assert.equal(playable.headers.get('content-type'), 'audio/mpeg');
  assert.equal(playable.headers.get('cache-control'), 'private, no-store');
  assert.deepEqual(
    Buffer.from(await playable.arrayBuffer()),
    readFileSync(path.join(__dirname, '..', 'public', asset)),
  );
});

test('reward thumbnails require authentication and cache only at the content version', async (t) => {
  const { base } = await appFixture(t, {
    seed: (db) => createAuth(db).bootstrap('thumbnail_admin', 'test-password-123'),
  });
  const login = await fetch(base + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'thumbnail_admin', password: 'test-password-123' }),
  });
  assert.equal(login.status, 200);
  const Cookie = login.headers.get('set-cookie').split(';')[0];
  for (const [kind, id] of [
    ['attacks', 'solar_phoenix'],
    ['attacks', 'solar_phoenix_alt'],
    ['entrances', 'stitch-blue-eyes'],
    ['entrances', 'stitch-blue-eyes-alt'],
    ['backgrounds', 'aurora'],
    ['backgrounds', 'castle'],
  ]) {
    const directory = '/assets/' + kind + '/gacha/';
    for (const suffix of id === 'castle' ? ['', '-256', '-96'] : ['', '-256']) {
      const thumbnail = directory + id + suffix + '.webp';
      const bytes = readFileSync(path.join(__dirname, '..', 'public', thumbnail));
      const current = base + thumbnail + '?v=' + versionFor(bytes);
      assert.equal((await fetch(current)).status, 401);
      const image = await fetch(current, { headers: { Cookie } });
      assert.equal(image.status, 200);
      assert.equal(image.headers.get('content-type'), 'image/webp');
      assert.equal(image.headers.get('cache-control'), 'private, max-age=31536000, immutable');
      assert.deepEqual(Buffer.from(await image.arrayBuffer()), bytes);
      const stale = await fetch(base + thumbnail + '?v=old', {
        headers: { Cookie, 'If-None-Match': image.headers.get('etag') },
      });
      assert.equal(stale.status, 304);
      assert.equal(stale.headers.get('cache-control'), 'private, no-cache');
    }
    assert.equal(
      (await fetch(base + directory + 'unlisted.webp', { headers: { Cookie } })).status,
      404,
    );
  }
});

test('the announcement fallback never reveals the prize to the drawer before their click', async (t) => {
  const announcements = createGachaAnnouncements(() => true, { fallbackMs: 20 });
  t.after(() => announcements.close());
  function listen(id) {
    const req = new EventEmitter();
    const received = [];
    announcements.subscribe({
      req,
      user: { id },
      res: {
        setHeader() {},
        flushHeaders() {},
        end() {},
        write(chunk) {
          if (chunk.startsWith('event: legendary')) {
            received.push(chunk);
          }
          return true;
        },
      },
    });
    return received;
  }
  const drawer = listen('drawer');
  const viewer = listen('viewer');
  const requestId = randomUUID();
  announcements.stage(
    { id: 'drawer', display_name: '試抽玩家' },
    { requestId, results: [{ rarity: 'legendary', key: 'media:market', label: '測試獎品' }] },
  );
  await new Promise((resolve) => setTimeout(resolve, 60));
  assert.equal(viewer.length, 1);
  assert.equal(drawer.length, 0);
  announcements.release('drawer', requestId);
  assert.equal(viewer.length, 1);
});

test('legendary notices reach both online users only once after the drawer reveals', async (t) => {
  const { poolItems } = require('../src/gacha/catalog');
  const entries = poolItems('all');
  const legend = entries.findIndex((item) => item.rarity === 'legendary');
  const secondLegend = entries.findIndex(
    (item, index) => index > legend && item.rarity === 'legendary',
  );
  assert.ok(legend > 0 && entries[0].rarity !== 'legendary');
  assert.ok(secondLegend > legend);
  const sampleFor = (index) => [
    98,
    entries.slice(0, index).filter((item) => item.rarity === 'legendary').length,
  ];
  const samples = [];
  const { base } = await appFixture(t, {
    config: { gachaChoose: () => samples.shift() ?? 0 },
    seed: async (db) => {
      await createAuth(db).bootstrap('barrage_owner', 'test-password-123');
      db.prepare("UPDATE users SET display_name='試抽玩家' WHERE username='barrage_owner'").run();
      db.prepare(
        "INSERT INTO users(id,username,display_name,password_hash,role,created_at) SELECT ?,?,?,password_hash,'member',created_at FROM users WHERE username='barrage_owner'",
      ).run(randomUUID(), 'barrage_viewer', '試看玩家');
      const user = db.prepare("SELECT id FROM users WHERE username='barrage_owner'").get();
      new GachaStore(db).ledger(
        'fixture:barrage',
        user.id,
        'match',
        1000,
        0,
        createHash('sha256').update('barrage').digest('hex'),
        new Date().toISOString(),
      );
    },
  });
  async function post(cookie, route, body) {
    return fetch(base + route, {
      method: 'POST',
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }
  async function login(username) {
    const response = await post('', '/api/auth/login', { username, password: 'test-password-123' });
    assert.equal(response.status, 200);
    await response.json();
    return response.headers.get('set-cookie').split(';')[0];
  }
  async function listen(cookie) {
    const controller = new AbortController();
    t.after(() => controller.abort());
    const response = await fetch(base + '/api/gacha/events', {
      headers: { Cookie: cookie },
      signal: controller.signal,
    });
    assert.equal(response.status, 200);
    const received = [];
    let firstResolve;
    const first = new Promise((resolve) => (firstResolve = resolve));
    const read = (async () => {
      const decoder = new TextDecoder();
      let buffered = '';
      for await (const chunk of response.body) {
        buffered += decoder.decode(chunk, { stream: true });
        let boundary;
        while ((boundary = buffered.indexOf('\n\n')) >= 0) {
          const event = buffered.slice(0, boundary);
          buffered = buffered.slice(boundary + 2);
          if (!event.startsWith('event: legendary\ndata: ')) continue;
          received.push(JSON.parse(event.slice('event: legendary\ndata: '.length)));
          firstResolve(received[0]);
        }
      }
    })().catch((error) => {
      if (!controller.signal.aborted) throw error;
    });
    return {
      received,
      first,
      close: async () => {
        controller.abort();
        await read;
      },
    };
  }
  const owner = await login('barrage_owner');
  const viewer = await login('barrage_viewer');
  assert.equal((await fetch(base + '/api/gacha/events')).status, 401);
  const listeners = await Promise.all([listen(owner), listen(viewer)]);
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  try {
    const common = { requestId: randomUUID(), pool: 'all', count: 1 };
    assert.equal((await post(owner, '/api/gacha/draw', common)).status, 200);
    assert.equal((await post(owner, '/api/gacha/reveal', common)).status, 200);
    samples.push(
      ...sampleFor(legend),
      ...Array(3).fill(sampleFor(secondLegend)).flat(),
      ...Array(5).fill(sampleFor(legend)).flat(),
      0,
      0,
    );
    const input = { requestId: randomUUID(), pool: 'all', count: 10 };
    const response = await post(owner, '/api/gacha/draw', input);
    assert.equal(response.status, 200);
    const receipt = await response.json();
    assert.equal(receipt.results.filter((item) => item.rarity === 'legendary').length, 9);
    assert.equal(
      (await post(viewer, '/api/gacha/reveal', { requestId: input.requestId })).status,
      200,
    );
    assert.equal(await Promise.race([listeners[0].first, delay(60)]), undefined);
    assert.equal(
      (await post(owner, '/api/gacha/reveal', { requestId: input.requestId })).status,
      200,
    );
    const expected = {
      name: '試抽玩家',
      prizes: [
        { label: entries[legend].label, count: 6 },
        { label: entries[secondLegend].label, count: 3 },
      ],
    };
    for (const listener of listeners)
      assert.deepEqual(await Promise.race([listener.first, delay(2000)]), expected);
    assert.deepEqual(await (await post(owner, '/api/gacha/draw', input)).json(), receipt);
    assert.equal(
      (await post(owner, '/api/gacha/reveal', { requestId: input.requestId })).status,
      200,
    );
    await delay(60);
    for (const listener of listeners) assert.deepEqual(listener.received, [expected]);
  } finally {
    await Promise.all(listeners.map((listener) => listener.close()));
  }
});

test('only authenticated admins can persist odds and public state exposes matching weights', async (t) => {
  const { base } = await appFixture(t, {
    seed: async (db) => {
      await createAuth(db).bootstrap('odds_admin', 'test-password-123');
      db.prepare(
        "INSERT INTO users(id,username,display_name,password_hash,role,created_at) SELECT ?,?, ?,password_hash,'member',created_at FROM users WHERE username='odds_admin'",
      ).run(randomUUID(), 'odds_member', '一般玩家');
    },
  });
  async function login(username) {
    const r = await fetch(base + '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password: 'test-password-123' }),
    });
    assert.equal(r.status, 200);
    return r.headers.get('set-cookie').split(';')[0];
  }
  const admin = await login('odds_admin'),
    member = await login('odds_member');
  async function req(cookie, route, body) {
    const r = await fetch(base + route, {
      method: body ? 'POST' : 'GET',
      headers: { Cookie: cookie, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: r.status, body: await r.json() };
  }
  assert.equal((await req('', '/api/admin/gacha/odds')).status, 401);
  assert.equal((await req(member, '/api/admin/gacha/odds')).status, 403);
  const original = await req(admin, '/api/admin/gacha/odds');
  assert.equal(original.status, 200);
  const input = {
    revision: original.body.revision,
    weights: { common: 91, rare: 19, epic: 5, legendary: 3 },
  };
  assert.equal((await req(member, '/api/admin/gacha/odds', input)).status, 403);
  assert.equal((await req(admin, '/api/admin/gacha/odds', input)).status, 200);
  assert.equal((await req(admin, '/api/admin/gacha/odds', input)).status, 409);
  const state = await req(member, '/api/gacha');
  assert.deepEqual(state.body.odds.weights, input.weights);
  assert.equal(state.body.odds.updatedBy, undefined);
  for (const item of state.body.items) assert.equal(item.weight, input.weights[item.rarity]);
});
test('gacha HTTP authenticates, grants daily once, settles/replays ten pulls and refuses forged payloads', async (t) => {
  const { base } = await appFixture(t, {
    seed: async (db) => {
      const auth = createAuth(db);
      await auth.bootstrap('gacha_owner', 'test-password-123');
      const user = db.prepare('SELECT id FROM users WHERE username=?').get('gacha_owner');
      const store = new GachaStore(db);
      store.daily(user.id);
      require('../src/db').transaction(db, () =>
        store.ledger(
          'fixture:' + user.id,
          user.id,
          'match',
          1000,
          0,
          createHash('sha256').update('fixture').digest('hex'),
          new Date().toISOString(),
        ),
      );
    },
  });
  const raw = await fetch(base + '/api/gacha');
  assert.equal(raw.status, 401);
  const login = await fetch(base + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'gacha_owner', password: 'test-password-123' }),
  });
  assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie').split(';')[0];
  async function req(route, body) {
    const r = await fetch(base + route, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        Cookie: cookie,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: r.status, body: await r.json() };
  }
  const state = await req('/api/gacha');
  assert.equal(state.status, 200);
  assert.equal(state.body.wallet.coins, 2000);
  assert.equal(state.body.rules.dailyCoins, 1000);
  assert.deepEqual(state.body.rules.dailyLoginBonuses, [0, 0, 500, 0, 1000]);
  assert.equal(state.body.rules.matchCoins, 300);
  assert.equal(state.body.rules.winnerCoins, 200);
  assert.equal(state.body.rules.noPullPity, false);
  for (const { rarity, exchangeCost } of state.body.items)
    assert.equal(exchangeCost, { common: 40, rare: 160, epic: 320, legendary: 560 }[rarity]);
  for (const { bonusWeights } of state.body.pools) {
    const total = Object.values(bonusWeights).reduce((sum, weight) => sum + weight, 0);
    assert.deepEqual(
      Object.fromEntries(
        Object.entries(bonusWeights).map(([tier, weight]) => [tier, weight / total]),
      ),
      { common: 0, rare: 0, epic: 0.65, legendary: 0.35 },
    );
  }
  assert.deepEqual(
    state.body.pools.map((pool) => pool.id),
    ['all', 'styles', 'combat', 'arrival'],
  );
  assert.deepEqual(
    [
      ...new Set(
        state.body.items.filter((item) => item.rarity === 'legendary').map((item) => item.kind),
      ),
    ].sort(),
    ['attacks', 'backgrounds', 'entrances', 'frames', 'media', 'sounds'],
  );
  assert.ok(state.body.items.length >= 115);
  assert.match(state.body.characterImage, /^\/characters\/[a-f0-9-]{36}\?v=[\w-]{16}&size=256$/);
  const appearance = await req('/api/profile/appearance', {
    version: 5,
    characterId: 'builtin:woods',
    expression: 'neutral',
  });
  assert.equal(appearance.status, 200);
  const selected = (await req('/api/gacha')).body.characterImage;
  assert.match(selected, /^\/characters\/[a-f0-9-]{36}\?v=[\w-]{16}&size=256$/);
  assert.notEqual(selected, state.body.characterImage);
  let headers;
  for (let attempt = 0; attempt < 25; attempt++) {
    const image = await fetch(base + selected, { headers: { Cookie: cookie } });
    assert.equal(image.status, 200);
    await image.arrayBuffer();
    headers = image.headers;
    if (headers.get('cache-control').includes('immutable')) break;
    await new Promise((resolve) => setTimeout(resolve, 60));
  }
  assert.match(headers.get('cache-control'), /private.*immutable/);
  const input = { requestId: randomUUID(), pool: 'all', count: 10 };
  const first = await req('/api/gacha/draw', input);
  assert.equal(first.status, 200);
  assert.equal(first.body.results.length, 10);
  assert.equal(first.body.wallet.coins, 1000);
  assert.deepEqual(await req('/api/gacha/draw', input), first);
  const later = await req('/api/gacha');
  assert.equal(later.body.wallet.coins, 1000);
  const owned = new Set(later.body.items.filter((i) => i.owned).map((i) => i.key));
  for (const item of first.body.results) assert.ok(owned.has(item.key));
  assert.equal(
    first.body.fragmentsGained,
    first.body.results.reduce((sum, i) => sum + i.fragments, 0),
  );
  const forged = await req('/api/gacha/draw', {
    requestId: randomUUID(),
    pool: 'all',
    count: 1,
    userId: randomUUID(),
    results: [{ rarity: 'legendary' }],
  });
  assert.equal(forged.status, 400);
  assert.equal((await req('/api/gacha')).body.wallet.coins, 1000);
  assert.equal((await req('/api/gacha/draw', null)).status, 400);
  assert.equal((await req('/api/gacha/draw')).status, 405);
});
