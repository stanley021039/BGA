'use strict';
const rules = require('./rules');
const { uid, fail } = require('./util');
const create = (kind) =>
  kind === 'soup-slime'
    ? [
        {
          id: uid(),
          kind: 'soup-slime',
          name: '護書的無形之物',
          attributes: { STR: 115, CON: 90, SIZ: 100, DEX: 80, POW: 35 },
          hp: 19,
          maxHp: 19,
          db: '2d6',
          visible: true,
          active: true,
          attackSkill: 90,
          attacks: [{ skill: 90, damage: '1d6', kind: 'whip' }],
        },
      ]
    : kind === 'soup-guardian'
      ? [
          {
            id: uid(),
            kind: 'soup-guardian',
            name: '禮拜室的蛇形守衛',
            attributes: { STR: 180, CON: 75, SIZ: 250, DEX: 95, POW: 125 },
            hp: 33,
            maxHp: 33,
            db: '4d6',
            visible: true,
            active: true,
            attackSkill: 65,
            attacks: [
              { skill: 90, damage: '0', kind: 'tail' },
              { skill: 65, damage: '1d6', kind: 'bite' },
            ],
          },
        ]
      : null;
function encounterLoss(kind) {
  return kind === 'soup-slime' ? ['1', '1d10'] : kind === 'soup-guardian' ? ['0', '1d10'] : null;
}
function hit(combat, s, m, weapon, damage) {
  if (!m.kind.startsWith('soup-')) return false;
  let amount = damage.total;
  if (m.kind === 'soup-slime' && !weapon.fire) amount = 0;
  if (m.kind === 'soup-guardian') amount = weapon.capacity ? 0 : Math.max(0, amount - 9);
  m.hp = Math.max(0, m.hp - amount);
  m.active = m.hp > 0;
  combat.log(
    s,
    m.name + ' 受到 ' + amount + ' 傷害。' + (amount === 0 ? '攻擊沒有穿透它的防護。' : ''),
  );
  return true;
}
function monsterHit(combat, s, m, seat, limb) {
  if (!m.kind.startsWith('soup-')) return false;
  const attack = m.attacks[limb ?? 0],
    h = s.heroes[seat];
  if (attack.kind === 'tail') {
    h.held = 1;
    h.heldMonster = m.id;
    m.heldSeat = seat;
    combat.log(s, h.name + ' 被蛇形守衛的尾部纏住；可反擊、由同伴支援或嘗試掙脫。');
  } else combat.injury(s, seat, rules.dice(attack.damage, combat.store.rng).total, m.name);
  return true;
}
function command(combat, room, s, seat, data) {
  const b = s.combat,
    h = s.heroes[seat];
  if (!b.kind.startsWith('soup-')) return false;
  if (data.command === 'returnBook') {
    if (b.kind !== 'soup-slime') fail('COC_COMBAT', '這裡沒有需要歸還的書');
    s.flags.bookHolder = null;
    s.flags.slimeActive = false;
    combat.store.advance(s, 0.1);
    combat.log(s, h.name + ' 花費本回合將黑書放回書庫；無形之物吐出異物，恢復成門的輪廓。');
    combat.end(room, s, 'returnedBook');
    return true;
  }
  if (data.command === 'breakFree') {
    const m = b.monsters.find((m) => m.id === h.heldMonster && m.active);
    if (!m) fail('COC_COMBAT', '目前沒有纏住你的守衛');
    b.resolution = {
      id: uid(),
      kind: 'soup-free',
      actor: seat,
      target: m.id,
      roll: rules.percentile(h.attributes.STR, 0, combat.store.rng),
      defense: rules.percentile(m.attributes.STR, 0, combat.store.rng),
    };
    b.waiting = null;
    return true;
  }
  if (data.command === 'poisonBook') {
    if (b.kind !== 'soup-slime' || !s.flags.bookHolder)
      fail('COC_COMBAT', '需要帶出的黑書才能嘗試');
    const m = b.monsters.find((m) => m.active);
    b.resolution = {
      id: uid(),
      kind: 'soup-poison',
      actor: seat,
      target: m.id,
      roll: rules.percentile(h.skills.throw, 0, combat.store.rng),
      defense: rules.percentile(m.attributes.CON, 0, combat.store.rng),
      poison: rules.percentile(125, 0, combat.store.rng),
    };
    b.waiting = null;
    return true;
  }
  return false;
}
function resolve(combat, room, s, seat, r) {
  if (!r.kind.startsWith('soup-')) return false;
  const h = s.heroes[seat],
    m = combat.target(s, r.target);
  if (r.kind === 'soup-free') {
    const won =
      r.roll.level > r.defense.level ||
      (r.roll.level === r.defense.level && r.roll.target > r.defense.target);
    if (won) {
      delete h.held;
      delete h.heldMonster;
      if (m) delete m.heldSeat;
    }
    combat.log(s, won ? h.name + ' 成功掙脫尾部。' : h.name + ' 尚未掙脫纏繞。');
  } else {
    if (rules.passed(r.roll)) {
      const resists =
        r.defense.level > r.poison.level ||
        (r.defense.level === r.poison.level && r.defense.target > r.poison.target);
      if (!resists) {
        m.hp = 0;
        m.active = false;
        combat.log(s, '黑書被吞入，附著的液體使無形之物失去活動。');
      } else {
        m.hp = Math.max(1, Math.floor(m.hp / 2));
        combat.log(s, '無形之物吐出黑書，身體劇烈顫動，仍在門邊。');
      }
    } else combat.log(s, '黑書落在門邊，沒有被無形之物吞入，仍可撿回並歸還。');
  }
  bClear(combat, room, s);
  return true;
}
function bClear(combat, room, s) {
  s.combat.resolution = null;
  combat.next(room, s);
}
function end(combat, room, s, b, reason) {
  if (!b.kind.startsWith('soup-')) return;
  if (b.kind === 'soup-guardian' && reason === 'cleared') s.flags.guardGone = true;
  if (b.kind === 'soup-slime' && reason === 'cleared') s.flags.slimeActive = false;
  for (const h of Object.values(s.heroes)) delete h.heldMonster;
  if (reason === 'withdrawn') {
    s.scene = 'soup';
    combat.store.advance(s, 2);
    combat.log(s, '仍能行動的隊伍退出危險區域，回到中央。');
  }
}
module.exports = { create, encounterLoss, hit, monsterHit, command, resolve, end };
