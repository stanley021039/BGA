const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  vm = require('node:vm');
test('photo attacks draw the actual portraits, switch mouth image on contact and grow the reaper body', () => {
  const pictures = [];
  class FakeImage {
    set src(value) {
      this.url = value;
      this.complete = true;
      this.width = this.naturalWidth = 96;
      this.height = 128;
    }
  }
  const scope = { Image: FakeImage };
  vm.createContext(scope);
  vm.runInContext(
    require('../../tests/helpers/new-attack-module.cjs')() +
      '\nglobalThis.create = createNewAttack;',
    scope,
  );
  const c = new Proxy(
    {},
    {
      get:
        (_t, name) =>
        (...args) => {
          if (name === 'drawImage') pictures.push(args);
          if (name === 'createRadialGradient' || name === 'createLinearGradient')
            return { addColorStop() {} };
          if (name === 'measureText') return { width: 20 };
          for (const n of args) if (typeof n === 'number') assert.ok(Number.isFinite(n));
        },
      set: () => true,
    },
  );
  const options = {
    width: 1000,
    height: 700,
    from: { x: 200, y: 450 },
    to: { x: 650, y: 450 },
    preview: true,
    readHits: () => [],
  };
  let head = {
    x: 230,
    y: 450,
    targetX: 650,
    targetY: 450,
    at: 0,
    contactAt: 0,
    biteAt: 0,
    finished: false,
    cancelled: false,
  };
  const mouth = scope.create(c, { ...options, effect: 'shaohua_devour', readHead: () => head });
  mouth(100);
  assert.ok(pictures.some((p) => p[0].url.includes('shaohua-closed')));
  pictures.length = 0;
  head = { ...head, x: 650, contactAt: 400, biteAt: 800 };
  mouth(550);
  assert.ok(pictures.some((p) => p[0].url.includes('shaohua-open')));
  pictures.length = 0;
  const reaper = scope.create(c, { ...options, effect: 'reaper_seal' });
  reaper(400);
  const early = pictures.find((p) => p[0].url.includes('reaper-person'));
  assert.ok(early);
  pictures.length = 0;
  reaper(1600);
  const full = pictures.find((p) => p[0].url.includes('reaper-person'));
  assert.ok(full[4] > early[4] * 2);
  assert.ok(full[0].url.includes('-512.webp'));
  pictures.length = 0;
  const small = scope.create(c, { ...options, width: 300, height: 240, effect: 'reaper_seal' });
  small(1600);
  assert.ok(pictures.find((p) => p[0].url.includes('-256.webp')));
});

test('reaper draws a ground seal for every real victim before impact and extracts all confirmed souls', () => {
  const scope = {};
  vm.createContext(scope);
  vm.runInContext(
    require('../../tests/helpers/new-attack-module.cjs')() +
      '\nglobalThis.create = createNewAttack;',
    scope,
  );
  const calls = [];
  const c = new Proxy(
    {},
    {
      get:
        (_t, name) =>
        (...args) => {
          calls.push([name, ...args]);
          if (name === 'createRadialGradient' || name === 'createLinearGradient')
            return { addColorStop() {} };
          if (name === 'measureText') return { width: 20 };
          for (const n of args) if (typeof n === 'number') assert.ok(Number.isFinite(n));
        },
      set: () => true,
    },
  );
  let targets = Array.from({ length: 32 }, (_, i) => ({
    toId: 'victim-' + i,
    x: 320 + i * 14,
    y: 400 + i * 3,
    damage: 0,
    delayMs: 2600,
    pending: true,
  }));
  const draw = scope.create(c, {
    effect: 'reaper_seal',
    width: 1000,
    height: 700,
    from: { x: 100, y: 450 },
    to: { x: 320, y: 400 },
    preview: false,
    readHits: () => targets,
  });
  draw(1600);
  for (const h of targets)
    assert.ok(
      calls.some((a) => a[0] === 'translate' && a[1] === h.x && a[2] === h.y),
      'missing victim seal: ' + h.toId,
    );
  assert.ok(calls.length < 6000, 'bounded 32-victim drawing budget');
  targets = targets.map((h) => ({ ...h, pending: false, damage: 400000 }));
  calls.length = 0;
  draw(2800);
  for (const h of targets)
    assert.ok(
      calls.some((a) => a[0] === 'moveTo' && a[1] === h.x && a[2] === h.y),
      'missing confirmed soul: ' + h.toId,
    );
  assert.ok(calls.length < 6000, 'bounded extraction drawing budget');
  targets = targets.map((h) => ({ ...h, missed: true }));
  calls.length = 0;
  draw(1600);
  assert.ok(
    !calls.some((a) => a[0] === 'translate' && a[1] === 320 && a[2] === 400),
    'missed victims do not retain a seal',
  );
});

test('renamed devour and seal use the shared finite ultimate title without delaying their artwork', () => {
  class LoadedImage {
    set src(_url) {
      this.complete = true;
      this.width = this.naturalWidth = 96;
      this.height = 128;
    }
  }
  const scope = { Image: LoadedImage };
  vm.createContext(scope);
  vm.runInContext(
    require('../../tests/helpers/new-attack-module.cjs')() +
      '\nglobalThis.create = createNewAttack;',
    scope,
  );
  const labels = [];
  let images = 0;
  const c = new Proxy(
    {},
    {
      get:
        (_t, name) =>
        (...args) => {
          if (name === 'fillText') labels.push(args[0]);
          if (name === 'arc') images++;
          if (name === 'createRadialGradient' || name === 'createLinearGradient')
            return { addColorStop() {} };
          if (name === 'measureText') return { width: 20 };
        },
      set: () => true,
    },
  );
  for (const id of ['shaohua_devour', 'shaohua_devour_alt', 'reaper_seal', 'reaper_seal_alt']) {
    const { label } = require('../../public/shared/attack-effects.json').find((e) => e.id === id);
    const draw = scope.create(c, {
      effect: id,
      label,
      width: 1000,
      height: 700,
      from: { x: 200, y: 450 },
      to: { x: 650, y: 450 },
      preview: true,
    });
    labels.length = 0;
    images = 0;
    draw(350);
    assert.ok(labels.includes(label));
    assert.ok(images > 0, 'artwork continues during title');
    labels.length = 0;
    draw(1700);
    assert.ok(!labels.includes(label), 'title ends at 700ms');
  }
});

test('devour head grows with server age and stays capped for a long-lived entity', () => {
  class LoadedImage {
    set src(_url) {
      this.complete = true;
      this.width = this.naturalWidth = 96;
      this.height = 128;
    }
  }
  const scope = { Image: LoadedImage };
  vm.createContext(scope);
  vm.runInContext(
    require('../../tests/helpers/new-attack-module.cjs')() +
      '\nglobalThis.create = createNewAttack;',
    scope,
  );
  const pictures = [];
  const c = new Proxy(
    {},
    {
      get:
        (_t, name) =>
        (...args) => {
          if (name === 'drawImage') pictures.push(args);
          if (name === 'createRadialGradient' || name === 'createLinearGradient')
            return { addColorStop() {} };
          if (name === 'measureText') return { width: 20 };
        },
      set: () => true,
    },
  );
  const head = {
    x: 400,
    y: 400,
    targetX: 700,
    targetY: 400,
    at: 0,
    contactAt: 0,
    biteAt: 0,
    finished: false,
    cancelled: false,
  };
  const draw = scope.create(c, {
    effect: 'shaohua_devour',
    width: 1000,
    height: 700,
    from: { x: 100, y: 400 },
    to: { x: 700, y: 400 },
    readHead: () => head,
  });
  const size = (age) => {
    head.at = age;
    pictures.length = 0;
    draw(0);
    return Math.max(...pictures.map((p) => p[3]));
  };
  const initial = size(0),
    middle = size(7500),
    full = size(15000),
    late = size(1000000);
  assert.ok(initial < middle && middle < full);
  assert.ok(Math.abs(full / initial - 2.5) < 0.001);
  assert.equal(late, full);
});
