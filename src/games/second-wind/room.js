'use strict';
const { randomUUID } = require('node:crypto');
const { PartyRoom, fail } = require('../party-base');
const { SecondWindGame } = require('./game');
const { racerSet } = require('./catalog');
const { assertCanManageSettings } = require('../../rooms/permissions');

class SecondWindRoom extends PartyRoom {
  #game = null;
  #participants = new Set();
  constructor(code, name, rng, now) {
    super('second-wind', code, name, 6, 3, rng, now);
    this.options = { racerSet: 'second-wind' };
  }
  configure(id, data = {}) {
    assertCanManageSettings(this, id);
    if (!['waiting', 'finished'].includes(this.phase))
      fail('MATCH_STARTED', '遊戲進行中不能更改牌庫');
    const selected = data.racerSet ?? this.options.racerSet;
    racerSet(selected);
    this.options = { racerSet: selected };
    this.event('settings', '已更新角色牌庫');
  }
  start() {
    if (!['waiting', 'finished'].includes(this.phase)) fail('MATCH_STARTED', '遊戲已開始');
    const next = new SecondWindGame({
      playerIds: this.activePlayers().map((p) => p.id),
      racerSet: this.options.racerSet,
    });
    this.prepare();
    this.#game = next;
    this.#participants = new Set(this.players.map((p) => p.id));
    this.roundId = randomUUID();
    this.phase = 'playing';
    this.round = 1;
    this.roundLimit = 4;
    this.event('start', '運動員 Second Wind 開始選秀；名次獎分使用已核准測試值。');
  }
  act(id, action, data = {}) {
    return this.command(id, action, data, () => {
      if (this.phase !== 'playing') fail('INVALID_PHASE', '目前不能操作');
      const state = this.#game.act(
        id,
        { type: action, racerId: data.racerId, choiceId: data.choiceId, value: data.value },
        data.expectedRevision,
      );
      this.round = state.race || 1;
      for (const player of this.players) player.score = state.scores?.[player.id] || 0;
      this.event(action, this.player(id).name + ' 完成操作');
      if (state.phase === 'finished') {
        this.results = state.results;
        this.finish();
      }
    });
  }
  view(id) {
    return {
      ...this.baseView(id),
      options: { ...this.options },
      game:
        this.#game && this.#participants.has(id) && !this.interrupted ? this.#game.view(id) : null,
    };
  }
}
module.exports = { SecondWindRoom };
