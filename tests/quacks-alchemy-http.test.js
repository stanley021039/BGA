'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  { randomUUID } = require('node:crypto');
const { appFixture } = require('./helpers/app-fixture.cjs'),
  { createAuth } = require('../src/auth');
for (const witches of [false, true])
  test(
    'alchemy ' +
      (witches ? 'combined' : 'standalone') +
      ' authenticated HTTP, private views and nine-round history',
    async (t) => {
      // Production nine-round HTTP coverage keeps the real scheduler clock.
      t.mock.timers.enable({ apis: ['Date', 'setInterval'], now: Date.now() });
      const { base } = await appFixture(t, {
        config: { achievementPurpose: 'test', marketAutomationEnabled: false },
        seed: async (db) => {
          const id = await createAuth(db).bootstrap('alchemy_owner', 'synthetic-alchemy-password');
          const hash = db
            .prepare('SELECT password_hash FROM users WHERE id=?')
            .get(id).password_hash;
          db.prepare(
            'INSERT INTO users(id,username,display_name,password_hash,role,created_at) VALUES(?,?,?,?,?,?)',
          ).run(randomUUID(), 'alchemy_peer', 'peer', hash, 'member', new Date().toISOString());
        },
      });
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
          username: 'alchemy_owner',
          password: 'synthetic-alchemy-password',
        })
      ).cookie;
      const peer = (
          await post('auth/login', null, {
            username: 'alchemy_peer',
            password: 'synthetic-alchemy-password',
          })
        ).cookie,
        cookies = [owner, peer];
      const { code } = (
        await post('create', owner, {
          type: 'quacks',
          alchemists: true,
          witches,
          hiddenProgress: true,
        })
      ).s;
      await post('join', peer, { code });
      await post('settings', peer, { code, alchemists: false }, 403);
      let s = (await post('start', owner, { code })).s;
      assert.equal(s.phase, 'patients');
      assert.equal(s.patients.length, 3);
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
      await post(
        'action',
        null,
        {
          code,
          action: 'patient',
          roundId: s.roundId,
          requestId: randomUUID(),
          patientId: s.patients[0].id,
        },
        401,
      );
      await post(
        'action',
        owner,
        {
          code,
          action: 'patient',
          roundId: s.roundId,
          requestId: randomUUID(),
          patientId: 'fabricated',
        },
        400,
      );
      let iterations = 0;
      while (s.phase !== 'finished') {
        assert.ok(++iterations < 500, 'HTTP phase progresses');
        if (s.phase === 'round-intro') {
          t.mock.timers.tick(2400);
          s = await state(owner);
          continue;
        }
        if (s.phase === 'between') {
          s = await action(owner, s, 'next');
          continue;
        }
        for (const cookie of cookies) {
          const v = await state(cookie),
            m = v.mine;
          assert.equal(m.alchemy.held, undefined);
          assert.equal(m.alchemy.distilling, undefined);
          for (const p of v.recipes) assert.equal(p.alchemy?.pool, undefined);
          if (v.phase === 'patients') {
            if (!m.alchemy.patientId)
              await action(cookie, v, 'patient', { patientId: v.patients[0].id });
            continue;
          }
          if (m.pending) {
            const q = m.pending,
              o = q.options.find((o) => !o.disabled);
            assert.equal(o.ops, undefined);
            await action(cookie, v, 'choice', { choiceId: q.id, optionId: o.id });
            continue;
          }
          if (v.phase === 'fortune') {
            if (v.me === v.roundStarterId) await action(cookie, v, 'draw-fortune');
            continue;
          }
          if (v.phase === 'brewing') {
            const other = v.recipes.find((p) => p.id !== v.me);
            if (!other.exploded) assert.equal(other.pot, null);
            if (v.stage === 'reserves') {
              const c = m.reserve[0];
              await action(cookie, v, c ? 'reserve' : 'reserve-done', c ? { chipId: c.id } : {});
            } else if (m.canDraw)
              await action(cookie, v, m.draws > 0 ? 'stop' : 'draw', { step: v.step });
            continue;
          }
          if (v.phase === 'settlement') {
            if (v.stage === 'essence') {
              if (!m.alchemy.confirmed)
                await action(cookie, v, 'essence', { position: m.alchemy.max });
              else if (m.alchemy.diceRemaining) await action(cookie, v, 'essence-roll');
              continue;
            }
            if (m.ready) continue;
            if (v.stage === 'witches') await action(cookie, v, 'settle-ready');
            if (v.stage === 'bonus')
              await action(
                cookie,
                v,
                m.bonusEligible && !m.bonusRolled ? 'roll-bonus' : 'bonus-ready',
              );
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
      }
      assert.equal(s.results.length, 9);
      assert.ok(s.results.every((x) => x.players.every((p) => p.alchemy)));
      const list = await (
          await fetch(base + '/api/history', { headers: { Cookie: owner } })
        ).json(),
        match = list.find((x) => x.type === 'quacks');
      const history = await (
        await fetch(base + '/api/history/' + match.id, { headers: { Cookie: owner } })
      ).json();
      assert.match(history[0].engine.quacksAlchemy, /PATIENTS/);
      assert.match(history[0].engine.quacksExpansionFortunes, /witch-visit/);
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
      const html = await (
        await fetch(base + '/quacks/' + code, { headers: { Cookie: owner } })
      ).text();
      assert.match(html, /id="alchemy"/);
      assert.match(html, /data-game-focus/);
    },
  );
