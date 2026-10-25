'use strict';
const { PartyRoom, fail } = require('./party-base');
// 場外休憩區 (#277): a non-game room for shared media, chat and backgrounds.
// It never starts a match, so it stays joinable in the waiting phase.
class LoungeRoom extends PartyRoom {
  constructor(code, name, rng, now) {
    super('lounge', code, name, 10, 1, rng, now);
  }
  start() {
    fail('NO_MATCH', '場外休憩區沒有遊戲流程', 400);
  }
  act() {
    fail('INVALID_ACTION', '場外休憩區沒有遊戲操作', 400);
  }
  auto() {}
  view(id) {
    return this.baseView(id);
  }
}
module.exports = { LoungeRoom };
