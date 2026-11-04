'use strict';
const { PartyRoom } = require('./party-base');
const { fail } = require('../coc/util');
class CocRoom extends PartyRoom {
  constructor(code, name = '克蘇魯的呼喚', rng, now) {
    super('coc', code, name, 4, 1, rng, now);
    this.options = {};
  }
  add(name, bot = false) {
    if (bot) fail('COC_HUMANS_ONLY', '本遊戲由真人扮演調查者，AI 只擔任主持人', 400);
    if (this.phase !== 'waiting')
      fail('COC_ORIGINAL_MEMBERS', '冒險開始後，請由原參與者從存檔恢復');
    return super.add(name, false);
  }
  start() {
    return this.cocStart();
  }
  act(id, action, data) {
    if (!this.player(id)) fail('NOT_SEATED', '尚未入座', 403);
    return this.cocAct(id, action, data);
  }
  kick(id, target, leaving = false) {
    if (id !== this.host && !leaving) fail('HOST_ONLY', '只有房主可以移除席位', 403);
    const p = this.player(target);
    if (!p) fail('PLAYER_NOT_FOUND', '找不到玩家', 404);
    p.kicked = true;
    if (this.host === target) this.host = this.activePlayers()[0]?.id || null;
    this.cocLeave(target, leaving);
    this.event('leave', p.name + ' 離席；冒險進度已保存並暫停。');
  }
  view(id) {
    const base = this.baseView(id),
      state = this.cocView(id);
    return { ...base, ...state };
  }
}
module.exports = { CocRoom };
