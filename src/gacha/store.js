'use strict';
const { randomInt, createHash } = require('node:crypto');
const { transaction } = require('../db');
const { HttpError } = require('../http/errors');
const { catalog, poolItems, poolLabels, byKey, publicItem } = require('./catalog');
const Ownership = require('./ownership');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const hash = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const dayFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Taipei',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const taipeiDay = (ms) => dayFormat.format(new Date(ms));
class GachaStore {
  constructor(db, { clock = Date.now, choose = randomInt } = {}) {
    this.db = db;
    this.clock = clock;
    this.choose = choose;
    this.dailyCache = new Map();
  }
  at() {
    return new Date(this.clock()).toISOString();
  }
  user(userId) {
    if (!this.db.prepare('SELECT 1 FROM users WHERE id=? AND disabled=0').get(userId))
      throw new HttpError(403, 'GACHA_UNAVAILABLE', '目前帳號無法使用抽卡機');
  }
  wallet(userId) {
    this.user(userId);
    this.db
      .prepare(
        'INSERT OR IGNORE INTO gacha_wallets(user_id,coins,fragments,updated_at) VALUES(?,0,0,?)',
      )
      .run(userId, this.at());
    const { coins, fragments } = this.db
      .prepare('SELECT coins,fragments FROM gacha_wallets WHERE user_id=?')
      .get(userId);
    return { coins, fragments };
  }
  owned(userId) {
    const saved = Ownership.appearance(this.db, userId),
      result = {};
    for (const kind of Object.keys(poolLabels).filter((k) => k !== 'all'))
      result[kind] = new Set(Ownership.ownedIds(this.db, userId, kind, saved));
    return result;
  }
  ledger(eventId, userId, reason, coins, fragments, fingerprint, at) {
    const previous = this.db
      .prepare('SELECT fingerprint FROM gacha_ledger WHERE event_id=?')
      .get(eventId);
    if (previous) {
      if (previous.fingerprint !== fingerprint)
        throw new HttpError(409, 'GACHA_EVENT_CONFLICT', '同一獎勵結算內容不一致');
      return false;
    }
    const wallet = this.wallet(userId),
      nextCoins = wallet.coins + coins,
      nextFragments = wallet.fragments + fragments;
    if (!Number.isSafeInteger(nextCoins) || !Number.isSafeInteger(nextFragments))
      throw new HttpError(409, 'GACHA_BALANCE_LIMIT', '餘額超出可處理範圍');
    if (nextCoins < 0) throw new HttpError(409, 'GACHA_COINS_REQUIRED', '抽卡幣不足');
    if (nextFragments < 0) throw new HttpError(409, 'GACHA_FRAGMENTS_REQUIRED', '碎片不足');
    this.db
      .prepare('UPDATE gacha_wallets SET coins=?,fragments=?,updated_at=? WHERE user_id=?')
      .run(nextCoins, nextFragments, at, userId);
    this.db
      .prepare('INSERT INTO gacha_ledger VALUES(?,?,?,?,?,?,?)')
      .run(eventId, userId, reason, coins, fragments, fingerprint, at);
    return true;
  }
  daily(userId) {
    const now = this.clock(),
      day = taipeiDay(now);
    if (this.dailyCache.get(userId) === day) return;
    const at = new Date(now).toISOString(),
      event = 'login:' + day + ':' + userId;
    transaction(this.db, () =>
      this.ledger(event, userId, 'login', 100, 0, hash({ userId, day, coins: 100 }), at),
    );
    this.dailyCache.set(userId, day);
    if (this.dailyCache.size > 2048) this.dailyCache.delete(this.dailyCache.keys().next().value);
  }
  state(userId) {
    this.daily(userId);
    const owned = this.owned(userId);
    const pools = Object.entries(poolLabels).map(([id, label]) => {
      const entries = poolItems(id),
        totalWeight = entries.reduce((n, i) => n + i.weight, 0);
      return { id, label, count: entries.length, totalWeight };
    });
    return {
      wallet: this.wallet(userId),
      pools,
      items: catalog.map((i) => ({ ...publicItem(i), owned: owned[i.kind].has(i.id) })),
      rules: {
        singleCost: 100,
        tenCost: 1000,
        dailyCoins: 100,
        matchCoins: 50,
        winnerCoins: 25,
        noPullPity: true,
      },
    };
  }
  request(userId, requestId, operation, payload, run) {
    if (typeof requestId !== 'string' || !UUID.test(requestId))
      throw new HttpError(400, 'INVALID_GACHA_REQUEST', '抽卡操作識別碼不正確');
    const fingerprint = hash({ operation, ...payload });
    return transaction(this.db, () => {
      this.user(userId);
      const old = this.db
        .prepare(
          'SELECT fingerprint,response_json FROM gacha_requests WHERE user_id=? AND request_id=?',
        )
        .get(userId, requestId);
      if (old) {
        if (old.fingerprint !== fingerprint)
          throw new HttpError(409, 'GACHA_REQUEST_CONFLICT', '同一操作識別碼已使用於其他內容');
        return JSON.parse(old.response_json);
      }
      const at = this.at(),
        result = run(at, fingerprint);
      this.db
        .prepare('INSERT INTO gacha_requests VALUES(?,?,?,?,?,?)')
        .run(userId, requestId, operation, fingerprint, JSON.stringify(result), at);
      return result;
    });
  }
  draw(userId, input = {}) {
    if (
      !input ||
      typeof input !== 'object' ||
      Array.isArray(input) ||
      Object.keys(input).some((k) => !['requestId', 'pool', 'count'].includes(k))
    )
      throw new HttpError(400, 'INVALID_GACHA_DRAW', '抽卡操作內容不正確');
    const { requestId, pool, count } = input;
    const entries = poolItems(pool);
    if (!entries?.length || ![1, 10].includes(count))
      throw new HttpError(400, 'INVALID_GACHA_DRAW', '請選擇有效卡池及單抽或十連');
    return this.request(userId, requestId, 'draw', { pool, count }, (at, fingerprint) => {
      const wallet = this.wallet(userId),
        cost = count * 100;
      if (wallet.coins < cost) throw new HttpError(409, 'GACHA_COINS_REQUIRED', '抽卡幣不足');
      const owned = this.owned(userId),
        total = entries.reduce((n, i) => n + i.weight, 0),
        results = [];
      let fragments = 0;
      for (let n = 0; n < count; n++) {
        let roll = this.choose(total);
        if (!Number.isSafeInteger(roll) || roll < 0 || roll >= total)
          throw Error('Invalid server gacha random sample');
        let item;
        for (const candidate of entries) {
          if (roll < candidate.weight) {
            item = candidate;
            break;
          }
          roll -= candidate.weight;
        }
        const duplicate = owned[item.kind].has(item.id);
        const gained = duplicate ? item.duplicateFragments : 0;
        fragments += gained;
        if (!duplicate) {
          this.db
            .prepare(
              "INSERT INTO gacha_ownership(user_id,kind,reward_id,source,acquired_at) VALUES(?,?,?,'draw',?)",
            )
            .run(userId, item.kind, item.id, at);
          owned[item.kind].add(item.id);
        }
        results.push({ ...publicItem(item), duplicate, fragments: gained });
      }
      this.ledger(
        'request:' + userId + ':' + requestId,
        userId,
        'draw',
        -cost,
        fragments,
        fingerprint,
        at,
      );
      return {
        requestId,
        pool,
        cost,
        results,
        fragmentsGained: fragments,
        wallet: this.wallet(userId),
        at,
      };
    });
  }
  exchange(userId, input = {}) {
    if (
      !input ||
      typeof input !== 'object' ||
      Array.isArray(input) ||
      Object.keys(input).some((k) => !['requestId', 'key'].includes(k))
    )
      throw new HttpError(400, 'INVALID_GACHA_REWARD', '兌換操作內容不正確');
    const { requestId, key } = input;
    const item = byKey.get(key);
    if (!item) throw new HttpError(400, 'INVALID_GACHA_REWARD', '找不到這個獎勵');
    return this.request(userId, requestId, 'exchange', { key }, (at, fingerprint) => {
      if (this.owned(userId)[item.kind].has(item.id))
        throw new HttpError(409, 'GACHA_ALREADY_OWNED', '你已擁有這個獎勵');
      this.ledger(
        'request:' + userId + ':' + requestId,
        userId,
        'exchange',
        0,
        -item.exchangeCost,
        fingerprint,
        at,
      );
      this.db
        .prepare(
          "INSERT INTO gacha_ownership(user_id,kind,reward_id,source,acquired_at) VALUES(?,?,?,'exchange',?)",
        )
        .run(userId, item.kind, item.id, at);
      return {
        requestId,
        item: publicItem(item),
        cost: item.exchangeCost,
        wallet: this.wallet(userId),
        at,
      };
    });
  }
  history(userId) {
    this.user(userId);
    return {
      operations: this.db
        .prepare(
          'SELECT response_json,operation FROM gacha_requests WHERE user_id=? ORDER BY created_at DESC,request_id DESC LIMIT 20',
        )
        .all(userId)
        .map((row) => ({ operation: row.operation, ...JSON.parse(row.response_json) })),
    };
  }
  awardMatch(facts) {
    if (facts?.purpose !== 'production' || facts.normalEnd !== true) return [];
    if (
      typeof facts.id !== 'string' ||
      facts.id.length > 160 ||
      typeof facts.game !== 'string' ||
      !Array.isArray(facts.participants) ||
      facts.participants.length > 12
    )
      throw Error('Invalid trusted gacha match');
    const humans = facts.participants.filter((p) => p.bot !== true && typeof p.userId === 'string');
    if (new Set(humans.map((p) => p.userId)).size !== humans.length)
      throw Error('Duplicate gacha match participant');
    if (humans.length < 2) return [];
    const at = facts.completedAt || this.at(),
      fingerprint = hash({
        id: facts.id,
        game: facts.game,
        participants: humans
          .map((p) => ({
            userId: p.userId,
            operated: p.operated === true,
            winner: p.winner === true,
          }))
          .sort((a, b) => a.userId.localeCompare(b.userId)),
      });
    return transaction(this.db, () => {
      const awards = [];
      for (const p of humans) {
        if (
          !p.operated ||
          !this.db.prepare('SELECT 1 FROM users WHERE id=? AND disabled=0').get(p.userId)
        )
          continue;
        const coins = 50 + (p.winner ? 25 : 0);
        if (
          this.ledger(
            'match:' + facts.game + ':' + facts.id + ':' + p.userId,
            p.userId,
            'match',
            coins,
            0,
            fingerprint,
            at,
          )
        )
          awards.push({ userId: p.userId, coins });
      }
      return awards;
    });
  }
}
module.exports = { GachaStore, taipeiDay };
