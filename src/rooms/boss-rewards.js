const { randomBytes } = require('node:crypto');
const { builtinFrameDescriptor } = require('../barrage/builtins');
function createBossRewards(visitors, bots, publish) {
  return function onKill(from, to, time) {
    if (!bots.get(to.id)?.bossId) return;
    const killer = visitors.get(from.id);
    // A boss is a neutral PvE objective, not a PvP kill or an achievement unit.
    const eligible =
      killer?.health > 0 &&
      !bots.has(killer.id) &&
      (!from.energyLifeId || from.energyLifeId === killer.lifeId);
    if (eligible) {
      killer.bossBlessingUntil = time + 15000;
      killer.health = Math.min(
        killer.maxHealth,
        killer.health + Math.round(killer.maxHealth * 0.1),
      );
    }
    publish({
      id: randomBytes(12).toString('hex'),
      kind: 'barrage',
      playerId: from.id,
      name: from.name || killer?.name || '挑戰者',
      message: (
        (from.name || killer?.name || '挑戰者') +
        ' 擊倒 ' +
        to.name +
        (eligible ? '，獲得獵王祝福！' : '！')
      ).slice(0, 160),
      frame: builtinFrameDescriptor(),
      at: time,
    });
  };
}
module.exports = { createBossRewards };
