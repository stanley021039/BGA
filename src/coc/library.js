'use strict';
const { transaction } = require('../db');
const {
  RULES_VERSION,
  ATTRIBUTES,
  SKILLS,
  ARCHETYPES,
  OCCUPATIONS,
  TALENTS,
  publicCatalog,
} = require('./catalog');
const rules = require('./rules');
const {
  fail,
  clone,
  uid,
  stamp,
  text,
  integer,
  isRecord,
  ownKeys,
  requestId,
  fingerprint,
} = require('./util');

function allocations(value, allowed, budget) {
  if (!isRecord(value)) fail('COC_ALLOCATION', '技能分配格式不正確', 400);
  let used = 0;
  const result = {};
  for (const [id, amount] of Object.entries(value)) {
    if (!allowed.includes(id)) fail('COC_ALLOCATION', '所選技能不屬於這類點數', 400);
    integer(amount, 0, 1000);
    used += amount;
    if (amount) result[id] = amount;
  }
  if (used > budget) fail('COC_POINT_BUDGET', '技能點數超過可用總額', 400);
  return { values: result, used, remaining: budget - used };
}
function allocationBudgets(draft) {
  return {
    occupation: OCCUPATIONS[draft.occupation].points(draft.attributes),
    archetype: 100,
    interest: draft.attributes.INT * 2,
  };
}
function validateDraft(draft, input, complete = false) {
  ownKeys(input, ['name', 'age', 'talents', 'background', 'equipment', 'allocations', 'ready']);
  const next = clone(draft);
  next.name = text(input.name, 80);
  next.age = integer(input.age, 15, 90);
  if (
    !Array.isArray(input.talents) ||
    new Set(input.talents).size !== input.talents.length ||
    input.talents.some((id) => !Object.hasOwn(TALENTS, id)) ||
    input.talents.length > 2
  )
    fail('COC_TALENTS', '請從支援天賦中選擇兩個不同項目', 400);
  next.talents = input.talents;
  ownKeys(input.background, [
    'description',
    'belief',
    'person',
    'place',
    'possession',
    'trait',
    'connection',
  ]);
  next.background = Object.fromEntries(
    ['description', 'belief', 'person', 'place', 'possession', 'trait', 'connection'].map((id) => [
      id,
      text(input.background[id] || '', 500, true),
    ]),
  );
  if (
    !Array.isArray(input.equipment) ||
    input.equipment.length > 12 ||
    input.equipment.some(
      (id) =>
        ![
          'notebook',
          'flashlight',
          'rope',
          'firstAidKit',
          'camera',
          'toolkit',
          'club',
          'knife',
          'handgun',
        ].includes(id),
    )
  )
    fail('COC_EQUIPMENT', '起始裝備選項不正確', 400);
  next.equipment = [...new Set(input.equipment)];
  ownKeys(input.allocations, ['occupation', 'archetype', 'interest']);
  const budgets = allocationBudgets(next),
    career = OCCUPATIONS[next.occupation],
    archetype = ARCHETYPES[next.archetype];
  const allowed = {
    occupation: [...career.skills, 'credit'],
    archetype: archetype.skills,
    interest: Object.keys(SKILLS).filter((id) => id !== 'mythos'),
  };
  const plans = Object.fromEntries(
    Object.keys(budgets).map((kind) => [
      kind,
      allocations(input.allocations[kind], allowed[kind], budgets[kind]),
    ]),
  );
  next.allocations = Object.fromEntries(
    Object.entries(plans).map(([kind, value]) => [kind, value.values]),
  );
  next.skills = Object.fromEntries(
    Object.keys(SKILLS).map((id) => [
      id,
      rules.skillBase(id, next.attributes) +
        Object.values(plans).reduce((sum, plan) => sum + (plan.values[id] || 0), 0),
    ]),
  );
  if (complete) {
    if (next.talents.length !== 2) fail('COC_TALENTS', '完成角色前請選擇兩項天賦', 400);
    if (next.skills.credit < career.credit[0] || next.skills.credit > career.credit[1])
      fail('COC_CREDIT', `此職業的信用評級必須在 ${career.credit.join('–')} 之間`, 400);
    if (plans.occupation.remaining || plans.interest.remaining)
      fail('COC_UNSPENT_POINTS', '請先分配所有職業與興趣技能點數', 400);
    if (['description', 'belief', 'person', 'connection'].some((id) => !next.background[id]))
      fail('COC_BACKGROUND', '請完成外觀、信念、重要之人與調查緣由', 400);
  }
  return { draft: next, plans };
}
function initialDraft({ name, archetype, core, occupation }, rng) {
  if (
    !Object.hasOwn(ARCHETYPES, archetype) ||
    !ARCHETYPES[archetype].cores.includes(core) ||
    !Object.hasOwn(OCCUPATIONS, occupation)
  )
    fail('COC_BUILD', '原型、核心能力或職業不正確', 400);
  const attributes = {},
    rolls = {};
  for (const id of Object.keys(ATTRIBUTES)) {
    const roll = rules.dice(
      id === core ? '1d6+13' : ['SIZ', 'INT', 'EDU'].includes(id) ? '2d6+6' : '3d6',
      rng,
    );
    rolls[id] = roll;
    attributes[id] = roll.total * 5;
  }
  rolls.luck = rules.dice('2d6+6', rng);
  return {
    name: text(name, 80),
    archetype,
    core,
    occupation,
    attributes,
    luck: rolls.luck.total * 5,
    rolls,
    age: 30,
    talents: [],
    background: {
      description: '',
      belief: '',
      person: '',
      place: '',
      possession: '',
      trait: '',
      connection: '',
    },
    equipment: ['notebook', 'flashlight'],
    allocations: { occupation: {}, archetype: {}, interest: {} },
  };
}
function makeSheet(draft) {
  const derived = rules.secondary(draft.attributes);
  return {
    ...clone(draft),
    rulesVersion: RULES_VERSION,
    ...derived,
    hp: derived.maxHp,
    mp: derived.maxMp,
    san: draft.attributes.POW,
    sanDayStart: draft.attributes.POW,
    sanDayLoss: 0,
    condition: 'healthy',
    development: [],
    phobias: [],
    ammunition: draft.equipment.includes('handgun')
      ? { loaded: 6, reserve: 24 }
      : { loaded: 0, reserve: 0 },
    history: [],
  };
}
const PREGENS = {
  investigator: {
    name: '艾芙琳・沃德',
    archetype: 'hardBoiled',
    core: 'CON',
    attributes: { STR: 60, CON: 85, SIZ: 65, DEX: 65, APP: 55, INT: 70, POW: 60, EDU: 65 },
    luck: 70,
  },
  archaeologist: {
    name: '亞瑟・貝爾',
    archetype: 'explorer',
    core: 'POW',
    attributes: { STR: 60, CON: 60, SIZ: 65, DEX: 65, APP: 50, INT: 70, POW: 85, EDU: 75 },
    luck: 65,
  },
  nurse: {
    name: '露西・陳',
    archetype: 'seeker',
    core: 'INT',
    attributes: { STR: 50, CON: 65, SIZ: 55, DEX: 65, APP: 60, INT: 85, POW: 70, EDU: 75 },
    luck: 75,
  },
  author: {
    name: '山繆・里德',
    archetype: 'egghead',
    core: 'EDU',
    attributes: { STR: 45, CON: 60, SIZ: 60, DEX: 55, APP: 65, INT: 75, POW: 65, EDU: 90 },
    luck: 70,
  },
};
function pregenDraft(occupation, name) {
  if (!Object.hasOwn(PREGENS, occupation)) fail('COC_PREGEN', '預設角色不存在', 400);
  const preset = clone(PREGENS[occupation]);
  // These are fixed, original pregens, not a client-provided characteristic set.
  const draft = initialDraft(
    { name: name || preset.name, occupation, archetype: preset.archetype, core: preset.core },
    (min) => min,
  );
  draft.attributes = preset.attributes;
  draft.luck = preset.luck;
  draft.rolls = Object.fromEntries(
    [...Object.entries(preset.attributes), ['luck', preset.luck]].map(([id, value]) => [
      id,
      { source: 'pregen', total: value / 5, expression: '固定預設角色' },
    ]),
  );
  return autofill(draft);
}
function autofill(draft) {
  const career = OCCUPATIONS[draft.occupation],
    archetype = ARCHETYPES[draft.archetype],
    budgets = allocationBudgets(draft);
  const plans = {
    occupation: { credit: Math.max(career.credit[0], 15) },
    archetype: {},
    interest: {},
  };
  function distribute(kind, skills, amount) {
    for (let i = 0; amount > 0; i++) {
      const id = skills[i % skills.length],
        base =
          rules.skillBase(id, draft.attributes) +
          Object.values(plans).reduce((sum, plan) => sum + (plan[id] || 0), 0);
      if (base >= 85 && i < skills.length * 100) continue;
      plans[kind][id] = (plans[kind][id] || 0) + 1;
      amount--;
    }
  }
  distribute('occupation', career.skills, budgets.occupation - plans.occupation.credit);
  distribute('archetype', archetype.skills, budgets.archetype);
  distribute(
    'interest',
    ['spot', 'listen', 'library', 'firstAid', 'brawl', 'dodge', 'persuade', 'stealth'],
    budgets.interest,
  );
  return {
    ...draft,
    allocations: plans,
    talents: ['keenVision', 'strongWilled'],
    equipment: ['notebook', 'flashlight', 'firstAidKit', 'club', 'handgun'],
    background: {
      description: '一位穿著實用外套、隨身攜帶筆記本的調查者。',
      belief: '證據比流言可靠。',
      person: '願意在危急時刻互相支援的朋友。',
      place: '阿卡姆的家。',
      possession: '記錄過往案件的筆記本。',
      trait: '遇到疑點會追查到底。',
      connection: '在阿卡姆有固定住處，與其他調查者相識；願意調查鄰里發生的怪事。',
    },
  };
}
class CocLibrary {
  constructor(db, { rng } = {}) {
    this.db = db;
    this.rng = rng;
  }
  receipt(user, data, scope, run) {
    const id = requestId(data.requestId),
      print = fingerprint({ scope, ...data });
    return transaction(this.db, () => {
      const previous = this.db
        .prepare('SELECT * FROM coc_receipts WHERE user_id=? AND request_id=?')
        .get(user.id, id);
      if (previous) {
        if (previous.scope !== scope || previous.fingerprint !== print)
          fail('COC_REQUEST_REUSED', '操作識別碼已用於其他內容');
        return JSON.parse(previous.response_json);
      }
      const result = run();
      this.db
        .prepare('INSERT INTO coc_receipts VALUES(?,?,?,?,?,?)')
        .run(user.id, id, scope, print, JSON.stringify(result), stamp());
      return result;
    });
  }
  row(user, id) {
    const row = this.db
      .prepare('SELECT * FROM coc_characters WHERE id=? AND owner_id=?')
      .get(id, user.id);
    if (!row) fail('COC_CHARACTER_NOT_FOUND', '找不到自己的角色', 404);
    return row;
  }
  view(row) {
    const draft = JSON.parse(row.draft_json),
      sheet = row.sheet_json ? JSON.parse(row.sheet_json) : null;
    return {
      id: row.id,
      name: row.name,
      status: row.status,
      revision: row.revision,
      rulesVersion: row.rules_version,
      draft,
      budgets: allocationBudgets(draft),
      sheet,
      continued: !!sheet?.continuedFrom,
      updatedAt: row.updated_at,
    };
  }
  list(user) {
    return {
      catalog: publicCatalog(),
      characters: this.db
        .prepare('SELECT * FROM coc_characters WHERE owner_id=? ORDER BY updated_at DESC')
        .all(user.id)
        .map((row) => this.view(row)),
    };
  }
  create(user, data) {
    return this.receipt(user, data, 'character-create', () => {
      if (
        this.db.prepare('SELECT COUNT(*) n FROM coc_characters WHERE owner_id=?').get(user.id).n >=
        40
      )
        fail('COC_LIBRARY_FULL', '角色庫已達 40 張，請先整理不使用的草稿');
      let draft =
        data.pregen === true
          ? pregenDraft(data.occupation, data.name)
          : initialDraft(data, this.rng);
      if (data.pregen === true) {
        draft = validateDraft(
          draft,
          {
            name: draft.name,
            age: draft.age,
            talents: draft.talents,
            background: draft.background,
            equipment: draft.equipment,
            allocations: draft.allocations,
          },
          true,
        ).draft;
      }
      const id = uid(),
        at = stamp(),
        sheet = data.pregen === true ? makeSheet(draft) : null;
      this.db
        .prepare('INSERT INTO coc_characters VALUES(?,?,?,?,1,?,?,?,?,?)')
        .run(
          id,
          user.id,
          draft.name,
          sheet ? 'ready' : 'draft',
          RULES_VERSION,
          JSON.stringify(draft),
          sheet ? JSON.stringify(sheet) : null,
          at,
          at,
        );
      for (const [slot, result] of Object.entries(draft.rolls))
        this.db
          .prepare('INSERT INTO coc_character_rolls VALUES(?,?,?)')
          .run(id, slot, JSON.stringify(result));
      return this.view(this.row(user, id));
    });
  }
  save(user, data) {
    return this.receipt(user, data, 'character-save', () => {
      const row = this.row(user, data.id);
      integer(data.revision, 1, 100000000);
      if (row.sheet_json && JSON.parse(row.sheet_json).continuedFrom)
        fail(
          'COC_VETERAN_LOCKED',
          '這是冒險後的完整紀錄，不能重新配點或補回消耗；請在下一篇使用獨立副本',
        );
      if (row.revision !== data.revision)
        fail('COC_CHARACTER_STALE', '角色已在其他分頁變更，請重新載入');
      const draft = validateDraft(
        JSON.parse(row.draft_json),
        data.character,
        data.character.ready === true,
      ).draft;
      const sheet = data.character.ready === true ? makeSheet(draft) : null;
      this.db
        .prepare(
          'UPDATE coc_characters SET name=?,status=?,revision=revision+1,draft_json=?,sheet_json=?,updated_at=? WHERE id=? AND owner_id=? AND revision=?',
        )
        .run(
          draft.name,
          sheet ? 'ready' : 'draft',
          JSON.stringify(draft),
          sheet ? JSON.stringify(sheet) : null,
          stamp(),
          row.id,
          user.id,
          row.revision,
        );
      return this.view(this.row(user, row.id));
    });
  }
  getReady(user, id) {
    const row = this.row(user, id);
    if (row.status !== 'ready' || row.rules_version !== RULES_VERSION)
      fail('COC_CHARACTER_NOT_READY', '請先完成符合本篇規則的角色');
    const sheet = JSON.parse(row.sheet_json);
    if (['dead', 'retired', 'dying', 'unconscious'].includes(sheet.condition) || sheet.hp <= 0)
      fail('COC_CHARACTER_UNABLE', '這張角色卡目前無法參與新的冒險');
    return {
      ...sheet,
      condition: sheet.condition === 'returnNextScene' ? 'healthy' : sheet.condition,
      sourceCharacterId: row.id,
      sourceRevision: row.revision,
    };
  }
  suggest(user, id) {
    return autofill(JSON.parse(this.row(user, id).draft_json));
  }
}
module.exports = {
  CocLibrary,
  initialDraft,
  validateDraft,
  makeSheet,
  autofill,
  allocationBudgets,
  PREGENS,
};
