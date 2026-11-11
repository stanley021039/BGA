'use strict';
const { randomInt, createHash } = require('node:crypto');
const { transaction } = require('../db');
const { HttpError } = require('../http/errors');
const { catalog, kinds, poolItems, poolLabels, byKey, publicItem } = require('./catalog');
const Ownership = require('./ownership');
const Odds = require('./odds');
const economy = require('../../public/shared/gacha-economy.json');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const hash = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const dayFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Taipei',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const taipeiDay = (ms) => dayFormat.format(new Date(ms));
const legendaryLoginDays = 7;
const epicClaimEvent = (userId) => 'third-login-epic-ten-claim:' + userId;
const epicEvent = (userId) => 'third-login-epic-ten:' + userId;
const checkinEvent = (day, userId) => 'checkin:' + day + ':' + userId;
const dailyClaimEvent = (day, userId) => 'login:' + day + ':' + userId;
const voucherEvent = (action, userId) => 'checkin-legendary-' + action + ':' + userId;
const matchEvent = (facts, userId) => 'match:' + facts.game + ':' + facts.id + ':' + userId;
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
    for (const kind of kinds)
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
    if (nextCoins < 0) throw new HttpError(409, 'GACHA_COINS_REQUIRED', '聖潔石不足');
    if (nextFragments < 0) throw new HttpError(409, 'GACHA_FRAGMENTS_REQUIRED', '碎片不足');
    this.db
      .prepare('UPDATE gacha_wallets SET coins=?,fragments=?,updated_at=? WHERE user_id=?')
      .run(nextCoins, nextFragments, at, userId);
    this.db
      .prepare('INSERT INTO gacha_ledger VALUES(?,?,?,?,?,?,?)')
      .run(eventId, userId, reason, coins, fragments, fingerprint, at);
    return true;
  }
  daily(userId, now = this.clock()) {
    const day = taipeiDay(now);
    if (this.dailyCache.get(userId) === day) return;
    const at = new Date(now).toISOString();
    transaction(this.db, () => {
      this.ledger(checkinEvent(day, userId), userId, 'login', 0, 0, hash({ userId, day }), at);
    });
    this.dailyCache.set(userId, day);
    if (this.dailyCache.size > 2048) this.dailyCache.delete(this.dailyCache.keys().next().value);
  }
  hasEvent(eventId) {
    return !!this.db.prepare('SELECT 1 FROM gacha_ledger WHERE event_id=?').get(eventId);
  }
  checkin(userId, day = taipeiDay(this.clock())) {
    this.user(userId);
    const claim = dailyClaimEvent(day, userId);
    const { visits, claims, claimed } = this.db
      .prepare(
        `SELECT COUNT(DISTINCT CASE WHEN event_id GLOB 'login:*' THEN substr(event_id,7,10)
                 WHEN event_id GLOB 'checkin:*' THEN substr(event_id,9,10) END) AS visits,
                COUNT(CASE WHEN event_id GLOB 'login:*' THEN 1 END) AS claims,
                COALESCE(MAX(event_id=?),0) AS claimed
         FROM gacha_ledger WHERE user_id=? AND reason='login'`,
      )
      .get(claim, userId);
    const cycle = economy.dailyLoginBonuses.map((bonus) => economy.dailyCoins + bonus);
    const step = (claims - claimed) % cycle.length;
    const claimedVoucher = this.hasEvent(voucherEvent('claim', userId));
    const usedVoucher = claimedVoucher && this.hasEvent(voucherEvent('use', userId));
    return {
      day,
      visits,
      cycle,
      step,
      claimed: !!claimed,
      epicTen: {
        days: 3,
        status: this.hasEvent(epicEvent(userId))
          ? 'used'
          : this.hasEvent(epicClaimEvent(userId))
            ? 'available'
            : visits >= 3
              ? 'claimable'
              : 'locked',
      },
      milestone: {
        days: legendaryLoginDays,
        status: usedVoucher
          ? 'used'
          : claimedVoucher
            ? 'available'
            : visits >= legendaryLoginDays
              ? 'claimable'
              : 'locked',
      },
    };
  }
  claimCheckin(userId, kind) {
    const now = this.clock();
    this.daily(userId, now);
    return transaction(this.db, () => {
      const at = new Date(now).toISOString();
      const day = taipeiDay(now);
      const state = this.checkin(userId, day);
      if (kind === 'epic-ten') {
        if (state.epicTen.status === 'locked')
          throw new HttpError(409, 'GACHA_CHECKIN_NOT_READY', '累積登入三天後可領取');
        if (state.epicTen.status === 'claimable') {
          const event = epicClaimEvent(userId);
          this.ledger(event, userId, 'login', 0, 0, hash({ event }), at);
        }
      } else if (kind === 'daily') {
        if (!state.claimed) {
          const coins = state.cycle[state.step];
          this.ledger(
            dailyClaimEvent(day, userId),
            userId,
            'login',
            coins,
            0,
            hash({ userId, day, coins }),
            at,
          );
        }
      } else if (state.milestone.status === 'locked') {
        throw new HttpError(409, 'GACHA_CHECKIN_NOT_READY', '首次累積登入七天後才可領取');
      } else if (state.milestone.status === 'claimable') {
        const event = voucherEvent('claim', userId);
        this.ledger(event, userId, 'login', 0, 0, hash({ event }), at);
      }
      return { ...this.checkin(userId, day), wallet: this.wallet(userId) };
    });
  }
  drawCounts(userId) {
    const rows = this.db
      .prepare(
        `SELECT json_extract(response_json, '$.pool') AS pool,
                SUM(json_array_length(response_json, '$.results')) AS total
         FROM gacha_requests WHERE user_id=? AND operation='draw'
           AND json_extract(response_json, '$.voucher') IS NOT 1 AND json_extract(response_json, '$.thirdLogin') IS NOT 1 GROUP BY pool`,
      )
      .all(userId);
    return new Map(rows.map(({ pool, total }) => [pool, total]));
  }
  state(userId) {
    this.daily(userId);
    const owned = this.owned(userId);
    const odds = Odds.read(this.db);
    const drawCounts = this.drawCounts(userId);
    const pools = Object.entries(poolLabels).map(([id, label]) => {
      const entries = poolItems(id),
        { totalWeight } = Odds.distribution(entries, odds.weights);
      const bonusWeights = Object.fromEntries(
        Odds.distribution(entries, odds.weights, true).tiers.map((tier) => [
          tier.items[0].rarity,
          tier.weight,
        ]),
      );
      return {
        id,
        label,
        count: entries.length,
        totalWeight,
        bonusWeights,
        drawCount: drawCounts.get(id) ?? 0,
      };
    });
    return {
      wallet: this.wallet(userId),
      epicTenAvailable: this.hasEvent(epicClaimEvent(userId)) && !this.hasEvent(epicEvent(userId)),
      voucherAvailable:
        this.hasEvent(voucherEvent('claim', userId)) && !this.hasEvent(voucherEvent('use', userId)),
      pools,
      items: catalog.map((i) => ({
        ...publicItem(i),
        weight: odds.weights[i.rarity],
        owned: owned[i.kind].has(i.id),
      })),
      odds: { weights: odds.weights, revision: odds.revision },
      rules: {
        singleCost: 100,
        tenCost: 1000,
        dailyCoins: economy.dailyCoins,
        dailyLoginBonuses: economy.dailyLoginBonuses,
        matchCoins: economy.matchCoins,
        winnerCoins: economy.winnerCoins,
        bonusInterval: economy.bonusInterval,
        noPullPity: false,
      },
    };
  }
  odds() {
    return Odds.read(this.db);
  }
  setOdds(actorId, input) {
    return transaction(this.db, () => Odds.save(this.db, actorId, input, this.at()));
  }
  request(userId, requestId, operation, payload, run, onCreated) {
    if (typeof requestId !== 'string' || !UUID.test(requestId))
      throw new HttpError(400, 'INVALID_GACHA_REQUEST', '抽卡操作識別碼不正確');
    const fingerprint = hash({ operation, ...payload });
    let created = false;
    const receipt = transaction(this.db, () => {
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
      created = true;
      return result;
    });
    if (created) onCreated?.(receipt);
    return receipt;
  }
  draw(userId, input = {}, onCreated) {
    if (
      !input ||
      typeof input !== 'object' ||
      Array.isArray(input) ||
      Object.keys(input).some(
        (k) => !['requestId', 'pool', 'count', 'oddsRevision', 'voucher', 'thirdLogin'].includes(k),
      )
    )
      throw new HttpError(400, 'INVALID_GACHA_DRAW', '抽卡操作內容不正確');
    const { requestId, pool, count, oddsRevision, voucher, thirdLogin } = input;
    if (
      oddsRevision !== undefined &&
      (typeof oddsRevision !== 'string' || !/^[a-f0-9]{64}$/.test(oddsRevision))
    )
      throw new HttpError(400, 'INVALID_GACHA_DRAW', '抽卡機率版本格式不正確');
    const entries = poolItems(pool);
    if (
      !entries?.length ||
      ![1, 10].includes(count) ||
      (voucher !== undefined && (voucher !== true || count !== 1)) ||
      (thirdLogin !== undefined &&
        (thirdLogin !== true || count !== 10 || voucher || pool !== 'all'))
    )
      throw new HttpError(400, 'INVALID_GACHA_DRAW', '請選擇有效卡池及單抽或十連');
    const eligible = voucher ? entries.filter((item) => item.rarity === 'legendary') : entries;
    if (!eligible.length) throw new HttpError(400, 'INVALID_GACHA_DRAW', '這個卡池沒有傳說獎品');
    return this.request(
      userId,
      requestId,
      'draw',
      {
        pool,
        count,
        ...(voucher ? { voucher: true } : {}),
        ...(thirdLogin ? { thirdLogin: true } : {}),
      },
      (at, fingerprint) => {
        // A receipt replay precedes this check: a changed configuration must never reroll an old purchase.
        const odds = Odds.read(this.db);
        if (oddsRevision !== undefined && oddsRevision !== odds.revision)
          throw new HttpError(409, 'GACHA_ODDS_CHANGED', '卡池機率已更新，請重新載入確認後再抽取');
        if (thirdLogin) {
          if (!this.hasEvent(epicClaimEvent(userId)) || this.hasEvent(epicEvent(userId)))
            throw new HttpError(409, 'GACHA_EPIC_TEN_UNAVAILABLE', '登入十連獎勵已領取或尚未解鎖');
          this.ledger(epicEvent(userId), userId, 'login', 0, 0, hash({ requestId }), at);
        }
        if (voucher) {
          const event = voucherEvent('use', userId);
          if (!this.hasEvent(voucherEvent('claim', userId)) || this.hasEvent(event))
            throw new HttpError(409, 'GACHA_VOUCHER_REQUIRED', '沒有可用的傳說單抽券');
          this.ledger(event, userId, 'login', 0, 0, hash({ requestId }), at);
        }
        const distribution = Odds.distribution(eligible, odds.weights);
        const wallet = this.wallet(userId),
          cost = voucher || thirdLogin ? 0 : count * 100;
        if (wallet.coins < cost) throw new HttpError(409, 'GACHA_COINS_REQUIRED', '聖潔石不足');
        const previousDraws = this.drawCounts(userId).get(pool) ?? 0;
        const owned = this.owned(userId),
          results = [];
        let fragments = 0;
        for (let n = 0; n < count; n++) {
          const boosted =
            !voucher && !thirdLogin && (previousDraws + n + 1) % economy.bonusInterval === 0;
          const item = Odds.select(
            thirdLogin && n === 9
              ? Odds.distribution(
                  entries.filter((e) => e.rarity === 'epic'),
                  odds.weights,
                )
              : boosted
                ? Odds.distribution(entries, odds.weights, true)
                : distribution,
            this.choose,
          );
          const duplicate = owned[item.kind].has(item.id);
          const gained = duplicate ? item.duplicateFragments : 0;
          fragments += gained;
          if (!duplicate) {
            this.db
              .prepare(
                "INSERT INTO gacha_ownership(user_id,kind,reward_id,source,acquired_at) VALUES(?,?,?,'draw',?) ON CONFLICT(user_id,kind,reward_id) DO UPDATE SET source=excluded.source, acquired_at=excluded.acquired_at WHERE gacha_ownership.source='legacy'",
              )
              .run(userId, item.kind, item.id, at);
            owned[item.kind].add(item.id);
          }
          results.push({
            ...publicItem(item),
            weight: odds.weights[item.rarity],
            duplicate,
            fragments: gained,
          });
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
          drawCount: previousDraws + (voucher || thirdLogin ? 0 : count),
          ...(voucher ? { voucher: true } : {}),
          ...(thirdLogin ? { thirdLogin: true } : {}),
          oddsRevision: odds.revision,
          fragmentsGained: fragments,
          wallet: this.wallet(userId),
          at,
        };
      },
      onCreated,
    );
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
          "INSERT INTO gacha_ownership(user_id,kind,reward_id,source,acquired_at) VALUES(?,?,?,'exchange',?) ON CONFLICT(user_id,kind,reward_id) DO UPDATE SET source=excluded.source, acquired_at=excluded.acquired_at WHERE gacha_ownership.source='legacy'",
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
        const coins = economy.matchCoins + (p.winner ? economy.winnerCoins : 0);
        if (this.ledger(matchEvent(facts, p.userId), p.userId, 'match', coins, 0, fingerprint, at))
          awards.push({ userId: p.userId, coins });
      }
      return awards;
    });
  }
  matchReward(facts, userId) {
    const participant = facts.participants.find((entry) => entry.userId === userId);
    if (!participant) return null;
    const row = this.db
      .prepare(
        "SELECT coins_delta AS coins FROM gacha_ledger WHERE event_id=? AND user_id=? AND reason='match'",
      )
      .get(matchEvent(facts, userId), userId);
    const coins = row?.coins ?? 0;
    return { id: facts.id, coins, winner: participant.winner === true };
  }
}
module.exports = { GachaStore, taipeiDay };
