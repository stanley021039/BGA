const { HttpError } = require('../http/errors');

// These IDs describe local artwork only. No URL, CSS or caller-owned object is
// retained in the social event, so each confirmed message has a stable style.
const BUILTIN_FRAME_OPTIONS = Object.freeze([
  Object.freeze({ id: 'default', label: '預設' }),
  Object.freeze({ id: 'paper', label: '紙張' }),
  Object.freeze({ id: 'comic', label: '漫畫' }),
  Object.freeze({ id: 'pixel', label: '像素' }),
  Object.freeze({ id: 'neon', label: '電流霓虹' }),
  Object.freeze({ id: 'orbit', label: '星際軌道' }),
  Object.freeze({ id: 'holo', label: '全息故障' }),
  Object.freeze({ id: 'arcade', label: '街機像素' }),
  Object.freeze({ id: 'mech', label: '機械核心' }),
  Object.freeze({ id: 'berry', label: '奶油草莓' }),
  Object.freeze({ id: 'cat', label: '貓咪肉球' }),
  Object.freeze({ id: 'cloud', label: '軟糖雲朵' }),
  Object.freeze({ id: 'jelly', label: '深海水母' }),
  Object.freeze({ id: 'shiba', label: '柴犬吐司' }),
  Object.freeze({ id: 'forest', label: '森林精靈' }),
  Object.freeze({ id: 'dragon', label: '龍焰寶藏' }),
  Object.freeze({ id: 'frost', label: '冰晶王冠' }),
  Object.freeze({ id: 'moon', label: '月光魔法' }),
  Object.freeze({ id: 'potion', label: '蘑菇藥釜' }),
  Object.freeze({ id: 'ink', label: '水墨游魚' }),
  Object.freeze({ id: 'sakura', label: '御守櫻花' }),
  Object.freeze({ id: 'steam', label: '蒸汽郵件' }),
  Object.freeze({ id: 'burst', label: '漫畫爆擊' }),
  Object.freeze({ id: 'royal', label: '皇家劇院' }),
  ...require('../achievements/rewards').rewards.map((r) =>
    Object.freeze({ id: r.frameId, label: r.label, achievementId: r.achievementId }),
  ),
]);
const ids = new Set(BUILTIN_FRAME_OPTIONS.map((option) => option.id));
const descriptors = Object.freeze(
  Object.fromEntries(
    BUILTIN_FRAME_OPTIONS.map(({ id }) => [id, Object.freeze({ kind: 'builtin', id, version: 1 })]),
  ),
);

function normalizeBuiltinFrameId(input) {
  if (input === undefined || input === null) return 'default';
  if (typeof input !== 'string' || input.length > 7 || !ids.has(input))
    throw new HttpError(400, 'INVALID_BARRAGE_FRAME', '請選擇有效的內建彈幕框');
  return input;
}
function builtinFrameDescriptor(input) {
  return descriptors[normalizeBuiltinFrameId(input)];
}

module.exports = { BUILTIN_FRAME_OPTIONS, normalizeBuiltinFrameId, builtinFrameDescriptor };
