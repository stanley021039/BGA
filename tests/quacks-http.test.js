'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  { randomUUID } = require('node:crypto');
const { appFixture } = require('./helpers/app-fixture.cjs'),
  { createAuth } = require('../src/auth');
for (const purpose of ['test', 'production', 'retry'])
  test(
    'quacks ' + purpose + ' authenticated rooms, nine-round history and achievements',
    async (t) => {
      // Keep production on wall time; purpose/retry only virtualize Date and intervals.
      if (purpose !== 'production')
        t.mock.timers.enable({ apis: ['Date', 'setInterval'], now: Date.now() });
      const { base, config } = await appFixture(t, {
        config: {
          achievementPurpose: purpose === 'retry' ? 'production' : purpose,
          marketAutomationEnabled: false,
        },
        seed: async (db) => {
          const id = await createAuth(db).bootstrap('quacks_owner', 'synthetic-quacks-password');
          const hash = db
            .prepare('SELECT password_hash FROM users WHERE id=?')
            .get(id).password_hash;
          db.prepare(
            'INSERT INTO users(id,username,display_name,password_hash,role,created_at) VALUES(?,?,?,?,?,?)',
          ).run(randomUUID(), 'quacks_peer', 'peer', hash, 'member', new Date().toISOString());
        },
      });
      const dbRun = (fn) => {
        const db = require('../src/db').openDatabase(config.dbFile);
        try {
          return fn(db);
        } finally {
          db.close();
        }
      };
      if (purpose === 'retry')
        dbRun((db) =>
          db.exec(
            "CREATE TRIGGER reject_quacks_badges BEFORE INSERT ON user_achievements BEGIN SELECT RAISE(ABORT,'synthetic badge failure'); END",
          ),
        );
      async function post(route, cookie, data = {}, status = 200) {
        const res = await fetch(base + '/api/' + route, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
            body: JSON.stringify(data),
          }),
          s = await res.json();
        assert.equal(res.status, status, JSON.stringify(s));
        return { s, cookie: res.headers.get('set-cookie')?.split(';')[0] };
      }
      const owner = (
          await post('auth/login', null, {
            username: 'quacks_owner',
            password: 'synthetic-quacks-password',
          })
        ).cookie,
        peer = (
          await post('auth/login', null, {
            username: 'quacks_peer',
            password: 'synthetic-quacks-password',
          })
        ).cookie,
        cookies = [owner, peer];
      if (purpose === 'production') {
        await post('create', null, { type: 'quacks' }, 401);
        await post('create', owner, { type: 'quacks', bookSet: 5 }, 400);
      }
      const { code } = (await post('create', owner, { type: 'quacks', hiddenProgress: true })).s;
      await post('join', peer, { code });
      if (purpose === 'production') {
        await post('settings', peer, { code, witches: true }, 403);
        await post('start', peer, { code }, 403);
      }
      await post('settings', owner, { code, witches: true, bookSet: 6, hiddenProgress: true });
      await post('start', owner, { code });
      const state = async (cookie) =>
        await (
          await fetch(base + '/api/state?code=' + code, { headers: { Cookie: cookie } })
        ).json();
      const action = async (cookie, s, action, data = {}) =>
        (
          await post('action', cookie, {
            code,
            action,
            roundId: s.roundId,
            requestId: randomUUID(),
            ...data,
          })
        ).s;
      let iterations = 0,
        ordinary = false,
        s = await state(owner);
      while (s.phase !== 'finished') {
        assert.ok(++iterations < 300);
        if (s.phase === 'round-intro') {
          if (purpose === 'production') await new Promise((resolve) => setTimeout(resolve, 2400));
          else t.mock.timers.tick(2400);
          s = await state(owner);
          continue;
        }
        if (s.phase === 'between') {
          s = await action(owner, s, 'next');
          ordinary = false;
          continue;
        }
        for (const cookie of cookies) {
          const v = await state(cookie),
            m = v.mine;
          if (v.phase === 'fortune') {
            if (v.me === v.roundStarterId) await action(cookie, v, 'draw-fortune');
            continue;
          }
          if (m.pending) {
            const o = m.pending.options.find((o) => !o.disabled);
            await action(cookie, v, 'choice', { choiceId: m.pending.id, optionId: o.id });
            continue;
          }
          if (v.phase === 'brewing' && m.canDraw) {
            await action(cookie, v, ordinary ? 'stop' : 'draw', { step: v.step });
            continue;
          }
          if (v.phase === 'brewing' && v.stage === 'reserves') {
            const c = m.reserve[0];
            await action(cookie, v, c ? 'reserve' : 'reserve-done', c ? { chipId: c.id } : {});
            continue;
          }
          if (v.phase === 'settlement' && !m.ready) {
            if (v.stage === 'witches') await action(cookie, v, 'settle-ready');
            if (v.stage === 'bonus') {
              if (m.bonusEligible && !m.bonusRolled) await action(cookie, v, 'roll-bonus');
              else await action(cookie, v, 'bonus-ready');
            }
            if (v.stage === 'effects-confirm') await action(cookie, v, 'confirm-effects');
            if (v.stage === 'rewards') await action(cookie, v, 'reward', { mode: 'score' });
            if (
              v.stage === 'shopping' &&
              (!v.market?.turnPlayerId || v.market.turnPlayerId === v.me)
            )
              await action(cookie, v, 'shop-ready');
          }
        }
        s = await state(owner);
        ordinary = s.mine.draws > 0;
        if (s.phase === 'brewing') {
          const other = s.recipes.find((p) => p.id !== s.me);
          if (!other.exploded) {
            assert.equal(other.pot, null);
            assert.equal(other.position, null);
            assert.equal(other.threshold, null);
          }
          assert.equal(s.mine.pending?.options[0].ops, undefined);
        }
      }
      assert.equal(s.results.length, 9);
      for (const cookie of cookies) {
        const collection = await (
          await fetch(base + '/api/achievements', { headers: { Cookie: cookie } })
        ).json();
        const first = collection.achievements.find((a) => a.id === 'quacks-first-match');
        assert.equal(!!first.unlockedAt, purpose === 'production');
        if (purpose === 'test')
          assert.equal(
            collection.achievements.some((a) => a.game === 'quacks' && a.unlockedAt),
            false,
          );
      }

      const historyList = await (
          await fetch(base + '/api/history', { headers: { Cookie: owner } })
        ).json(),
        match = historyList.find((m) => m.type === 'quacks');
      assert.equal(match.status, 'finished');
      const history = await (
        await fetch(base + '/api/history/' + match.id, { headers: { Cookie: owner } })
      ).json();
      assert.match(history[0].engine.source, /class QuacksRoom/);
      assert.match(history[0].engine.catalog, /Crow|烏鴉/);
      assert.equal(history.filter((r) => r.kind === 'result').at(-1).after.results.length, 9);
      assert.equal(
        history.filter(
          (r) =>
            r.kind === 'result' &&
            r.operation.input?.action === 'next' &&
            r.after.phase === 'fortune',
        ).length,
        8,
        'all eight host-confirmed round transitions are persisted',
      );
      await post('reconnect', owner, { code });
      const rooms = await (await fetch(base + '/api/rooms', { headers: { Cookie: owner } })).json();
      assert.equal(rooms.rooms.find((r) => r.code === code).maxPlayers, 8);
      // Resource serving and HTTP access policy do not depend on achievement purpose.
      if (purpose === 'production') {
        for (const path of ['/quacks', '/quacks/' + code]) {
          assert.equal((await fetch(base + path, { redirect: 'manual' })).status, 302);
          const r = await fetch(base + path, { headers: { Cookie: owner } });
          assert.equal(r.status, 200);
          assert.match(await r.text(), /data-game-focus/);
        }
        for (const path of [
          '/quacks.js',
          '/quacks-art.js',
          '/quacks-fx.js',
          '/assets/game-sounds/quacks-explosion.wav',
          '/quacks.css',
          '/assets/playful/game-quacks.svg',
        ])
          assert.equal((await fetch(base + path)).status, 200);
      }
      if (purpose === 'retry') {
        await post('leave', owner, { code });
        await post('leave', peer, { code });
        dbRun((db) => db.exec('DROP TRIGGER reject_quacks_badges'));
        const until = Date.now() + 4000;
        let earned = false;
        while (Date.now() < until) {
          const collection = await (
            await fetch(base + '/api/achievements', { headers: { Cookie: owner } })
          ).json();
          earned = !!collection.achievements.find((a) => a.id === 'quacks-first-match').unlockedAt;
          if (earned) break;
          t.mock.timers.tick(40);
        }
        assert.equal(earned, true, 'global retry survives room deletion');
        const before = dbRun((db) =>
          db.prepare('SELECT * FROM user_achievements ORDER BY user_id,achievement_id').all(),
        );
        t.mock.timers.tick(850);
        assert.deepEqual(
          dbRun((db) =>
            db.prepare('SELECT * FROM user_achievements ORDER BY user_id,achievement_id').all(),
          ),
          before,
        );
      }
    },
  );
