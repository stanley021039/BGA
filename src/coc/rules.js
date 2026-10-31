'use strict';
const { randomInt } = require('node:crypto');
const { fail, integer } = require('./util');
const { SKILLS } = require('./catalog');
const die = (sides, rng = randomInt) => rng(1, sides + 1);
function dice(expression, rng = randomInt, maximum = false) {
  if (typeof expression === 'number')
    return { total: expression, expression: String(expression), dice: [] };
  if (
    typeof expression !== 'string' ||
    !/^[-+]?\d*(?:d\d+)?(?:[+-]\d*(?:d\d+)?)*$/i.test(expression)
  )
    throw Error('Invalid server dice expression');
  let total = 0,
    rolls = [];
  for (const term of expression.toLowerCase().match(/[+-]?[^+-]+/g) || []) {
    const sign = term[0] === '-' ? -1 : 1,
      body = term.replace(/^[+-]/, '');
    if (body.includes('d')) {
      const [count, sides] = body.split('d').map(Number);
      integer(count, 1, 30);
      integer(sides, 2, 100);
      for (let i = 0; i < count; i++) {
        const value = maximum ? sides : die(sides, rng);
        rolls.push(value);
        total += sign * value;
      }
    } else total += sign * Number(body);
  }
  return { expression, total, dice: rolls };
}
function successLevel(roll, target) {
  integer(roll, 1, 100);
  integer(target, 0, 1000);
  if (roll === 100 || (target < 50 && roll >= 96)) return -1;
  if (roll === 1) return 4;
  if (roll <= Math.floor(target / 5)) return 3;
  if (roll <= Math.floor(target / 2)) return 2;
  if (roll <= target) return 1;
  return 0;
}
function percentile(target, net = 0, rng = randomInt) {
  integer(net, -2, 2);
  const units = rng(0, 10),
    tens = Array.from({ length: 1 + Math.abs(net) }, () => rng(0, 10));
  const candidates = tens.map((value) => value * 10 + units || 100);
  const roll =
    net > 0 ? Math.min(...candidates) : net < 0 ? Math.max(...candidates) : candidates[0];
  return { target, roll, units, tens, bonus: net, level: successLevel(roll, target) };
}
const passed = (roll, difficulty = 'regular') =>
  roll.level >= ({ regular: 1, hard: 2, extreme: 3 }[difficulty] || 1);
function damageBonus(str, siz) {
  const sum = str + siz;
  if (sum < 65) return { build: -2, db: '-2' };
  if (sum < 85) return { build: -1, db: '-1' };
  if (sum < 125) return { build: 0, db: '0' };
  if (sum < 165) return { build: 1, db: '1d4' };
  if (sum < 205) return { build: 2, db: '1d6' };
  const count = Math.floor((sum - 205) / 80) + 2;
  return { build: count + 1, db: count + 'd6' };
}
function secondary(a) {
  return {
    maxHp: Math.floor((a.CON + a.SIZ) / 5),
    maxMp: Math.floor(a.POW / 5),
    maxSan: 99,
    move: a.STR > a.SIZ && a.DEX > a.SIZ ? 9 : a.STR < a.SIZ && a.DEX < a.SIZ ? 7 : 8,
    ...damageBonus(a.STR, a.SIZ),
  };
}
function skillBase(id, a) {
  const value = SKILLS[id]?.[1];
  if (value === undefined) fail('COC_SKILL', '不支援的技能', 400);
  return value === 'DEX/2' ? Math.floor(a.DEX / 2) : value === 'EDU' ? a.EDU : value;
}
function talentBonus(sheet, skill) {
  return (sheet.talents.includes('keenVision') && skill === 'spot') ||
    (sheet.talents.includes('smoothTalker') && skill === 'charm') ||
    (sheet.talents.includes('strongWilled') && skill === 'POW')
    ? 1
    : 0;
}
function melee(attacker, defender, response = 'dodge') {
  if (!['dodge', 'fightBack'].includes(response)) fail('COC_DEFENSE', '請選擇閃避或反擊', 400);
  if (attacker.level < 1 && defender.level < 1) return 'neither';
  const attackLevel = attacker.level + (attacker.luckTieBreak ? 0.5 : 0),
    defendLevel = defender.level + (defender.luckTieBreak ? 0.5 : 0);
  if (response === 'dodge')
    return attacker.level >= 1 && attackLevel > defendLevel ? 'attacker' : 'defender';
  return defender.level >= 1 && defendLevel > attackLevel
    ? 'defender'
    : attacker.level >= 1
      ? 'attacker'
      : 'neither';
}
function weaponDamage(weapon, sheet, extreme, rng = randomInt) {
  const base = dice(weapon.damage, rng, extreme);
  const db = weapon.db ? dice(sheet.db, rng, extreme) : { total: 0, dice: [] };
  const extra = extreme && weapon.impale ? dice(weapon.damage, rng) : { total: 0, dice: [] };
  return { total: Math.max(0, base.total + db.total + extra.total), base, db, extra };
}
function wound(sheet, amount, rng = randomInt) {
  integer(amount, 0, 10000);
  const hp = Math.max(0, sheet.hp - amount);
  let condition = sheet.condition || 'healthy',
    con = null;
  if (condition === 'dead') return { hp, condition, amount, con };
  if (amount >= sheet.maxHp) condition = 'dead';
  else if (hp === 0) condition = amount >= sheet.maxHp / 2 ? 'dying' : 'unconscious';
  else if (amount >= sheet.maxHp / 2) {
    con = percentile(sheet.attributes.CON, 0, rng);
    if (!passed(con)) condition = 'unconscious';
  }
  return { hp, condition, amount, con };
}
function sanity(
  sheet,
  successLoss,
  failureLoss,
  { rng = randomInt, mundane = false, minutes = 0, deferInt = false } = {},
) {
  if (mundane && sheet.talents.includes('hardened'))
    return { loss: 0, roll: null, int: null, hours: 0, bout: null };
  const roll = percentile(sheet.san, 0, rng);
  const loss = Math.min(
    sheet.san,
    dice(passed(roll) ? successLoss : failureLoss, rng, roll.level === -1).total,
  );
  const int = loss >= 5 && !deferInt ? percentile(sheet.attributes.INT, 0, rng) : null;
  const temporary = int && passed(int),
    hours = temporary ? die(10, rng) : 0;
  const bout = temporary ? { kind: die(10, rng), rounds: die(10, rng) } : null;
  const dayStart = sheet.sanDayStart ?? sheet.san,
    dayLoss = (sheet.sanDayLoss || 0) + loss;
  return {
    roll,
    loss,
    int,
    hours,
    bout,
    san: Math.max(0, sheet.san - loss),
    retired: sheet.san - loss <= 0,
    indefinite: !!sheet.indefiniteInsanity || (dayLoss > 0 && dayLoss >= dayStart / 5),
    dayLoss,
    until: temporary ? minutes + hours * 60 : sheet.insaneUntil || 0,
  };
}
function spendLuck(sheet, roll, amount, { kind = 'skill', pushed = false } = {}) {
  integer(amount, 1, 100);
  if (
    !['skill', 'characteristic', 'combat'].includes(kind) ||
    pushed ||
    roll.roll === 1 ||
    roll.level === -1 ||
    amount > sheet.luck ||
    roll.roll - amount < 1
  )
    fail('COC_LUCK', '這次檢定不能使用這個幸運值支出');
  const adjusted = roll.roll - amount;
  return {
    ...roll,
    roll: adjusted,
    originalRoll: roll.originalRoll || roll.roll,
    luckSpent: (roll.luckSpent || 0) + amount,
    luckTieBreak: kind === 'combat' && adjusted === 1,
    level: Math.min(3, successLevel(adjusted, roll.target)),
  };
}
function pulpLuck(sheet, kind, rng = randomInt) {
  if (kind === 'escapeDeath') {
    if (sheet.luck < 30 || !['dead', 'dying'].includes(sheet.condition))
      fail('COC_LUCK', '避免死亡需要至少 30 幸運值，且必須正面臨死亡');
    return {
      cost: sheet.luck,
      hp: Math.min(sheet.maxHp, rulesRecovery(rng)),
      condition: 'returnNextScene',
    };
  }
  if (kind === 'scratch') {
    if (sheet.luck < 20 || sheet.hp >= sheet.maxHp || sheet.condition === 'dead')
      fail('COC_LUCK', '傷勢恢復需要 20 幸運值及可恢復的傷勢');
    return {
      cost: 20,
      hp: Math.min(sheet.maxHp, sheet.hp + die(6, rng)),
      condition: ['dying', 'unconscious'].includes(sheet.condition) ? 'healthy' : sheet.condition,
    };
  }
  if (kind === 'stayConscious') {
    const cost = 2 ** (sheet.consciousLuckRounds || 0);
    if (sheet.luck < cost || !['unconscious', 'luckConscious'].includes(sheet.condition))
      fail('COC_LUCK', '無法繼續以幸運值保持清醒');
    return {
      cost,
      condition: 'luckConscious',
      consciousLuckRounds: (sheet.consciousLuckRounds || 0) + 1,
    };
  }
  fail('COC_LUCK', '不支援的幸運值用途', 400);
}
const rulesRecovery = (rng) => die(6, rng) + 1;
function luckRecovery(sheet, rng = randomInt) {
  const roll = die(100, rng),
    amount = dice(roll > sheet.luck ? '2d10+10' : '1d10+5', rng);
  const luck = Math.min(99, sheet.luck + amount.total);
  return { roll, amount: amount.total, gained: luck - sheet.luck, luck };
}
function growth(sheet, rng = randomInt) {
  const results = [];
  for (const id of [...new Set(sheet.development || [])]) {
    if (!SKILLS[id] || ['mythos', 'credit'].includes(id)) continue;
    const current = sheet.skills[id],
      roll = die(100, rng),
      increase = roll > current || roll >= 96 ? die(10, rng) : 0;
    results.push({ skill: id, roll, increase });
    sheet.skills[id] += increase;
    if (current < 90 && sheet.skills[id] >= 90)
      sheet.san = Math.min(99 - (sheet.skills.mythos || 0), sheet.san + dice('2d6', rng).total);
  }
  sheet.development = [];
  return results;
}
module.exports = {
  die,
  dice,
  successLevel,
  percentile,
  passed,
  damageBonus,
  secondary,
  skillBase,
  talentBonus,
  melee,
  weaponDamage,
  wound,
  sanity,
  spendLuck,
  pulpLuck,
  luckRecovery,
  growth,
};
