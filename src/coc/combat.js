'use strict';
// Stateful combat uses server dice only. The state is part of the campaign's
// atomic receipt, so accepting a result never rerolls an attack or damage.
const rules = require('./rules');
const { getScenario } = require('./scenario-registry');
const { WEAPONS } = require('./catalog');
const { fail, uid, integer, clone } = require('./util');
const awake = (h) =>
  !['dead', 'retired', 'dying', 'unconscious', 'returnNextScene'].includes(h.condition);
const clamp = (n) => Math.max(-2, Math.min(2, n));
const RENDERS = [
  [13, 14, 44, 2, 16, 29, '3d6'],
  [14, 10, 48, 3, 14, 29, '3d6'],
  [15, 14, 36, 6, 10, 25, '2d6'],
  [17, 12, 44, 6, 15, 28, '3d6'],
  [12, 12, 44, 1, 12, 28, '2d6'],
  [16, 16, 38, 6, 15, 27, '2d6'],
  [16, 13, 39, 6, 19, 26, '2d6'],
  [11, 12, 40, 1, 13, 26, '2d6'],
];
function render(index) {
  const [s, c, z, p, d, hp, db] = RENDERS[index % 8];
  return {
    id: uid(),
    kind: 'render',
    name: '撕裂侍從 ' + (index + 1),
    attributes: { STR: s * 5, CON: c * 5, SIZ: z * 5, POW: p * 5, DEX: d * 5 },
    hp,
    maxHp: hp,
    db,
    limbs: [10, 10, 10, 10, 10],
    active: true,
  };
}
function dissolver(index) {
  const hp = [57, 60, 57][index % 3],
    dex = [55, 50, 50][index % 3];
  return {
    id: uid(),
    kind: 'dissolver',
    name: '溶解侍從 ' + (index + 1),
    attributes: { DEX: dex, STR: 220, SIZ: 405, CON: 170, POW: 25 },
    hp,
    maxHp: hp,
    db: '7d6',
    active: true,
    corporeal: false,
  };
}
function sleeper() {
  return {
    id: uid(),
    kind: 'sleeper',
    name: '甦醒中的巨物',
    attributes: { DEX: 55, STR: 160, SIZ: 200, CON: 250, POW: 125 },
    hp: 45,
    maxHp: 45,
    db: '3d6',
    active: true,
  };
}
class CocCombat {
  constructor(store) {
    this.store = store;
  }
  log(s, message, detail) {
    this.store.log(s, 'combat', message, detail);
  }
  start(room, s, { kind = 'cave', actor, objective = 'escape' } = {}) {
    if (s.combat) fail('COC_COMBAT', '目前已有戰鬥');
    // Hill forays use two hunters at a time; the remaining guards replace them.
    const monsters =
      getScenario(s).combat?.create(kind) ??
      (kind === 'sleeper'
        ? [sleeper(), render(0), dissolver(0)]
        : kind === 'hill'
          ? [render(0), render(1)]
          : [
              ...Array.from({ length: 8 }, (_, i) => render(i)),
              ...Array.from({ length: 3 }, (_, i) => dissolver(i)),
            ]);
    const heroes = room
      .activePlayers()
      .map((p) => p.id)
      .filter((id) => s.heroes[id]);
    s.combat = {
      id: uid(),
      kind,
      objective,
      round: 1,
      index: 0,
      heroes,
      monsters,
      order: [],
      prepared: {},
      waiting: null,
      resolution: null,
      injury: null,
      injuries: [],
      escaped: [],
      defenses: {},
      dig: 0,
      foundDuncan: false,
      hillRound: 0,
      replacements: 0,
    };
    this.log(
      s,
      '危險逼近。請先宣告使用武器，之後按敏捷順序進行；擲骰自動完成，玩家可在套用結果前處理自己的幸運值。',
    );
    this.encounterSanity(s);
    if (kind === 'sleeper') this.log(s, '巨物受到攻擊，附近侍從立即護衛；它不再只是仰望星空。');
    this.pump(room, s);
  }
  encounterSanity(s) {
    const b = s.combat;
    for (const id of b.heroes) {
      const h = s.heroes[id];
      if (!h || !awake(h) || b.escaped.includes(id)) continue;
      h.seenCreatures ??= [];
      for (const kind of [
        ...new Set(b.monsters.filter((m) => m.active && m.kind !== 'sleeper').map((m) => m.kind)),
      ])
        if (!h.seenCreatures.includes(kind)) {
          h.seenCreatures.push(kind);
          s.sanityQueue.push({
            id: uid(),
            actor: id,
            loss:
              getScenario(s).combat?.encounterLoss(kind) ??
              (kind === 'render' ? ['1', '1d6'] : ['1d3', '1d10']),
            status: 'awaitingRoll',
            reason: kind === 'render' ? '目睹多肢撕裂侍從' : '目睹溶解侍從',
          });
        }
    }
  }
  retire(s, actor) {
    const b = s.combat;
    if (!b) return;
    if (b.waiting?.actor === actor) {
      if (b.waiting.kind === 'defend') b.attackIndex++;
      b.waiting = null;
    }
    if (b.resolution?.actor === actor) {
      if (b.resolution.kind === 'defense') b.attackIndex++;
      b.resolution = null;
    }
    if (b.injury?.actor === actor) b.injury = null;
    b.injuries = (b.injuries || []).filter((item) => item.actor !== actor);
    if (!b.injury) b.injury = b.injuries.shift() || null;
  }
  order(s) {
    const b = s.combat;
    b.order = [
      ...b.heroes
        .filter((id) => !b.escaped.includes(id))
        .map((id) => {
          const h = s.heroes[id],
            p = b.prepared[id],
            gun = !!WEAPONS[p?.weapon]?.capacity;
          return {
            id,
            pc: true,
            dex:
              h.attributes.DEX + (gun && (p.readied || h.talents.includes('quickDraw')) ? 50 : 0),
            skill: h.skills[gun ? 'handgun' : 'brawl'],
          };
        }),
      ...b.monsters
        .filter((m) => m.active)
        .map((m) => ({
          id: m.id,
          pc: false,
          dex: m.attributes.DEX,
          skill: m.attackSkill ?? (m.kind === 'render' ? 45 : 100),
        })),
    ].sort((a, b) => b.dex - a.dex || b.skill - a.skill || a.id.localeCompare(b.id));
    b.index = 0;
    b.defenses = {};
  }
  target(s, id) {
    return s.combat.monsters.find((m) => m.id === id && m.active);
  }
  injury(s, actor, amount, reason) {
    const h = s.heroes[actor],
      previous = h.condition,
      result = rules.wound(h, amount, this.store.rng);
    Object.assign(h, { hp: result.hp, condition: result.condition });
    h.woundId = uid();
    h.woundedAt = s.minutes;
    if (!['luckConscious', 'unconscious'].includes(previous)) h.consciousLuckRounds = 0;
    this.log(s, h.name + ' 受到 ' + amount + ' 傷害，體力 ' + h.hp + '／' + h.maxHp + '。', {
      reason,
      ...result,
    });
    if (['dead', 'dying', 'unconscious'].includes(h.condition)) this.queueInjury(s, actor, reason);
  }
  queueInjury(s, actor, reason) {
    const b = s.combat,
      item = { id: uid(), actor, reason, condition: s.heroes[actor].condition };
    if (!b.injury) b.injury = item;
    else if (b.injury.actor !== actor && !b.injuries.some((i) => i.actor === actor))
      b.injuries.push(item);
  }
  hitMonster(s, m, weapon, damage, limb) {
    if (getScenario(s).combat?.hit(this, s, m, weapon, damage, limb)) return;
    let amount = damage.total;
    if (m.kind === 'render') {
      if (!Number.isInteger(limb) || limb < 0 || limb > 4 || m.limbs[limb] <= 0)
        fail('COC_TARGET', '請選擇尚未斷裂的實體觸肢');
      amount = Math.max(0, amount - 3);
      m.limbs[limb] = Math.max(0, m.limbs[limb] - amount);
      if (m.limbs.every((n) => n === 0)) m.active = false;
      if (m.limbs[limb] === 0)
        for (const h of Object.values(s.heroes)) {
          h.grabs = (h.grabs || []).filter((g) => g.monster !== m.id || g.limb !== limb);
          h.held = h.grabs.length;
        }
      this.log(
        s,
        m.name +
          ' 的第 ' +
          (limb + 1) +
          ' 條觸肢受到 ' +
          amount +
          ' 傷害；靈體軀幹不受普通武器傷害。',
      );
    } else {
      if (m.kind === 'dissolver' && !m.corporeal) {
        this.log(s, '武器穿過 ' + m.name + ' 的非實體身軀，沒有造成傷害。');
        return;
      }
      if (m.kind === 'sleeper' || (m.kind === 'dissolver' && weapon.impale)) {
        const minimum = (expression) =>
          rules.dice(
            String(expression).replace(/\d+d\d+/g, (match) => String(Number(match.split('d')[0]))),
            this.store.rng,
          ).total;
        amount =
          minimum(weapon.damage) +
          (weapon.db ? minimum(s.heroes[s.combat.resolution.actor].db) : 0);
      }
      if (m.kind === 'dissolver') amount = Math.max(0, amount - 3);
      m.hp = Math.max(0, m.hp - amount);
      m.active = m.hp > 0;
      this.log(s, m.name + ' 受到 ' + amount + ' 傷害。');
    }
  }
  pump(room, s) {
    const b = s.combat;
    if (!b || b.waiting || b.resolution || b.injury || s.sanityQueue.length) return;
    if (
      b.kind === 'sleeper' &&
      b.monsters.some((m) => m.kind === 'sleeper' && (!m.active || m.hp <= 0))
    ) {
      s.combat = null;
      this.store.finish(s, 'repelled');
      return;
    }
    if (b.kind === 'hill' && s.flags.lastMealAt !== undefined) {
      this.end(room, s, 'meal');
      return;
    }
    if (
      b.kind === 'hill' &&
      s.flags.lastMealAt === undefined &&
      (b.heroes.some((id) => s.heroes[id].condition === 'dead') ||
        s.flags.duncanHp === 0 ||
        (b.hillRound >= 15 && !s.flags.lampsStopped))
    ) {
      this.store.lastMeal(s);
      this.end(room, s, 'meal');
      return;
    }
    if (b.kind === 'hill')
      while (b.monsters.filter((m) => m.active).length < 2 && b.replacements < 6) {
        const i = b.replacements++;
        b.monsters.push(i < 4 ? render(i + 2) : dissolver(i - 4));
        this.log(s, '另一個守衛離開洞口，接替被擊退的獵食者。');
        this.encounterSanity(s);
        if (s.sanityQueue.length) return;
      }
    if (!b.order.length) {
      const actor = b.heroes.find((id) => awake(s.heroes[id]) && !b.prepared[id]);
      if (actor) {
        b.waiting = { kind: 'prepare', actor };
        return;
      }
      this.order(s);
    }
    for (let guard = 0; guard < 100; guard++) {
      if (!b.monsters.some((m) => m.active)) {
        if (b.kind === 'sleeper') {
          s.combat = null;
          this.store.finish(s, 'repelled');
          return;
        }
        this.end(room, s, 'cleared');
        return;
      }
      const active = b.heroes.filter((id) => !b.escaped.includes(id) && awake(s.heroes[id]));
      if (!active.length) {
        this.end(room, s, 'withdrawn');
        return;
      }
      if (b.index >= b.order.length) {
        this.endRound(room, s);
        if (!s.combat) return;
        this.order(s);
        if (b.injury) return;
      }
      const turn = b.order[b.index];
      if (turn.pc) {
        const h = s.heroes[turn.id];
        if (!h || !awake(h) || b.escaped.includes(turn.id)) {
          b.index++;
          continue;
        }
        b.waiting = { kind: 'turn', actor: turn.id };
        return;
      }
      const m = this.target(s, turn.id);
      if (!m) {
        b.index++;
        continue;
      }
      if (!b.attacks) {
        b.attacks = m.attacks
          ? m.attacks.map((_, i) => i)
          : m.kind === 'render'
            ? m.limbs.map((n, i) => (n > 0 ? i : null)).filter((n) => n !== null)
            : m.kind === 'sleeper'
              ? Array.from({ length: Math.min(16, active.length) }, (_, i) => i)
              : [0];
        b.attackIndex = 0;
      }
      if (b.attackIndex >= b.attacks.length) {
        delete b.attacks;
        b.index++;
        continue;
      }
      const held = m.attacks && active.includes(m.heldSeat) ? m.heldSeat : null;
      const actor = held || active[(b.round + b.attackIndex + b.index) % active.length];
      b.waiting = { kind: 'defend', actor, monster: m.id, limb: b.attacks[b.attackIndex] };
      return;
    }
    fail('COC_COMBAT_STATE', '戰鬥狀態需要重新整理', 503);
  }
  act(room, s, seat, data) {
    const b = s.combat;
    if (!b) fail('COC_COMBAT', '目前沒有戰鬥');
    if (s.pending || s.check || s.offer || s.sanityQueue.length)
      fail('COC_PENDING', '請先處理目前的敘事或理智檢定');
    const h = this.store.hero(s, seat),
      command = data.command;
    if (b.injury) {
      if (b.injury.actor !== seat) fail('COC_NOT_ACTOR', '等待受傷的調查者決定');
      return this.injuryChoice(room, s, seat, command);
    }
    if (b.resolution) {
      if (b.resolution.actor !== seat) fail('COC_NOT_ACTOR', '等待目前擲骰者處理結果');
      return this.resolve(room, s, seat, data);
    }
    const waiting = b.waiting;
    if (!waiting || waiting.actor !== seat) fail('COC_NOT_ACTOR', '尚未輪到你', 403);
    if (waiting.kind === 'prepare') {
      const weapon = WEAPONS[data.weapon];
      if (
        command !== 'prepare' ||
        !weapon ||
        (data.weapon !== 'unarmed' && !h.equipment.includes(data.weapon))
      )
        fail('COC_WEAPON', '請宣告持有的武器');
      b.prepared[seat] = { weapon: data.weapon, readied: b.kind === 'cave' };
      b.waiting = null;
      this.pump(room, s);
      return;
    }
    if (waiting.kind === 'defend') return this.defend(room, s, seat, data);
    if (getScenario(s).combat?.command(this, room, s, seat, data)) return;
    if (command === 'attack') return this.attack(room, s, seat, data);
    if (command === 'readyWeapon') {
      if (
        !WEAPONS[data.weapon] ||
        (data.weapon !== 'unarmed' && !h.equipment.includes(data.weapon))
      )
        fail('COC_WEAPON', '無法備妥這項武器');
      b.prepared[seat] = { weapon: data.weapon, readied: true };
      delete h.droppedWeapon;
      delete h.gunJammed;
      this.log(
        s,
        h.name + ' 花費本回合備妥 ' + WEAPONS[data.weapon].name + '；下回合按此武器決定先攻。',
      );
      this.next(room, s);
      return;
    }
    if (command === 'reload') {
      if (
        !h.equipment.some((id) => WEAPONS[id]?.capacity) ||
        h.ammunition.reserve <= 0 ||
        h.ammunition.loaded >= 6
      )
        fail('COC_AMMO', '目前無法重新裝彈');
      const amount = Math.min(6 - h.ammunition.loaded, h.ammunition.reserve);
      h.ammunition.loaded += amount;
      h.ammunition.reserve -= amount;
      this.log(s, h.name + ' 重新裝填 ' + amount + ' 發子彈。');
    } else if (command === 'escape') {
      if (h.held || h.envelopedRound)
        fail('COC_HELD', '你正被抓住或吞沒，須先擊斷抓住你的觸肢、由同伴解圍，或依規則避免死亡');
      // One full action disengages to the edge of the scene. It never teleports
      // another hero, and returning to the investigation requires a party move.
      b.escaped.push(seat);
      this.log(s, h.name + ' 花費本回合脫離近戰，退到山坡外側等待同伴。');
    } else if (command === 'findDuncan' && b.kind === 'hill' && !b.foundDuncan) {
      const roll = rules.percentile(h.skills.spot, rules.talentBonus(h, 'spot'), this.store.rng);
      b.resolution = { id: uid(), kind: 'find', actor: seat, roll };
      b.waiting = null;
      return;
    } else if (command === 'dig' && b.kind === 'hill' && b.foundDuncan && !s.flags.duncanSaved) {
      b.dig++;
      this.log(s, h.name + ' 移開碎石；救援進度 ' + b.dig + '／6 人次回合。');
      if (b.dig >= 6) {
        s.flags.duncanSaved = true;
        this.log(s, 'Duncan 被救出，眾人將他帶到照明範圍外。');
        if (s.flags.lampsStopped) {
          this.end(room, s, 'rescued');
          this.store.finish(s, 'prevented');
          return;
        }
      }
    } else if (command === 'firstAid') {
      const target = s.heroes[data.target];
      if (
        !target ||
        !b.heroes.includes(data.target) ||
        b.escaped.includes(data.target) ||
        target.condition === 'dead' ||
        target.hp >= target.maxHp ||
        target.firstAidWound === target.woundId
      )
        fail('COC_HEAL', '這位同伴目前不能再次接受同一傷勢的急救');
      const roll = rules.percentile(h.skills.firstAid, 0, this.store.rng);
      b.resolution = { id: uid(), kind: 'firstAid', actor: seat, target: data.target, roll };
      b.waiting = null;
      return;
    } else if (command === 'wait') {
      this.log(s, h.name + ' 觀察局面並防守。');
    } else fail('COC_COMBAT_ACTION', '目前無法使用這項戰鬥操作', 400);
    this.next(room, s);
  }
  attack(room, s, seat, data) {
    const b = s.combat,
      h = s.heroes[seat],
      weapon = WEAPONS[data.weapon],
      m = this.target(s, data.target);
    if (
      !m ||
      !weapon ||
      data.weapon !== b.prepared[seat]?.weapon ||
      (data.weapon !== 'unarmed' && !h.equipment.includes(data.weapon))
    )
      fail('COC_WEAPON', '請使用本回合宣告的武器；換武器請先花一回合備妥');
    if ((h.gunJammed && weapon.capacity) || h.droppedWeapon === data.weapon)
      fail('COC_WEAPON', '武器需要先重新備妥');
    const shots = weapon.capacity ? integer(data.shots ?? 1, 1, 3) : 1;
    if (weapon.capacity && h.ammunition.loaded < shots) fail('COC_AMMO', '已裝填的子彈不足');
    const limb = m.kind === 'render' ? integer(data.limb, 0, 4) : null;
    if (limb !== null && m.limbs[limb] === 0) fail('COC_TARGET', '該觸肢已被擊斷');
    const penalty =
      (m.visible || h.sight ? 0 : 1) + (shots > 1 ? 1 : 0) + (h.bout?.until > s.minutes ? 1 : 0);
    const bonus = (h.condition === 'blazeGlory' ? 1 : 0) + (weapon.capacity ? 1 : 0);
    const rolls = Array.from({ length: shots }, () =>
      rules.percentile(h.skills[weapon.skill], clamp(bonus - penalty), this.store.rng),
    );
    // A defending servitor fights back in melee. Its roll is saved alongside
    // the hero's roll, and is never replaced by spending the hero's luck.
    const defense = weapon.capacity
      ? null
      : rules.percentile(m.attackSkill ?? (m.kind === 'render' ? 45 : 100), 0, this.store.rng);
    if (weapon.capacity) h.ammunition.loaded -= shots;
    b.resolution = {
      id: uid(),
      kind: 'attack',
      actor: seat,
      target: m.id,
      weapon: data.weapon,
      limb,
      rolls,
      defense,
      luckIndex: 0,
    };
    b.waiting = null;
    this.log(
      s,
      h.name + ' 以 ' + weapon.name + ' 攻擊 ' + m.name + '；骰值已保存。',
      clone({ rolls, defense }),
    );
  }
  defend(room, s, seat, data) {
    if (!['dodge', 'fightBack'].includes(data.response))
      fail('COC_DEFENSE', '請選擇閃避或反擊', 400);
    const b = s.combat,
      w = b.waiting,
      m = this.target(s, w.monster),
      h = s.heroes[seat],
      count = b.defenses[seat] || 0;
    const attack = rules.percentile(
        m.attacks?.[w.limb]?.skill ?? (m.kind === 'render' ? 45 : m.kind === 'sleeper' ? 80 : 100),
        count ? 1 : 0,
        this.store.rng,
      ),
      skill = data.response === 'dodge' ? 'dodge' : 'brawl';
    const defense = rules.percentile(
      h.skills[skill],
      h.bout?.until > s.minutes ? -1 : 0,
      this.store.rng,
    );
    b.defenses[seat] = count + 1;
    b.resolution = {
      id: uid(),
      kind: 'defense',
      actor: seat,
      target: m.id,
      response: data.response,
      roll: defense,
      attack,
      limb: w.limb,
    };
    b.waiting = null;
    this.log(
      s,
      h.name + ' 選擇' + (data.response === 'dodge' ? '閃避' : '反擊') + '，雙方擲骰已保存。',
      { attack, defense },
    );
  }
  resolve(room, s, seat, data) {
    const b = s.combat,
      r = b.resolution,
      h = s.heroes[seat];
    if (data.resultId !== r.id || data.command !== 'accept')
      fail('COC_STALE', '這次戰鬥擲骰已改變');
    if (data.luck) {
      const amount = integer(data.luck, 1, 100),
        index = r.rolls ? integer(data.rollIndex ?? 0, 0, r.rolls.length - 1) : 0;
      const roll = r.rolls ? r.rolls[index] : r.roll,
        adjusted = rules.spendLuck(h, roll, amount, { kind: 'combat' });
      h.luck -= amount;
      if (r.rolls) r.rolls[index] = adjusted;
      else r.roll = adjusted;
    }
    const fumble = r.rolls ? r.rolls.some((roll) => roll.level === -1) : r.roll?.level === -1;
    if (data.avoidFumble === true) {
      if (!fumble || h.luck < 10) fail('COC_LUCK', '避免戰鬥大失敗後果需要 10 幸運值');
      h.luck -= 10;
    }
    if (getScenario(s).combat?.resolve(this, room, s, seat, r)) return;
    if (r.kind === 'attack') {
      const m = this.target(s, r.target),
        weapon = WEAPONS[r.weapon];
      for (const roll of r.rolls) {
        if (!m?.active || (m.kind === 'render' && m.limbs[r.limb] === 0)) break;
        const won = weapon.capacity
          ? rules.passed(roll)
            ? 'attacker'
            : 'neither'
          : rules.melee(roll, r.defense, 'fightBack');
        if (won === 'attacker') {
          if (!roll.luckSpent) h.development = [...new Set([...h.development, weapon.skill])];
          this.hitMonster(
            s,
            m,
            weapon,
            rules.weaponDamage(weapon, h, roll.level >= 3, this.store.rng),
            r.limb,
          );
        } else if (won === 'defender') {
          this.monsterHit(s, m, seat, r.limb);
          break;
        } else this.log(s, '這次攻擊沒有命中。');
      }
      if (fumble && data.avoidFumble !== true) {
        if (weapon.capacity) h.gunJammed = true;
        else if (r.weapon !== 'unarmed') h.droppedWeapon = r.weapon;
        this.log(s, '戰鬥大失敗造成武器失去就緒狀態；需花一回合重新備妥。');
      }
    } else if (r.kind === 'defense') {
      const m = this.target(s, r.target),
        won = rules.melee(r.attack, r.roll, r.response);
      if (won === 'attacker') this.monsterHit(s, m, seat, r.limb);
      else if (won === 'defender' && r.response === 'fightBack' && rules.passed(r.roll)) {
        const selected = WEAPONS[b.prepared[seat]?.weapon],
          weapon = selected && !selected.capacity ? selected : WEAPONS.unarmed;
        this.hitMonster(
          s,
          m,
          weapon,
          rules.weaponDamage(weapon, h, false, this.store.rng),
          m.kind === 'render' ? r.limb : null,
        );
      } else this.log(s, h.name + ' 避開這次攻擊。');
      if (rules.passed(r.roll) && !r.roll.luckSpent)
        h.development = [
          ...new Set([...h.development, r.response === 'dodge' ? 'dodge' : 'brawl']),
        ];
    } else if (r.kind === 'find') {
      if (rules.passed(r.roll)) {
        b.foundDuncan = true;
        this.log(s, '在岩石下發現 Duncan；頭部與肩膀露在外面，他仍活著。');
      } else this.log(s, '這回合未能在混亂中找到 Duncan，可在下一回合繼續搜尋。');
    } else if (r.kind === 'firstAid') {
      const target = s.heroes[r.target];
      target.firstAidWound = target.woundId;
      if (rules.passed(r.roll)) {
        const amount = r.roll.level >= 3 ? 4 : rules.die(4, this.store.rng);
        target.hp = Math.min(target.maxHp, target.hp + amount);
        target.condition = 'healthy';
        this.log(s, target.name + ' 的傷勢被穩住，恢復 ' + amount + ' 體力。');
      } else if (r.roll.level === -1 && target.condition === 'dying') {
        target.condition = 'dead';
        this.queueInjury(s, r.target, '瀕死時急救大失敗');
      } else this.log(s, '急救未能改善傷勢。');
    }
    b.resolution = null;
    if (r.kind === 'defense') {
      b.attackIndex++;
      this.pump(room, s);
    } else this.next(room, s);
  }
  monsterHit(s, m, seat, limb) {
    if (!m) return;
    if (getScenario(s).combat?.monsterHit(this, s, m, seat, limb)) return;
    const b = s.combat,
      h = s.heroes[seat];
    if (m.kind === 'render') {
      const amount = rules.dice('1d10+' + m.db, this.store.rng).total;
      this.injury(s, seat, amount, m.name);
      if (awake(h)) {
        h.grabs ??= [];
        if (!h.grabs.some((g) => g.monster === m.id && g.limb === limb))
          h.grabs.push({ monster: m.id, limb });
        h.held = h.grabs.length;
      }
    } else if (m.kind === 'dissolver') {
      m.corporeal = true;
      this.injury(s, seat, rules.dice(m.db, this.store.rng).total, m.name);
      h.envelopedRound = b.round;
      h.envelopedMonster = m.id;
    } else {
      this.injury(s, seat, rules.dice('6d6', this.store.rng).total, m.name);
      h.caustic = true;
    }
  }
  injuryChoice(room, s, seat, command) {
    const b = s.combat,
      h = s.heroes[seat];
    if (['escapeDeath', 'scratch', 'stayConscious'].includes(command)) {
      const result = rules.pulpLuck(h, command, this.store.rng);
      h.luck -= result.cost;
      Object.assign(h, result);
      delete h.cost;
      if (command === 'escapeDeath') {
        h.returnFromScene = s.scene;
        b.escaped.push(seat);
      }
      this.log(s, h.name + ' 使用 ' + result.cost + ' 幸運值處理傷勢。');
    } else if (command === 'acceptInjury') {
      this.log(s, h.name + ' 保留目前傷勢。');
    } else if (
      command === 'blazeGlory' &&
      ['dead', 'dying'].includes(h.condition) &&
      !h.blazeUsed
    ) {
      h.blazeUsed = true;
      h.condition = 'blazeGlory';
      b.order.splice(b.index + 1, 0, { id: seat, pc: true, dex: 999, skill: 999 });
      this.log(s, h.name + ' 選擇最後一搏；完成下一次行動後將永久死亡。');
    } else fail('COC_INJURY', '請選擇目前可用的傷勢處理方式');
    b.injury = b.injuries.shift() || null;
    this.pump(room, s);
  }
  next(room, s) {
    const b = s.combat;
    if (!b) return;
    const turn = b.order[b.index];
    if (turn?.pc) {
      const h = s.heroes[turn.id];
      if (h?.condition === 'blazeGlory') {
        h.condition = 'dead';
        this.log(s, h.name + ' 完成最後一搏，永久死亡。');
      }
    }
    b.waiting = null;
    b.index++;
    this.pump(room, s);
  }
  endRound(room, s) {
    const b = s.combat;
    b.round++;
    this.store.advance(s, 0.1);
    if (!s.combat || s.status === 'finished') return;
    for (const id of b.heroes) {
      const h = s.heroes[id];
      if (b.escaped.includes(id)) continue;
      if (h.condition === 'luckConscious') {
        h.condition = 'unconscious';
        this.queueInjury(s, id, '下一回合需要再次支付幸運值以保持清醒');
      }
      if (h.condition === 'dying') {
        const roll = rules.percentile(h.attributes.CON, 0, this.store.rng);
        if (!rules.passed(roll)) {
          h.condition = 'dead';
          this.queueInjury(s, id, '瀕死體質檢定失敗');
        }
        this.log(s, h.name + ' 完成瀕死 CON 檢定。', roll);
      }
      if (h.hp > 0 && h.condition !== 'dead' && (h.held || h.caustic))
        this.injury(
          s,
          id,
          rules.dice(h.caustic ? '1d3' : h.held + 'd6', this.store.rng).total,
          '持續傷害',
        );
      if (h.envelopedRound && b.round - h.envelopedRound >= 2) {
        h.hp = 0;
        h.condition = 'dead';
        this.queueInjury(s, id, '被溶解侍從吞沒兩回合');
      }
    }
    for (const m of b.monsters)
      if (m.active && ['dissolver', 'sleeper'].includes(m.kind)) {
        m.hp = Math.min(m.maxHp, m.hp + (m.kind === 'dissolver' ? 5 : 2));
        if (m.kind === 'dissolver')
          m.corporeal = b.heroes.some(
            (id) =>
              !b.escaped.includes(id) &&
              s.heroes[id].envelopedMonster === m.id &&
              s.heroes[id].condition !== 'dead',
          );
      }
    if (b.kind === 'hill' && !s.flags.lastMealAt) {
      b.hillRound++;
      if (!s.flags.duncanSaved && b.hillRound % 3 === 0)
        s.flags.duncanHp = Math.max(0, (s.flags.duncanHp ?? 5) - 2);
      if (
        !b.injury &&
        (s.flags.lastMealAt !== undefined ||
          b.heroes.some((id) => s.heroes[id].condition === 'dead') ||
          s.flags.duncanHp === 0 ||
          (b.hillRound >= 15 && !s.flags.lampsStopped))
      ) {
        this.store.lastMeal(s);
        this.end(room, s, 'meal');
      }
    }
  }
  end(room, s, reason) {
    const b = s.combat;
    if (!b) return;
    for (const id of b.heroes) {
      const h = s.heroes[id];
      if (h.condition === 'luckConscious') h.condition = 'unconscious';
      delete h.held;
      delete h.grabs;
      delete h.caustic;
      delete h.envelopedRound;
      delete h.envelopedMonster;
    }
    s.combat = null;
    getScenario(s).combat?.end(this, room, s, b, reason);
    this.log(
      s,
      reason === 'cleared'
        ? '眼前的侍從退去，暫時有了喘息空間。'
        : '戰鬥結束，所有角色與傷勢已保存。',
    );
    if (reason === 'withdrawn' && !b.heroes.some((id) => awake(s.heroes[id]))) {
      s.status = 'paused';
      s.pauseReason = '隊伍已無法繼續行動，請處理傷勢或永久退場後更換角色';
    }
  }
  project(s) {
    const b = s.combat;
    if (!b) return null;
    const r = b.resolution;
    return {
      id: b.id,
      kind: b.kind,
      round: b.round,
      waiting: b.waiting ? clone(b.waiting) : null,
      injury: b.injury ? clone(b.injury) : null,
      resolution: r
        ? {
            id: r.id,
            kind: r.kind,
            actor: r.actor,
            target: r.target || null,
            roll: r.roll || null,
            rolls: r.rolls || [],
            attack: r.attack || null,
            defense: r.defense || null,
            poison: r.poison || null,
          }
        : null,
      monsters: b.monsters
        .filter((m) => m.active)
        .map((m) => ({
          id: m.id,
          kind: m.kind,
          name: m.name,
          hp: m.kind === 'render' ? null : m.hp,
          maxHp: m.maxHp,
          limbs: m.limbs || [],
          corporeal: m.corporeal === true,
        })),
      foundDuncan: b.foundDuncan,
      dig: b.dig,
      escaped: b.escaped,
      prepared: b.prepared,
      order: b.order.map((t) => ({ id: t.id, pc: t.pc })),
      turn: b.order[b.index]?.id || null,
    };
  }
}
module.exports = { CocCombat };
