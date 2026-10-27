const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path'),
  vm = require('node:vm');
const source = fs
  .readFileSync(path.join(__dirname, '../src/services/entrance-body.js'), 'utf8')
  .replace('export function ', 'function ');
const effects = require('../../public/shared/entrance-stitch.json');
test('all 24 Stitch entrances materialize the actual image and name, then restore their original styles on cancellation', () => {
  const context = {};
  vm.createContext(context);
  vm.runInContext(source, context);
  assert.equal(effects.length, 24);
  for (const effect of effects) {
    const calls = [];
    const element = {
      style: { opacity: '.75', transform: 'rotate(2deg)' },
      animate(frames, options) {
        const animation = {
          frames,
          options,
          cancelled: 0,
          cancel() {
            this.cancelled++;
          },
        };
        calls.push(animation);
        return animation;
      },
    };
    const original = { ...element.style };
    const stop = context.playEntranceBody(
      { querySelector: () => element },
      element,
      effect.id,
      effect.duration,
    );
    assert.equal(calls.length, 2, effect.id);
    assert.equal(calls[0].frames[0].opacity, 0);
    assert.equal(
      calls[0].frames[1].offset,
      ['stitch-saiyan', 'stitch-zanka'].includes(effect.id) ? 0.24 : 0.34,
    );
    assert.equal(calls[0].frames.at(-1).opacity, 1);
    assert.equal(calls[0].options.duration, effect.duration);
    assert.equal(calls[1].frames[1].opacity, 0);
    stop();
    stop();
    assert.ok(calls.every((a) => a.cancelled === 1));
    assert.deepEqual(element.style, original);
  }
});
test('the seven original effects and unavailable animation support preserve their existing renderer', () => {
  const context = {};
  vm.createContext(context);
  vm.runInContext(source, context);
  for (const id of ['classic', 'smoke', 'sparks', 'ink', 'runes', 'rift', 'particles'])
    context.playEntranceBody(
      {},
      {
        animate() {
          throw Error('original overwritten');
        },
      },
      id,
      1000,
    )();
  context.playEntranceBody({}, null, 'stitch-purple', 1000)();
});
test('each theme has distinct body poses and the actor is raised above the effect only for its bounded lifetime', () => {
  const context = {};
  vm.createContext(context);
  vm.runInContext(source, context);
  const poses = new Set();
  for (const effect of effects) {
    const animations = [];
    const animate = (frames, options) => {
      const item = {
        frames,
        options,
        cancelled: 0,
        cancel() {
          this.cancelled++;
        },
      };
      animations.push(item);
      return item;
    };
    const anchor = { style: { zIndex: 12 }, animate, querySelector: () => ({ animate }) };
    const stop = context.playEntranceBody(anchor, { animate }, effect.id, effect.duration);
    poses.add(JSON.stringify(animations[0].frames.map((f) => f.transform)));
    assert.equal(animations[1].frames[0].zIndex, 201);
    anchor.style.zIndex = 44;
    stop();
    assert.equal(anchor.style.zIndex, 44);
    assert.ok(animations.every((a) => a.cancelled === 1));
  }
  assert.equal(poses.size, 24);
});
