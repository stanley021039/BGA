'use strict';

const { randomUUID } = require('node:crypto');
const { PartyRoom, fail } = require('./party-base');
const { CeoGame } = require('./ceo');
const { provisionalCatalog } = require('./ceo-catalog');

class CeoRoom extends PartyRoom {
  #game = null;
  #participants = new Set();

  constructor(code, name, rng, now) {
    super('ceo', code, name, 6, 3, rng, now);
  }

  start() {
    if (!['waiting', 'finished'].includes(this.phase)) fail('MATCH_STARTED', '遊戲已開始');
    if (this.activePlayers().length < this.min) fail('NEED_PLAYERS', '至少 3 人', 400);
    const next = new CeoGame({
      playerIds: this.activePlayers().map((player) => player.id),
      catalog: provisionalCatalog(),
      rng: this.rng,
    });
    this.prepare();
    this.#game = next;
    this.#participants = new Set(this.players.map((player) => player.id));
    this.roundId = randomUUID();
    this.phase = 'playing';
    this.round = 1;
    this.event('start', '王牌執行長開局；本局使用本站暫用替代牌庫。');
  }

  act(id, action, data = {}) {
    return this.command(id, action, data, () => {
      if (this.phase !== 'playing' || !this.#game) fail('INVALID_PHASE', '目前不能操作');
      const state = this.#game.act(
        id,
        {
          type: action,
          companyId: data.companyId,
          issuerId: data.issuerId,
        },
        data.expectedRevision,
      );
      this.round = state.round;
      this.event(
        action,
        this.player(id).name +
          ' 完成' +
          { acquire: '收購公司', buyStock: '購買股票', dividend: '發放股利' }[action],
      );
      if (state.phase === 'finished') {
        this.results = [state.results];
        for (const player of this.players) {
          player.score = state.results.players.find(
            (result) => result.playerId === player.id,
          ).total;
        }
        this.finish();
      }
    });
  }

  view(id) {
    const base = this.baseView(id);
    return {
      ...base,
      catalogStatus: 'provisional',
      catalogNotice: '本站暫用替代牌庫；公司內容與原版不同。',
      game:
        this.#game && this.#participants.has(id) && !this.interrupted ? this.#game.view(id) : null,
    };
  }
  observerGame() {
    return this.phase !== 'waiting' && this.#game && !this.interrupted
      ? this.#game.observerView()
      : null;
  }
}

module.exports = { CeoRoom };
