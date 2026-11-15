const { versionedAsset } = require('../http/asset-version');
const abilities = require('../../public/shared/boss-abilities.json');
const { phases } = require('../../public/shared/boss-rules.json');
const { bossPhase, phaseStats } = require('./boss-phases');
const definitions = [
  ['mutalith', '漩渦獸', 'orbit', 0.65, '繞行拉扯，交替漩渦與雷擊'],
  ['cthulhu', '克蘇魯', 'pursue', 0.55, '緩慢追獵，以鎖鏈與寒霜封路'],
  ['gatanozoa', '加坦杰厄', 'anchor', 0.35, '定點盤踞，觸腕與光線交替'],
  ['arkveld', '鎖刃龍', 'pounce', 1.05, '追擊逼近，鎖鏈與翼刃橫掃'],
  ['greeza', '格利札', 'blink', 1.1, '錯位閃現，折射與雷擊交替'],
  ['hyper-zetton', '海帕杰頓', 'stalk', 1.2, '迂迴突進，突刺後接連射'],
  ['colossal', '超巨型巨人', 'march', 0.4, '大步逼近，熱浪與重擊輪替'],
  ['steel-behemoth', '無人機航空母艦機器・SAGIUS', 'strafe', 0.7, '側向巡航，以浮游砲與飛彈壓制'],
  ['prismatic-void', '次元生命體・XENORPH', 'drift', 0.8, '飄移迴旋，折射與能量波輪替'],
  ['gyo', '魚', 'crawl', 0.45, '緩慢爬行，觸管與污濁能量侵襲'],
  ['thanos', '薩諾龜', 'conquer', 0.65, '沉穩逼近，寶石蓄力'],
];
const bosses = definitions.map(([id, name, movement, speed, description]) => ({
  id,
  name,
  movement,
  speed,
  sequence: abilities.filter((a) => a.boss === id).map((a) => a.id),
  // Each phase has its own sequence slot; future phases may choose different IDs.
  phases: phases.map((p) => ({
    ...p,
    sequence: abilities.filter((a) => a.boss === id).map((a) => a.id),
  })),
  abilities: abilities.filter((a) => a.boss === id),
  description: description.split('，')[0] + '，專屬普攻與蓄力大招',
  image: versionedAsset('/assets/characters/boss-' + id + '.webp'),
}));
function bossFor(id) {
  return bosses.find((b) => b.id === id);
}
// Called only by the existing, bounded scene driver. No extra clock or scheduling.
function driveBoss(bot, actor, target, time, state) {
  if (actor.lifeId !== state.lifeId) {
    state.lifeId = actor.lifeId;
    state.step = 0;
    actor.bossCharge = 0;
    state.pending = null;
    state.rate = actor.bossId ? phaseStats(actor).attackRate : 1;
    state.attackAt = time + 1200;
    state.moveAt = time + 400;
  }
  if (time < (actor.immobileUntil || 0)) {
    state.pending = null;
    actor.bossIntent = null;
    return null;
  }
  const spec = bossFor(bot.bossId);
  if (!spec || !target) {
    actor.bossIntent = null;
    return null;
  }
  state.step ||= 0;
  const rate = actor.bossId ? phaseStats(actor).attackRate : 1;
  if (state.rate && state.rate !== rate && !state.pending && state.attackAt > time)
    state.attackAt = time + ((state.attackAt - time) * state.rate) / rate;
  state.rate = rate;
  if (time >= state.moveAt && !state.pending) {
    const phase = state.step + Math.floor(time / 2500),
      side = phase % 2 ? 1 : -1;
    let x = target.x - side * 9,
      y = target.y + side * 6;
    if (spec.movement === 'anchor') {
      x = actor.x;
      y = actor.y;
    }
    if (spec.movement === 'orbit') {
      x = target.x + Math.cos(phase) * 17;
      y = target.y + Math.sin(phase) * 12;
    }
    if (spec.movement === 'pounce') {
      x = target.x - side * 4;
      y = target.y + side * 10;
    }
    if (spec.movement === 'stalk') {
      x = target.x + side * 18;
      y = target.y + 8;
    }
    if (spec.movement === 'march') {
      x = target.x;
      y = target.y + 9;
    }
    if (spec.movement === 'conquer') {
      x = target.x - side * 13;
      y = target.y + 6;
    }
    if (spec.movement === 'strafe') {
      x = target.x + side * 23;
      y = 40 + (phase % 3) * 12;
    }
    if (spec.movement === 'drift') {
      x = 50 + Math.sin(phase * 0.7) * 26;
      y = 56 + Math.cos(phase) * 15;
    }
    if (spec.movement === 'crawl') {
      x = phase % 2 ? target.x : actor.x;
      y = phase % 2 ? actor.y : target.y + 7;
    }
    actor.targetX = Math.max(12, Math.min(88, x));
    actor.targetY = Math.max(65, Math.min(88, y));
    actor.facing = x < actor.x ? 'left' : 'right';
    actor.moveId++;
    if (spec.movement === 'blink') {
      actor.x = actor.targetX;
      actor.y = actor.targetY;
      actor.teleportId++;
    }
    state.moveAt = time + (spec.movement === 'stalk' ? 1800 : 3000);
  }
  if (state.pending) {
    if (time < state.pending.until) return null;
    state.pending = null;
    actor.bossIntent = null;
    state.step++;
    actor.bossCharge = (state.step % 3) * 50;
    state.attackAt = time + (state.step % 3 === 0 ? 4200 : 2600) / rate;
    return null;
  }
  if (time >= state.attackAt) {
    const sequence = spec.phases[bossPhase(actor) - 1]?.sequence || spec.sequence;
    const effect = sequence[state.step % sequence.length];
    const ability = abilities.find((a) => a.id === effect);
    state.pending = { effect, until: time + (ability.windup + ability.duration) / rate };
    actor.facing = target.x < actor.x ? 'left' : 'right';
    actor.bossIntent = {
      effect,
      name: ability.name,
      ultimate: ability.slot === 'r',
      until: time + ability.windup / rate,
      ...(rate !== 1 ? { attackRate: rate } : {}),
    };
    actor.targetX = actor.x;
    actor.targetY = actor.y;
    return effect;
  }
  return null;
}
module.exports = { bosses, bossFor, driveBoss };
