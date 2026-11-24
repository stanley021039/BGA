const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const abilities = require('../../public/shared/boss-abilities.json');
const source = require('../../tests/helpers/boss-artwork-module.cjs')();
test('all 39 boss casts draw finite source-anchored windup, travel and timed impact, then stop cleanly', () => {
  const sandbox = { performance: { now: () => 0 }, Math };
  vm.runInNewContext(source + '\nthis.create=createBossArtwork;', sandbox);
  for (const spec of abilities) {
    let commands = 0,
      saves = 0,
      anchors = 0;
    const ctx = new Proxy(
      {},
      {
        get:
          (_, key) =>
          (...args) => {
            for (const n of args)
              if (typeof n === 'number') assert.ok(Number.isFinite(n), spec.id + ':' + key);
            if (key === 'save') saves++;
            if (key === 'restore') saves--;
            commands++;
          },
        set: () => true,
      },
    );
    const from = { x: 20, y: 70 },
      aim = { x: 55, y: 65 };
    const before = JSON.stringify({ from, aim });
    const art = sandbox.create(ctx, {
      effect: spec.id,
      bossFrom: from,
      bossAim: aim,
      width: 1280,
      height: 800,
      aspectRatio: 1.6,
      readCaster: () => {
        anchors++;
        return { x: 240, y: 440, width: 200, height: 218 };
      },
    });
    for (const t of [
      0,
      spec.windup - 150,
      spec.windup,
      spec.windup + 250,
      spec.windup + 550,
      3700,
    ]) {
      const last = commands;
      assert.equal(art.draw(t), true, spec.id);
      assert.ok(commands - last > 10 && commands - last < 1800, spec.id + ' bounded draw');
      assert.equal(saves, 0, spec.id + ' balanced context');
    }
    assert.equal(anchors, 6);
    assert.equal(art.draw(4201), false);
    assert.equal(
      JSON.stringify({ from, aim }),
      before,
      'visuals preserve fixed authority geometry',
    );
    art.dispose();
    const end = commands;
    assert.equal(art.draw(100), false);
    assert.equal(commands, end);
  }
});
test('weapon muzzle mirrors with the actual boss facing without moving its fixed ground target', () => {
  const sandbox = { performance: { now: () => 0 }, Math };
  vm.runInNewContext(source + '\nthis.create=createBossArtwork;', sandbox);
  const origins = [];
  for (const facingLeft of [false, true]) {
    const arcs = [];
    const ctx = new Proxy(
      {},
      {
        get:
          (_, key) =>
          (...args) => {
            if (key === 'arc') arcs.push(args);
          },
        set: () => true,
      },
    );
    const art = sandbox.create(ctx, {
      effect: 'boss_gatanozoa_q',
      bossFrom: { x: 20, y: 70 },
      bossAim: { x: 55, y: 65 },
      width: 1280,
      height: 800,
      aspectRatio: 1.6,
      readCaster: () => ({ x: 240, y: 440, width: 200, height: 218, facingLeft }),
    });
    art.draw(0);
    art.dispose();
    origins.push(arcs[0][0]);
  }
  // Gatanozoa's right pincer sits at 74% of the portrait width.
  assert.ok(Math.abs(origins[0] - 22.5) < 0.001);
  assert.ok(Math.abs(origins[1] - 15) < 0.001);
});

test('all 78 staged attacks share their authoritative sequence, keep numeric drawing finite and release the shared clock', () => {
  const sandbox = { performance: { now: () => 0 }, Math };
  vm.runInNewContext(source + '\nthis.create=createBossArtwork;', sandbox);
  for (const spec of abilities)
    for (const bossPhase of [2, 3]) {
      let commands = 0,
        balance = 0;
      const ctx = new Proxy(
        {},
        {
          get:
            (_, key) =>
            (...args) => {
              for (const v of args)
                if (typeof v === 'number') assert.ok(Number.isFinite(v), spec.id + ':' + key);
              if (key === 'save') balance++;
              if (key === 'restore') balance--;
              commands++;
            },
          set: () => true,
        },
      );
      const rate = bossPhase === 2 ? 1.15 : 1.3;
      const art = sandbox.create(ctx, {
        effect: spec.id,
        bossPhase,
        bossAttackRate: rate,
        bossFrom: { x: 20, y: 65 },
        bossAim: { x: 55, y: 65 },
        from: { x: 200, y: 400 },
        to: { x: 550, y: 400 },
        width: 1000,
        height: 625,
        readCaster: () => ({ x: 200, y: 400, width: 200, height: 218 }),
      });
      for (const at of [0, 400, 715, 1200, 2200, 2600, 3150, 3700, 4190]) {
        const before = commands;
        assert.equal(art.draw(at / rate), true);
        assert.equal(balance, 0);
        assert.ok(commands - before < 8000, spec.id);
      }
      assert.equal(art.draw(4201 / rate), false);
      art.dispose();
      assert.equal(art.draw(0), false);
    }
});
