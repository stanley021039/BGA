const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parseHTML } = require('linkedom');
const source = fs
  .readFileSync(path.join(__dirname, '../src/services/scene-hit-feedback.js'), 'utf8')
  .replace(/^import .*;\r?\n/gm, '')
  .replace('export function', 'function');
function fixture(t) {
  const { window, document } = parseHTML(
    '<div class="lobby-backdrop"><div class="lobby-attack-layer"></div><div class="lobby-visitors"><div data-ping-player="self"><div class="scene-avatar-portrait"></div></div><div data-ping-player="target"><div class="scene-avatar-portrait"></div></div><div data-ping-player="other"><div class="scene-avatar-portrait"></div></div></div></div>',
  );
  let time = 1000,
    hidden = false,
    motion = true,
    cancelMotion;
  Object.defineProperty(document, 'hidden', { get: () => hidden });
  const animations = [],
    sounds = [],
    soundStates = [];
  window.HTMLElement.prototype.getBoundingClientRect = () => ({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    width: 64,
    height: 80,
  });
  window.HTMLElement.prototype.animate = function (frames, options) {
    const a = {
      node: this,
      frames,
      options,
      cancelled: false,
      cancel() {
        this.cancelled = true;
        this.oncancel?.();
      },
    };
    animations.push(a);
    return a;
  };
  const sound = {
    update: (s) => soundStates.push(s),
    play: (cue, key) => {
      const clip = {};
      sounds.push({ cue, key, clip });
      return clip;
    },
    reset() {},
    destroy() {},
  };
  const ctx = {
    document,
    window,
    performance: { now: () => time },
    motionAllowed: () => motion && !hidden,
    watchMotionCancellation: (fn) => {
      cancelMotion = fn;
      return () => {
        cancelMotion = undefined;
      };
    },
    GameSounds: { create: () => sound },
    module: { exports: {} },
  };
  vm.runInNewContext(source + '\nmodule.exports=createSceneHitFeedback;', ctx);
  const controller = ctx.module.exports({
    root: () => document.querySelector('.lobby-backdrop'),
    now: () => time,
  });
  t.after(() => controller.destroy());
  return {
    controller,
    document,
    window,
    animations,
    sounds,
    soundStates,
    tick(ms = 150) {
      time += ms;
      return time;
    },
    hide() {
      hidden = true;
      document.dispatchEvent(new window.Event('visibilitychange'));
    },
    show() {
      hidden = false;
    },
    disable() {
      motion = false;
      cancelMotion?.();
    },
    enable() {
      motion = true;
    },
    now: () => time,
  };
}
function event(at, options = {}) {
  return {
    id: 'attack-' + at,
    fromId: 'self',
    toId: 'target',
    fromX: 10,
    fromY: 30,
    toX: 50,
    toY: 50,
    slot: 'q',
    at,
    hits: [
      {
        toId: 'target',
        toX: 50,
        toY: 50,
        damage: 20,
        critical: false,
        phase: 'hit1',
        delayMs: 0,
        pending: false,
      },
    ],
    ...options,
  };
}
const snapshot = (time, attacks = []) => ({
  selfId: 'self',
  serverNow: time,
  attacks,
  visitors: [],
});

test('Boss cumulative hits react after windup and on later increases, without replaying baseline or stale totals', (t) => {
  const f = fixture(t),
    c = f.controller;
  const boss = event(1000, {
    fromId: 'scene-boss:one',
    effect: 'boss_mutalith_q',
    until: 5400,
    hits: [{ toId: 'self', toX: 50, toY: 50, damage: 10, critical: false }],
  });
  c.update(snapshot(1800, [boss]));
  c.update(snapshot(2000, [boss]));
  assert.equal(f.sounds.length, 0);
  boss.hits[0].damage = 20;
  f.tick(300);
  c.update(snapshot(2300, [boss]));
  assert.equal(f.sounds.length, 1);
  c.update(snapshot(2450, [boss]));
  assert.equal(f.sounds.length, 1);
  boss.hits[0].damage = 30;
  f.tick(300);
  c.update(snapshot(2600, [boss]));
  assert.equal(f.sounds.length, 2);
  boss.hits[0].damage = 40;
  f.tick(1000);
  c.update(snapshot(4000, [boss]));
  assert.equal(f.sounds.length, 3);
  c.update(snapshot(4200, [boss]));
  assert.equal(f.sounds.length, 3);
  f.hide();
  f.show();
  c.update(snapshot(4400, [boss]));
  c.update(snapshot(4500, [boss]));
  assert.equal(f.sounds.length, 3);
  boss.hits[0].damage = 50;
  c.update(snapshot(6300, [boss]));
  assert.equal(f.sounds.length, 3);
  for (let i = 0; i < 600; i++)
    c.update(
      snapshot(6400 + i, [
        event(6300 + i, {
          id: 'boss-' + i,
          fromId: 'scene-boss:one',
          effect: 'boss_mutalith_q',
          hits: [{ toId: 'self', damage: 1 }],
        }),
      ]),
    );
  assert.ok(c.size().bossReceipts <= 512);
});
test('only fresh settled hits react once; pending, miss, zero damage, stale and baseline receipts stay quiet', (t) => {
  const f = fixture(t),
    c = f.controller;
  c.update(snapshot(1000, [event(950)]));
  assert.equal(f.sounds.length, 0);
  const pending = event(1100);
  pending.hits[0].pending = true;
  f.tick();
  c.update(snapshot(1150, [pending]));
  assert.equal(f.animations.length, 0);
  pending.hits[0].pending = false;
  c.update(snapshot(1150, [pending]));
  assert.equal(f.sounds.length, 1);
  assert.equal(c.size().bursts, 1);
  c.update(snapshot(1150, [pending]));
  assert.equal(f.sounds.length, 1);
  for (const patch of [{ missed: true }, { damage: 0 }, { pending: true }]) {
    const hit = event(1300 + f.sounds.length);
    Object.assign(hit.hits[0], patch);
    c.update(snapshot(1400, [hit]));
  }
  c.update(snapshot(2000, [event(1200), event(1990, { cancelled: true })]));
  assert.equal(f.sounds.length, 1);
});
test('multi-hit grouping and local-only sound/shake preserve heavy impact tiers and fixed background', (t) => {
  const f = fixture(t),
    c = f.controller;
  c.update(snapshot(1000));
  f.tick(300);
  const heavy = event(1300, {
    slot: 'r',
    hits: Array.from({ length: 16 }, (_, i) => ({
      toId: 'target',
      toX: 50,
      toY: 50,
      damage: 1,
      critical: false,
      phase: 'hit' + i,
      delayMs: 0,
    })),
  });
  c.update(snapshot(1300, [heavy]));
  assert.equal(c.size().bursts, 1);
  assert.equal(f.sounds.length, 1);
  assert.equal(f.sounds[0].cue, 'combat-heavy');
  assert.equal(c.size().shakes, 2);
  assert.ok(f.animations.every((a) => a.node.className !== 'lobby-backdrop'));
  assert.ok(
    f.animations
      .filter((a) => a.node.className === 'lobby-visitors')
      .flatMap((a) => a.frames)
      .every((k) => !k.translate || Math.abs(parseFloat(k.translate)) <= 2),
  );
  f.tick(300);
  const remote = event(1600, { fromId: 'other' });
  c.update(snapshot(1600, [remote]));
  assert.equal(f.sounds.length, 1);
});
test('blocked hits have guard feedback without hurt motion; disabling motion keeps audio independent', (t) => {
  const f = fixture(t),
    c = f.controller;
  c.update(snapshot(1000));
  f.tick();
  const block = event(1150);
  Object.assign(block.hits[0], { damage: 0, blocked: true });
  c.update(snapshot(1150, [block]));
  assert.equal(f.sounds[0].cue, 'combat-block');
  assert.equal(c.size().reactions, 0);
  assert.equal(c.size().shakes, 0);
  f.tick(300);
  c.update(snapshot(1450, [event(1450)]), { motion: false });
  assert.equal(f.sounds.length, 2);
  assert.equal(c.size().bursts, 0);
  assert.equal(c.size().reactions, 0);
});
test('all animations return to rest and are cancelled on reduce, hidden, pagehide, disconnect and destroy', (t) => {
  const f = fixture(t),
    c = f.controller;
  c.update(snapshot(1000));
  f.tick();
  c.update(snapshot(1150, [event(1150)]));
  const pose = f.animations.find((a) => a.node.className === 'scene-avatar-portrait');
  assert.equal(pose.frames.at(-1).scale, '1 1');
  for (const a of [...f.animations]) a.onfinish?.();
  assert.equal(c.size().reactions, 0);
  assert.equal(c.size().bursts, 0);
  assert.equal(c.size().shakes, 0);
  f.tick(300);
  c.update(snapshot(1450, [event(1450)]));
  f.disable();
  assert.equal(c.size().bursts, 0);
  assert.equal(c.size().reactions, 0);
  f.enable();
  f.hide();
  assert.equal(c.size().seen, 0);
  f.show();
  c.update(snapshot(1700, [event(1690)]));
  assert.equal(c.size().bursts, 0);
  f.tick(400);
  c.update(snapshot(1800, [event(1800)]));
  f.window.dispatchEvent(new f.window.Event('pagehide'));
  assert.equal(c.size().bursts, 0);
  c.update(snapshot(1900));
  f.tick(300);
  c.update(snapshot(2100, [event(2100)]));
  c.update(snapshot(2100), { connected: false });
  assert.equal(c.size().bursts, 0);
  c.destroy();
  c.update(snapshot(2200, [event(2200)]));
  assert.equal(c.size().reactions, 0);
  assert.ok(f.animations.every((a) => a.cancelled));
});
test('burst resources and dedupe are bounded under flood; context changes do not replay prior receipts', (t) => {
  const f = fixture(t),
    c = f.controller;
  c.update(snapshot(1000));
  f.tick(300);
  const attacks = Array.from({ length: 700 }, (_, i) =>
    event(1200 + i / 1000, { id: 'flood-' + i }),
  );
  c.update(snapshot(1300, attacks));
  assert.ok(c.size().seen <= 512);
  assert.ok(c.size().bursts <= 6);
  assert.ok(c.size().reactions <= 6);
  assert.ok(c.size().shakes <= 2);
  const count = f.sounds.length;
  c.update(snapshot(1300, attacks));
  assert.equal(f.sounds.length, count);
  c.update(snapshot(1400, [event(1390)]), { scope: 'new-room' });
  assert.equal(c.size().bursts, 0);
  assert.equal(f.sounds.length, count);
});

test('coalesced receipts remain eligible for 750ms; removed actors release their pose and burst', (t) => {
  const f = fixture(t),
    c = f.controller;
  c.update(snapshot(1000));
  f.tick(900);
  const e = event(1250);
  e.hits[0].critical = true;
  c.update(snapshot(1900, [e]));
  assert.equal(f.sounds[0].cue, 'combat-critical');
  assert.equal(f.sounds[0].clip.playbackRate, 0.92);
  assert.equal(c.size().reactions, 1);
  f.document.querySelector('[data-ping-player="target"]').remove();
  c.update(snapshot(1950, [e]));
  assert.equal(c.size().reactions, 0);
  assert.equal(c.size().bursts, 0);
});
test('many distinct hit actors share the six-pose and six-burst budget', (t) => {
  const f = fixture(t),
    c = f.controller;
  c.update(snapshot(1000));
  f.tick(300);
  const hits = Array.from({ length: 20 }, (_, i) => {
    const a = f.document.createElement('div');
    a.dataset.pingPlayer = 'victim' + i;
    a.innerHTML = '<div class="scene-avatar-portrait"></div>';
    f.document.querySelector('.lobby-visitors').appendChild(a);
    return {
      toId: 'victim' + i,
      toX: 50,
      toY: 50,
      phase: 'hit1',
      damage: 1,
      critical: false,
      delayMs: 0,
    };
  });
  c.update(snapshot(1300, [event(1300, { hits, slot: 'r' })]));
  assert.equal(c.size().reactions, 6);
  assert.equal(c.size().bursts, 6);
  assert.equal(f.sounds.length, 1);
  c.destroy();
  assert.equal(c.size().bursts, 0);
});
