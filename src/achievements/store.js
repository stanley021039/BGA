const { transaction } = require('../db');
const { randomUUID, createHash } = require('node:crypto');
const { HttpError } = require('../http/errors');
const { definitions } = require('./catalog');
const {
  normalizeUnit,
  fingerprintUnit,
  effectiveParticipants,
  participantAwards,
  validateAchievementUnitsDatabase,
  UUID,
} = require('./units');
const legacyUnits = new WeakMap(),
  legacyMatches = new WeakMap();
function eventIdFor(match, game, number) {
  const h = createHash('sha256').update(`${match}:${game}:${number}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

class AchievementStore {
  constructor(db) {
    this.db = db;
    this.processed = new WeakSet();
    this.insert = db.prepare(
      'INSERT OR IGNORE INTO user_achievements(user_id,achievement_id,source_key,unlocked_at) VALUES(?,?,?,?)',
    );
    this.find = db.prepare(
      'SELECT achievement_id,unlocked_at FROM user_achievements WHERE user_id=?',
    );
    this.receipt = db.prepare(
      'SELECT fingerprint FROM processed_unit_events WHERE unit_event_id=?',
    );
    this.unitIdentity = db.prepare(
      'SELECT unit_event_id FROM processed_unit_events WHERE match_id=? AND game_type=? AND unit=? AND unit_number=?',
    );
    this.insertUnit = db.prepare(
      'INSERT INTO processed_unit_events(unit_event_id,match_id,game_type,unit,unit_number,status,completed_at,purpose,source,rule_version,fingerprint,facts_json) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',
    );
    this.progress = db.prepare(
      "INSERT OR IGNORE INTO achievement_progress(user_id,achievement_id,rule_version,game_type,first_unit_event_id,first_completed_at) VALUES(?,'all-two-tables',1,?,?,?)",
    );
    this.progressCount = db.prepare(
      "SELECT COUNT(*) AS n FROM achievement_progress WHERE user_id=? AND achievement_id='all-two-tables' AND rule_version=1",
    );
  }
  list(userId) {
    const extras = require('./reward-store'),
      counts = transaction(this.db, () => extras.refreshMilestones(this, userId));
    const unlocked = new Map(
      this.find.all(userId).map((row) => [row.achievement_id, row.unlocked_at]),
    );
    return {
      achievements: definitions.map((item) => ({
        ...item,
        unlockedAt: unlocked.get(item.id) || null,
        progress:
          item.id.endsWith('-regular') || item.id.endsWith('-veteran')
            ? { current: counts[item.game] || 0, target: item.id.endsWith('-regular') ? 3 : 10 }
            : null,
      })),
      rewards: extras.rewardList(this, userId),
    };
  }
  claim(userId, frameId) {
    return require('./reward-store').claimReward(this, userId, frameId);
  }
  assertFrame(userId, id) {
    return require('./reward-store').assertFrame(this, userId, id);
  }
  recordMatch(result, context = {}) {
    return require('./reward-store').recordMatch(this, {
      ...result,
      purpose: context.purpose || 'production',
    });
  }
  firstTable(userId, sourceKey, at) {
    this.insert.run(userId, 'all-first-table', sourceKey, at);
  }
  processUnit(envelope) {
    return this.recordUnit(normalizeUnit(envelope));
  }
  recordUnit(unit) {
    unit = normalizeUnit(unit, { legacy: ['poker', 'thunder'].includes(unit.game_type) });
    const fingerprint = fingerprintUnit(unit),
      facts = JSON.stringify(unit),
      awards = [];
    if (facts.length > 131072)
      throw new HttpError(400, 'INVALID_ACHIEVEMENT_UNIT', '遊玩結算資料過大');
    return transaction(this.db, () => {
      const old = this.receipt.get(unit.unit_event_id);
      if (old) {
        if (old.fingerprint !== fingerprint)
          throw new HttpError(409, 'UNIT_EVENT_CONFLICT', '遊玩結算識別碼的內容不一致');
        return { unit_event_id: unit.unit_event_id, duplicate: true, awards: [] };
      }
      if (this.unitIdentity.get(unit.match_id, unit.game_type, unit.unit, unit.round))
        throw new HttpError(409, 'UNIT_EVENT_CONFLICT', '同一遊玩單位已有其他結算識別碼');
      const users = new Map();
      for (const p of unit.participants) {
        const user = this.db.prepare('SELECT id,disabled FROM users WHERE id=?').get(p.user_id);
        if (!user) throw new HttpError(400, 'INVALID_ACHIEVEMENT_UNIT', '遊玩結算帳號不存在');
        users.set(p.user_id, user);
      }
      this.insertUnit.run(
        unit.unit_event_id,
        unit.match_id,
        unit.game_type,
        unit.unit,
        unit.round,
        unit.status,
        unit.completed_at,
        unit.purpose,
        unit.source,
        unit.rule_version,
        fingerprint,
        facts,
      );
      for (const p of effectiveParticipants(unit)) {
        if (users.get(p.user_id).disabled) continue;
        this.progress.run(p.user_id, unit.game_type, unit.unit_event_id, unit.completed_at);
        const ids = participantAwards(unit, p);
        if (this.progressCount.get(p.user_id).n >= 2) ids.push('all-two-tables');
        for (const id of ids)
          if (
            this.insert.run(p.user_id, id, 'unit:' + unit.unit_event_id, unit.completed_at).changes
          )
            awards.push({ user_id: p.user_id, achievement_id: id });
        require('./reward-store').refreshMilestones(this, p.user_id, unit.completed_at);
      }
      return { unit_event_id: unit.unit_event_id, duplicate: false, awards };
    });
  }
  legacyUnit(room, seats, game, result, context = {}) {
    if (legacyUnits.has(result)) return legacyUnits.get(result);
    const key = game === 'thunder' ? result : room;
    let match = room.achievementMatchId;
    if (match !== undefined && !UUID.test(match))
      throw new HttpError(400, 'INVALID_ACHIEVEMENT_UNIT', '缺少有效的對局識別碼');
    if (!match) {
      if (!legacyMatches.has(key)) legacyMatches.set(key, randomUUID());
      match = legacyMatches.get(key);
    }
    const participants = [];
    for (const [user_id, seat_id] of seats || []) {
      const player =
        game === 'poker' ? room.players.find((p) => p.id === seat_id) : room.player(seat_id);
      const challenges = [];
      if (
        game === 'poker' &&
        player &&
        !player.folded &&
        player.cards?.length === 2 &&
        room.board?.length === 5 &&
        require('../games/poker').evaluate([...player.cards, ...room.board])[0] >= 4
      )
        challenges.push('poker-showdown-straight');
      if (game === 'thunder' && room.winner?.id === seat_id) challenges.push('thunder-race-winner');
      participants.push({
        user_id,
        seat_id,
        ...(challenges.length ? { challenges } : {}),
        eligible:
          !!player &&
          !player.kicked &&
          !player.bot &&
          !!(game === 'poker' ? player.handDecision : player.completedHumanTurn),
      });
    }
    const number = game === 'poker' ? room.hand : 1;
    const unit = normalizeUnit(
      {
        unit_event_id: eventIdFor(match, game, number),
        match_id: match,
        game_type: game,
        unit: game === 'poker' ? 'hand' : 'race',
        round: number,
        status: 'rules_completed',
        completed_at: new Date().toISOString(),
        purpose: context.purpose ?? room.achievementPurpose ?? 'production',
        participants,
        metrics: { participantCount: participants.length },
      },
      { legacy: true },
    );
    legacyUnits.set(result, unit);
    return unit;
  }
  awardQuacksFinish(room, context = {}) {
    const result = room.quacksAchievements?.completed,
      purpose = context.purpose ?? room.achievementPurpose ?? 'production';
    if (
      room.type !== 'quacks' ||
      room.phase !== 'finished' ||
      room.interrupted ||
      !room.winner ||
      !result ||
      purpose !== 'production' ||
      this.processed.has(result)
    )
      return [];
    return this.recordQuacksResult(result, { purpose });
  }
  recordQuacksResult(result, { purpose = 'production' } = {}) {
    if (purpose !== 'production' || this.processed.has(result)) return [];
    const awards = [];
    transaction(this.db, () => {
      for (const p of result.participants) {
        if (
          !p.eligible ||
          !this.db.prepare('SELECT id FROM users WHERE id=? AND disabled=0').get(p.user_id)
        )
          continue;
        const ids = ['quacks-first-match', 'all-first-table'];
        for (const [flag, id] of [
          ['winner', 'quacks-winner'],
          ['noExplosion', 'quacks-no-explosion'],
          ['threeWitches', 'quacks-three-witches'],
          ['fiftyPoints', 'quacks-fifty-points'],
        ])
          if (p[flag]) ids.push(id);
        for (const id of ids)
          if (this.insert.run(p.user_id, id, 'quacks:' + result.id, result.completed_at).changes)
            awards.push({ user_id: p.user_id, achievement_id: id });
      }
    });
    this.recordMatch({ ...result, game: 'quacks' }, { purpose });
    this.processed.add(result);
    return awards;
  }
  awardGiftRound(room, seats) {
    if (
      room.type !== 'gift' ||
      !room.result ||
      !['reveal', 'finished'].includes(room.phase) ||
      this.processed.has(room.result)
    )
      return [];
    const active = new Set(room.activePlayers().map((player) => player.id));
    const unlocked = [],
      sourceKey = `gift:${room.code}:round:${room.result.round}:event:${room.version}`,
      at = new Date().toISOString();
    transaction(this.db, () => {
      for (const [userId, playerId] of seats || []) {
        if (
          !active.has(playerId) ||
          !Object.hasOwn(room.result.assignments, playerId) ||
          !Object.hasOwn(room.result.rankings, playerId)
        )
          continue;
        if (this.insert.run(userId, 'gift-first-gift', sourceKey, at).changes)
          unlocked.push(userId);
        this.firstTable(userId, sourceKey, at);
      }
    });
    this.processed.add(room.result);
    return unlocked;
  }
  awardMajorityRound(room, seats) {
    if (
      room.type !== 'majority' ||
      !room.result ||
      !['reveal', 'finished'].includes(room.phase) ||
      this.processed.has(room.result)
    )
      return [];
    const active = new Set(room.activePlayers().map((player) => player.id));
    const unlocked = [],
      sourceKey = `majority:${room.code}:round:${room.result.round}:event:${room.version}`,
      at = new Date().toISOString();
    transaction(this.db, () => {
      for (const [userId, playerId] of seats || []) {
        if (
          !active.has(playerId) ||
          !room.participantIds.includes(playerId) ||
          !Object.hasOwn(room.result.answers, playerId)
        )
          continue;
        if (this.insert.run(userId, 'majority-first-vote', sourceKey, at).changes)
          unlocked.push(userId);
        this.firstTable(userId, sourceKey, at);
      }
    });
    this.processed.add(room.result);
    return unlocked;
  }
  awardPokerHand(room, seats, context = {}) {
    if (
      room.type ||
      room.phase !== 'showdown' ||
      !room.hand ||
      !room.results?.length ||
      this.processed.has(room.results)
    )
      return [];
    const result = this.recordUnit(this.legacyUnit(room, seats, 'poker', room.results, context)),
      unlocked = result.awards
        .filter((a) => a.achievement_id === 'poker-first-hand')
        .map((a) => a.user_id);
    this.processed.add(room.results);
    return unlocked;
  }
  awardRaceFinish(room, seats, context = {}) {
    if (
      room.type !== 'thunder' ||
      room.phase !== 'finished' ||
      !room.winner ||
      this.processed.has(room.winner)
    )
      return [];
    const result = this.recordUnit(this.legacyUnit(room, seats, 'thunder', room.winner, context)),
      unlocked = result.awards
        .filter((a) => a.achievement_id === 'thunder-first-drive')
        .map((a) => a.user_id);
    this.processed.add(room.winner);
    return unlocked;
  }
}

module.exports = { AchievementStore, definitions, validateAchievementUnitsDatabase };
