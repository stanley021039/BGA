'use strict';
const { fail } = require('./party-base');
// Counts are denomination-specific; printed component grand totals vary by edition.
// Base: Schmidt English 2024 contents illustration; expansion: Herb Witches
// North Star 2019 component list (spare whites excluded; whites are not for sale).
const INGREDIENT_SUPPLY = Object.freeze({
  orange: Object.freeze({ 1: 32, 6: 20 }),
  green: Object.freeze({ 1: 25, 2: 15, 4: 18 }),
  blue: Object.freeze({ 1: 22, 2: 15, 4: 15 }),
  red: Object.freeze({ 1: 18, 2: 13, 4: 15 }),
  yellow: Object.freeze({ 1: 19, 2: 11, 4: 15 }),
  purple: Object.freeze({ 1: 23 }),
  black: Object.freeze({ 1: 26 }),
  locoweed: Object.freeze({ 1: 25 }),
});
const methods = {
  initMarket() {
    // Fixed complete base + Herb Witches supply. Never scale by seat count.
    this.marketSupply = {};
    this.marketCapacity = {};
    for (const [color, values] of Object.entries(INGREDIENT_SUPPLY))
      for (const [value, count] of Object.entries(values)) {
        const key = color + ':' + value;
        this.marketCapacity[key] = count;
        this.marketSupply[key] = count;
      }
    // Starting coloured ingredients are already in the bags, not in the shop.
    for (const p of this.activePlayers())
      for (const chip of p.bag)
        if (this.marketSupply[chip.color + ':' + chip.value] !== undefined)
          this.marketSupply[chip.color + ':' + chip.value]--;
    this.marketTurns = [];
    this.marketIndex = 0;
    this.marketPendingAdvance = null;
    this.purchaseNotices = [];
  },
  beginMarketTurns() {
    const start = this.players.findIndex((p) => p.id === this.roundStarterId);
    this.marketTurns = this.players
      .slice(start)
      .concat(this.players.slice(0, start))
      .map((p) => p.id);
    this.marketIndex = 0;
    this.marketPendingAdvance = null;
  },
  marketTurn() {
    if (this.phase !== 'settlement' || this.stage !== 'shopping') return null;
    const order = this.marketTurns || [];
    if (!order.length) return null;
    return this.player(order[this.marketIndex])?.id || null;
  },
  assertMarketTurn(id) {
    const turn = this.marketTurn();
    if (turn && turn !== id) fail('NOT_SHOP_TURN', '請等目前玩家完成這次購買');
  },
  advanceMarket() {
    const order = this.marketTurns || [];
    if (!order.length) return;
    for (let step = 1; step <= order.length; step++) {
      const index = (this.marketIndex + step) % order.length,
        p = this.player(order[index]);
      if (p && !p.ready) {
        this.marketIndex = index;
        this.marketPendingAdvance = null;
        return;
      }
    }
  },
  finishMarketAction(p) {
    if (p.pending?.length) this.marketPendingAdvance = p.id;
    else this.advanceMarket();
  },
  marketStock(color, value) {
    return this.marketSupply?.[color + ':' + value] ?? null;
  },
  takeMarketStock(color, value) {
    const key = color + ':' + value,
      n = this.marketStock(color, value);
    if (n !== null) {
      if (n < 1) fail('SOLD_OUT', '這種數值的藥材已售完');
      this.marketSupply[key]--;
    }
  },
  returnMarketStock(color, value) {
    const key = color + ':' + value;
    if (this.marketStock(color, value) !== null)
      this.marketSupply[key] = Math.min(this.marketCapacity[key], this.marketSupply[key] + 1);
  },
  recordPurchase(p, color, value, extra = false) {
    const notice = {
      id: require('node:crypto').randomUUID(),
      playerId: p.id,
      name: p.name,
      color,
      value,
      extra,
      round: this.round,
      at: this.now(),
    };
    this.purchaseNotices.push(notice);
    this.purchaseNotices = this.purchaseNotices.slice(-64);
  },
  marketView() {
    return {
      turnPlayerId: this.marketTurn(),
      order: this.marketTurns || [],
      stock: this.marketSupply || {},
      capacity: this.marketCapacity || {},
      notices: this.purchaseNotices || [],
      policy: 'match',
    };
  },
};
module.exports = { methods, INGREDIENT_SUPPLY };
