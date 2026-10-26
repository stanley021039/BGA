'use strict';

// Rules core only. No default deck: the supplied rulebook does not contain a full catalog.
const { randomInt } = require('node:crypto');
const { fail } = require('./party-base');

const INDUSTRIES = Object.freeze([
  'entertainment',
  'finance',
  'hardware',
  'mobile',
  'retail',
  'technology',
]);
const STOCK_PRICES = Object.freeze([5, 8, 11, 15, 20, 30, 99]);
const STOCK_VALUES = Object.freeze([50, 40, 30, 20, 10, 0]);
const MARKET_FEES = Object.freeze([0, 0, 2, 4, 6, 8]);
const DISCARD_SLOTS = Object.freeze([1, 3, 4, 5]);
const NPC_ASSETS = Object.freeze({ 3: [100, 120, 140], 4: [100, 130], 5: [100], 6: [] });
const clone = (value) => structuredClone(value);
const validId = (id) => typeof id === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(id);
const integer = (value, min, max) => Number.isSafeInteger(value) && value >= min && value <= max;

function catalogError(message) {
  fail('INVALID_CATALOG', message, 400);
}

function validateScore(score) {
  if (!score || !integer(score.points, 0, 1000)) catalogError('公司計分數值不正確');
  if (score.kind === 'fixed') return { kind: 'fixed', points: score.points };
  if (!['industry', 'pair'].includes(score.kind)) catalogError('不支援的公司計分條件');
  const industries = score.industries;
  if (
    !Array.isArray(industries) ||
    !industries.length ||
    industries.length > INDUSTRIES.length ||
    new Set(industries).size !== industries.length ||
    industries.some((id) => !INDUSTRIES.includes(id)) ||
    (score.kind === 'pair' && industries.length !== 2)
  )
    catalogError('公司計分產業不正確');
  return { kind: score.kind, points: score.points, industries: [...industries] };
}

function validateCatalog(input) {
  if (!input || !['fixture', 'provisional', 'verified'].includes(input.status))
    catalogError('必須明示牌庫資料狀態');
  if (typeof input.source !== 'string' || !input.source.trim() || input.source.length > 500)
    catalogError('缺少牌庫來源');
  const ids = new Set();
  const card = (value, group) => {
    if (!value || !validId(value.id) || ids.has(value.id)) catalogError('卡片 ID 無效或重複');
    ids.add(value.id);
    if (typeof value.name !== 'string' || !value.name.trim() || value.name.length > 80)
      catalogError('卡片名稱不正確');
    if (typeof value.source !== 'string' || !value.source.trim() || value.source.length > 500)
      catalogError('每張卡必須有來源');
    if (!INDUSTRIES.includes(value.industry) || !integer(value.income, 0, 10))
      catalogError('公司產業或收入不正確');
    if (!group && (!integer(value.assets, 5, 200) || value.assets % 5 !== 0))
      catalogError('公司資產必須是 5 的倍數');
    if (!group && ![null, 'up', 'down'].includes(value.adjustment))
      catalogError('公司資產變動標記不正確');
    return {
      id: value.id,
      name: value.name.trim(),
      source: value.source.trim(),
      industry: value.industry,
      income: value.income,
      score: validateScore(value.score),
      ...(group ? {} : { assets: value.assets, adjustment: value.adjustment }),
    };
  };
  if (!Array.isArray(input.groups) || input.groups.length !== 6) catalogError('必須提供六張集團卡');
  if (!Array.isArray(input.companies) || input.companies.length < 6 || input.companies.length > 48)
    catalogError('公司牌庫需有 6 至 48 張');
  const groups = input.groups.map((value) => card(value, true));
  if (new Set(groups.map((group) => group.industry)).size !== 6)
    catalogError('六集團須涵蓋六種產業');
  const companies = input.companies.map((value) => card(value, false));
  const adjustments = {};
  for (const [kind, sign] of [
    ['up', 1],
    ['down', -1],
  ]) {
    const values = input.adjustments?.[kind];
    if (
      !Array.isArray(values) ||
      !values.length ||
      values.length > 12 ||
      values.some((value) => ![10, 15, 20].includes(sign * value))
    )
      catalogError('資產增減牌資料不正確');
    adjustments[kind] = [...values];
  }
  if (
    ['provisional', 'verified'].includes(input.status) &&
    (companies.length !== 48 || adjustments.up.length !== 12 || adjustments.down.length !== 12)
  )
    catalogError('完整牌庫需有 48 張公司與增減各 12 張');
  if (
    input.status === 'provisional' &&
    ['up', 'down'].some(
      (kind) =>
        companies.filter((company) => company.adjustment === kind).length >
        adjustments[kind].length,
    )
  )
    catalogError('暫用牌庫的資產增減牌必須足以供應所有對應公司');
  return { status: input.status, source: input.source.trim(), groups, companies, adjustments };
}

function shuffle(values, rng) {
  const result = clone(values);
  for (let i = result.length - 1; i > 0; i--) {
    const j = rng(i + 1);
    if (!integer(j, 0, i)) fail('INVALID_RANDOM', '亂數結果不正確', 500);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function safeAdd(a, b) {
  const result = a + b;
  if (!Number.isSafeInteger(result)) fail('VALUE_LIMIT', '金額或分數超過可安全計算範圍');
  return result;
}

function companyScore(cards) {
  const counts = new Map(INDUSTRIES.map((industry) => [industry, 0]));
  for (const card of cards) counts.set(card.industry, counts.get(card.industry) + 1);
  return cards.map((card) => {
    const { score } = card;
    const count =
      score.kind === 'fixed'
        ? 1
        : score.kind === 'pair'
          ? Math.min(...score.industries.map((industry) => counts.get(industry)))
          : score.industries.reduce((sum, industry) => sum + counts.get(industry), 0);
    return { cardId: card.id, score: score.points * count };
  });
}

function finalResults(state) {
  const ranking = state.groups
    .map((group) => ({
      groupId: group.id,
      npc: group.playerId === null,
      assets: group.publicAssets + group.changes.reduce((sum, value) => sum + value, 0),
    }))
    .sort((a, b) => b.assets - a.assets);
  for (let i = 0; i < ranking.length;) {
    let end = i + 1;
    while (end < ranking.length && ranking[end].assets === ranking[i].assets) end++;
    const value = STOCK_VALUES.slice(i, end).reduce((a, b) => a + b, 0) / (end - i);
    for (let j = i; j < end; j++) Object.assign(ranking[j], { rank: i + 1, stockValue: value });
    i = end;
  }
  const players = state.players.map((player) => {
    const group = state.groups.find((entry) => entry.playerId === player.id);
    const stock = state.groups.map((entry, index) => ({
      groupId: entry.id,
      count: player.holdings[index],
      value: ranking.find((rank) => rank.groupId === entry.id).stockValue,
    }));
    // LCM(1..6)=60 represents every possible rank tie exactly in integer units.
    const stockUnits = stock.reduce(
      (sum, entry) => sum + entry.count * Math.round(entry.value * 60),
      0,
    );
    const stockScore = stockUnits / 60;
    const companies = companyScore([group.card, ...group.companies]);
    const companiesScore = companies.reduce((sum, entry) => sum + entry.score, 0);
    const cashScore = Math.min(player.cash, 50);
    return {
      playerId: player.id,
      stock,
      stockScore,
      companies,
      companiesScore,
      cashScore,
      total: (stockUnits + (companiesScore + cashScore) * 60) / 60,
    };
  });
  const best = Math.max(...players.map((player) => player.total));
  const winners = players
    .filter((player) => player.total === best)
    .map((player) => player.playerId);
  return { ranking, players, winners };
}

class CeoGame {
  #state;
  #catalog;

  constructor({ playerIds, catalog, rng = randomInt }) {
    this.#catalog = validateCatalog(catalog);
    if (
      !Array.isArray(playerIds) ||
      !integer(playerIds.length, 3, 6) ||
      playerIds.some((id) => !validId(id)) ||
      new Set(playerIds).size !== playerIds.length
    )
      fail('INVALID_PLAYERS', 'CEO 需要 3 至 6 位不同玩家', 400);
    const groups = shuffle(this.#catalog.groups, rng).map((card, index) => ({
      id: card.id,
      card,
      playerId: playerIds[index] ?? null,
      publicAssets:
        index < playerIds.length ? 0 : NPC_ASSETS[playerIds.length][index - playerIds.length],
      companies: [],
      changes: [],
      sold: 0,
    }));
    const deck = shuffle(this.#catalog.companies, rng);
    const turnIndex = rng(playerIds.length);
    if (!integer(turnIndex, 0, playerIds.length - 1))
      fail('INVALID_RANDOM', '起始玩家亂數不正確', 500);
    this.#state = {
      phase: 'playing',
      revision: 0,
      round: 1,
      turnIndex,
      turnsInRound: 0,
      countdown: null,
      triggered: false,
      endingReason: null,
      groups,
      players: playerIds.map((id, index) => ({
        id,
        cash: 30,
        holdings: groups.map((_, i) => (i === index ? 7 : 0)),
      })),
      market: deck.splice(0, 6),
      deck,
      adjustments: {
        up: shuffle(this.#catalog.adjustments.up, rng),
        down: shuffle(this.#catalog.adjustments.down, rng),
      },
      discarded: [],
      events: [],
      results: null,
    };
  }

  act(playerId, action, expectedRevision) {
    const current = this.#state;
    if (!current.players.some((player) => player.id === playerId))
      fail('NOT_SEATED', '尚未入座', 403);
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision !== current.revision)
      fail('STALE_ACTION', '遊戲已更新，請重新讀取狀態');
    if (current.phase !== 'playing') fail('INVALID_PHASE', '遊戲已結束');
    if (current.players[current.turnIndex].id !== playerId)
      fail('NOT_YOUR_TURN', '還沒輪到你', 403);
    if (!action || !['acquire', 'buyStock', 'dividend'].includes(action.type))
      fail('INVALID_ACTION', '不支援的操作', 400);
    const state = clone(current);
    const player = state.players[state.turnIndex];
    const group = state.groups.find((entry) => entry.playerId === playerId);
    const event = { type: action.type, playerId };
    if (action.type === 'acquire') {
      const slot = state.market.findIndex((card) => card.id === action.companyId);
      if (slot < 0) fail('COMPANY_UNAVAILABLE', '這張公司卡不在市場');
      const card = state.market[slot];
      const price = card.assets + MARKET_FEES[slot];
      if (player.cash < price) fail('INSUFFICIENT_CASH', '現金不足');
      if (card.adjustment) {
        const pile = state.adjustments[card.adjustment];
        if (!pile.length) fail('RULE_DATA_EXHAUSTED', '增減牌已用盡，需補足牌庫或確認耗盡規則');
        group.changes.push(pile.shift());
      }
      player.cash -= price;
      group.publicAssets += card.assets;
      group.companies.push(card);
      state.market.splice(slot, 1);
      if (DISCARD_SLOTS.includes(slot)) state.discarded.push(state.market.shift());
      const needed = 6 - state.market.length;
      if (state.deck.length < needed && this.#catalog.status !== 'provisional')
        fail('RULE_DATA_EXHAUSTED', '公司牌不足以補滿市場，需確認耗盡規則');
      state.market.push(...state.deck.splice(0, needed));
      Object.assign(event, { companyId: card.id, price });
    } else if (action.type === 'buyStock') {
      if (state.countdown === 1) fail('FINAL_ROUND', '最後一輪不能購買股票');
      const issuerIndex = state.groups.findIndex((entry) => entry.id === action.issuerId);
      const issuer = state.groups[issuerIndex];
      if (!issuer || issuer.playerId === null || issuer.playerId === playerId)
        fail('INVALID_ISSUER', '只能購買其他玩家原始發行的股票', 400);
      if (issuer.sold === 7) fail('STOCK_UNAVAILABLE', '該集團股票已售完');
      const price = STOCK_PRICES[issuer.sold];
      if (player.cash < price) fail('INSUFFICIENT_CASH', '現金不足');
      const seller = state.players.find((entry) => entry.id === issuer.playerId);
      player.cash -= price;
      seller.cash = safeAdd(seller.cash, price);
      player.holdings[issuerIndex]++;
      seller.holdings[issuerIndex]--;
      issuer.sold++;
      Object.assign(event, { issuerId: issuer.id, price });
    } else {
      const groupIndex = state.groups.indexOf(group);
      const income = [group.card, ...group.companies].reduce((sum, card) => sum + card.income, 0);
      const payments = state.players.map((entry) => {
        const amount = income * entry.holdings[groupIndex];
        entry.cash = safeAdd(entry.cash, amount);
        return { playerId: entry.id, amount };
      });
      Object.assign(event, { issuerId: group.id, income, payments });
    }
    if (
      !state.triggered &&
      (group.publicAssets >= 100 ||
        (this.#catalog.status === 'provisional' && state.market.length === 0))
    ) {
      state.triggered = true;
      state.endingReason =
        group.publicAssets >= 100 ? 'assets-100' : 'provisional-market-exhausted';
    }
    state.turnsInRound++;
    state.turnIndex = (state.turnIndex + 1) % state.players.length;
    if (state.turnsInRound === state.players.length) {
      state.turnsInRound = 0;
      if (state.countdown === 1) {
        state.phase = 'finished';
        state.results = finalResults(state);
      } else {
        if (state.countdown === 2) state.countdown = 1;
        else if (state.triggered) state.countdown = 2;
        state.round++;
      }
    }
    state.revision++;
    state.events.push({ ...event, revision: state.revision });
    state.events = state.events.slice(-60);
    this.#state = state;
    return this.view(playerId);
  }

  view(playerId) {
    const state = this.#state;
    if (!state.players.some((player) => player.id === playerId))
      fail('NOT_SEATED', '尚未入座', 403);
    return this.#project(playerId);
  }
  observerView() {
    return this.#project(null);
  }
  #project(playerId) {
    const state = this.#state;
    const finished = state.phase === 'finished';
    return clone({
      type: 'ceo',
      catalogStatus: this.#catalog.status,
      catalogSource: this.#catalog.source,
      phase: state.phase,
      revision: state.revision,
      round: state.round,
      turnId: finished ? null : state.players[state.turnIndex].id,
      countdown: state.countdown,
      endingTriggered: state.triggered,
      endingReason: state.endingReason,
      players: state.players.map((player) => ({
        id: player.id,
        cash: player.cash,
        holdings: player.holdings.map((count, index) => ({
          groupId: state.groups[index].id,
          count,
        })),
      })),
      groups: state.groups.map((group) => ({
        id: group.id,
        card: group.card,
        playerId: group.playerId,
        publicAssets: group.publicAssets,
        companies: group.companies,
        adjustmentCount: group.changes.length,
        adjustments:
          finished || (playerId !== null && group.playerId === playerId) ? group.changes : null,
        income: [group.card, ...group.companies].reduce((sum, card) => sum + card.income, 0),
        nextStockPrice: group.playerId !== null && group.sold < 7 ? STOCK_PRICES[group.sold] : null,
      })),
      market: state.market.map((card, slot) => ({
        card,
        extraCost: MARKET_FEES[slot],
        discardsLeftmost: DISCARD_SLOTS.includes(slot),
      })),
      remainingCompanies: state.deck.length,
      discarded: state.discarded.map((card) => card.id),
      events: state.events,
      results: state.results,
    });
  }
}

module.exports = {
  CeoGame,
  validateCatalog,
  INDUSTRIES,
  STOCK_PRICES,
  STOCK_VALUES,
  MARKET_FEES,
  DISCARD_SLOTS,
};
