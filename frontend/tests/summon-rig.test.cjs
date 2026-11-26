const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path'),
  vm = require('node:vm'),
  ts = require('typescript'),
  sharp = require('sharp');
const mod = { exports: {} };
vm.runInNewContext(
  ts.transpileModule(
    fs.readFileSync(path.resolve(__dirname, '../src/services/summon-rig.ts'), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
  ).outputText,
  { module: mod, exports: mod.exports },
);
const { summonRig, summonArmor } = mod.exports;
async function plane(body) {
  return sharp(
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 1 1"><defs><mask id="m" maskUnits="userSpaceOnUse" x="0" y="0" width="1" height="1">${body}</mask></defs><rect width="1" height="1" fill="red" mask="url(#m)"/></svg>`,
    ),
  )
    .ensureAlpha()
    .raw()
    .toBuffer();
}
const shape = (d, fill) => `<path d="${d}" fill="${fill}"/>`;
const alpha = (pixels, [x, y]) => pixels[(y * 100 + x) * 4 + 3];
const examples = {
  susanoo: {
    plates: [
      [33, 40],
      [69, 40],
      [42, 80],
    ],
    hands: [
      [19, 55],
      [70, 62],
    ],
  },
  susanoo_orange: {
    plates: [
      [30, 40],
      [73, 29],
      [48, 80],
    ],
    hands: [
      [20, 65],
      [85, 60],
    ],
  },
  susanoo_alt: {
    plates: [
      [32, 52],
      [74, 52],
      [50, 85],
    ],
    hands: [
      [17, 70],
      [89, 80],
    ],
  },
  susanoo_blue: {
    plates: [
      [38, 48],
      [30, 43],
      [70, 43],
      [35, 70],
      [65, 70],
    ],
    hands: [
      [23, 60],
      [77, 60],
    ],
  },
  susanoo_cyan: {
    plates: [
      [31, 42],
      [73, 42],
      [47, 80],
    ],
    hands: [
      [22, 65],
      [84, 70],
    ],
  },
};
test('five summons retain chest, shoulder and waist armor on the body and exclude it from moving arms', async () => {
  for (const [effect, { plates }] of Object.entries(examples)) {
    const rig = summonRig(effect),
      armor = summonArmor(effect);
    const body = await plane(
      '<rect width="1" height="1" fill="white"/>' +
        rig.map((p) => shape(p.path, 'black')).join('') +
        armor.map((p) => shape(p, 'white')).join(''),
    );
    const arms = await Promise.all(
      rig.map((p) => plane(shape(p.path, 'white') + armor.map((p) => shape(p, 'black')).join(''))),
    );
    let protectedCutout = 0;
    for (const point of plates) {
      assert.equal(alpha(body, point), 255, effect + ' body ' + point);
      for (let i = 0; i < 2; i++) {
        assert.equal(alpha(arms[i], point), 0, effect + ' arm ' + i + ' plate ' + point);
        const raw = await plane(shape(rig[i].path, 'white'));
        if (alpha(raw, point) > 200) protectedCutout++;
      }
    }
    assert.ok(protectedCutout > 0, effect + ' protection covers real cutout overlap');
  }
});
test('hand and weapon roots stay in the moving layer without a stationary copy on the body', async () => {
  for (const [effect, { hands }] of Object.entries(examples)) {
    const rig = summonRig(effect),
      armor = summonArmor(effect);
    const body = await plane(
      '<rect width="1" height="1" fill="white"/>' +
        rig.map((p) => shape(p.path, 'black')).join('') +
        armor.map((p) => shape(p, 'white')).join(''),
    );
    for (let i = 0; i < 2; i++) {
      const arm = await plane(
        shape(rig[i].path, 'white') + armor.map((p) => shape(p, 'black')).join(''),
      );
      assert.equal(alpha(arm, hands[i]), 255, effect + ' hand ' + i);
      assert.equal(alpha(body, hands[i]), 0, effect + ' no stationary hand ' + i);
    }
  }
});
