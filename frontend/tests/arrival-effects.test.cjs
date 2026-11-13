const { test } = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const { parseHTML } = require('linkedom');
const definitions = require('../../public/shared/entrance-palette.json').starters.filter((e) =>
  e.id.startsWith('arrival-'),
);
const load = (file) => import(pathToFileURL(path.join(__dirname, '../src/services', file)));

test('arrival SVG reuses elements, removes obsolete nodes and namespaces simultaneous gradients', async () => {
  const { svgLayer } = await load('arrival-svg.js');
  const { document } = parseHTML('<div id="root"></div>');
  const root = document.querySelector('#root'),
    a = svgLayer(root, 'a');
  a.innerHTML =
    '<svg><defs><linearGradient id="g"/></defs><path d="M0 0" fill="url(#g)"/><circle r="3"/></svg>';
  const retained = root.querySelector('path');
  a.beginFrame();
  a.innerHTML = '<svg><defs><linearGradient id="g"/></defs><path d="M1 1" fill="url(#g)"/></svg>';
  a.endFrame();
  assert.equal(root.querySelector('path'), retained);
  assert.equal(retained.getAttribute('d'), 'M1 1');
  assert.equal(retained.getAttribute('fill'), 'url(#g-a)');
  assert.equal(root.querySelector('linearGradient').id, 'g-a');
  assert.equal(root.querySelector('circle'), null);
  a.beginFrame();
  a.endFrame();
  assert.equal(root.children.length, 0);
});

test('arrival alternate palettes recolor selected vector parts without flattening other hues', async () => {
  const { svgLayer } = await load('arrival-svg.js');
  const { document } = parseHTML('<div id="root"></div>');
  const root = document.querySelector('#root'),
    layer = svgLayer(root, 'alt', { '#ffcf55': '#b1d6ff' });
  layer.innerHTML = '<svg><path fill="#ffcf55"/><path fill="#ff7886"/></svg>';
  assert.deepEqual(
    [...root.querySelectorAll('path')].map((p) => p.getAttribute('fill')),
    ['#b1d6ff', '#ff7886'],
  );
});

test('all nine arrivals use the actual actor, track the front layer, and restore on completion, replay or cancellation', async () => {
  const { playArrival } = await load('arrival-effects.js');
  let now = 0,
    next = 0;
  const jobs = new Map();
  const original = {
    performance: global.performance,
    requestAnimationFrame: global.requestAnimationFrame,
    cancelAnimationFrame: global.cancelAnimationFrame,
  };
  global.performance = { now: () => now };
  global.requestAnimationFrame = (cb) => {
    jobs.set(++next, cb);
    return next;
  };
  global.cancelAnimationFrame = (id) => jobs.delete(id);
  const step = (at) => {
    now = at;
    const callbacks = [...jobs.values()];
    jobs.clear();
    callbacks.forEach((cb) => cb(now));
  };
  try {
    for (const effect of definitions) {
      now = 0;
      const { document } = parseHTML(
        '<div id="host"><div id="follow"></div><div id="actor"><img style="opacity:.8;transform:rotate(2deg)"><span>Name</span></div></div>',
      );
      const create = document.createElement.bind(document),
        createNS = document.createElementNS.bind(document);
      document.createElement = (tag) =>
        tag === 'canvas'
          ? {
              getContext: () => ({
                drawImage() {},
                getImageData: () => ({ data: new Uint8Array(40 * 44 * 4).fill(255) }),
              }),
            }
          : create(tag);
      document.createElementNS = (ns, tag) => {
        const node = createNS(ns, tag);
        if (tag === 'path') {
          node.getTotalLength = () => 100;
          node.getPointAtLength = (n) => ({ x: n * 0.5, y: n * 0.7 });
        }
        return node;
      };
      const img = document.querySelector('img'),
        anchor = document.querySelector('#actor'),
        layer = document.querySelector('#follow'),
        host = document.querySelector('#host');
      Object.defineProperties(img, { naturalWidth: { value: 81 }, naturalHeight: { value: 87 } });
      img.src = '/player-' + effect.id + '.webp';
      const before = img.getAttribute('style');
      let cancelled = 0;
      anchor.animate = () => ({ cancel: () => cancelled++ });
      const scene = { img, anchor, layer, host, cx: 120, feet: 140, height: 87 };
      let stop = playArrival(scene, effect.id, effect.duration);
      assert.equal(host.querySelectorAll('.arrival-vector-layer').length, 2, effect.id);
      assert.equal(host.querySelectorAll('img').length, 1, effect.id);
      layer.style.transform = 'translate(30px, 12px)';
      step(500);
      assert.match(host.lastElementChild.style.transform, /translate\(30px, 12px\)/);
      stop();
      stop();
      assert.equal(jobs.size, 0, effect.id);
      assert.equal(host.querySelectorAll('.arrival-vector-layer').length, 0);
      assert.equal(img.getAttribute('style'), before);
      assert.equal(cancelled, 1);
      now = 0;
      stop = playArrival(scene, effect.id, effect.duration);
      step(effect.duration + 1);
      assert.equal(jobs.size, 0);
      assert.equal(img.getAttribute('style'), before);
      assert.equal(host.querySelectorAll('.arrival-vector-layer').length, 0);
      stop();
    }
  } finally {
    Object.assign(global, original);
  }
});

test('canvas outline is traced from the chosen image rather than the prototype mascot', async () => {
  const { characterContour } = await load('arrival-svg.js');
  const image = (url, occupied) => ({
    currentSrc: url,
    naturalWidth: 40,
    naturalHeight: 44,
    ownerDocument: {
      createElement: () => ({
        getContext: () => ({
          drawImage() {},
          getImageData: () => {
            const data = new Uint8Array(40 * 44 * 4);
            for (let y = 0; y < 44; y++)
              for (let x = 0; x < 40; x++) if (occupied(x, y)) data[(y * 40 + x) * 4 + 3] = 255;
            return { data };
          },
        }),
      }),
    },
  });
  const a = characterContour(image('/a.webp', (x, y) => x > 4 && x < 14 && y > 5 && y < 30));
  const b = characterContour(image('/b.webp', (x, y) => x > 20 && x < 35 && y > 10 && y < 40));
  assert.ok(a.startsWith('M'));
  assert.ok(b.startsWith('M'));
  assert.notEqual(a, b);
});
