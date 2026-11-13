const { HttpError } = require('../http/errors');
const { botSettings } = require('./scene-bots');

function createTrainingGrounds(factory, now = Date.now) {
  const sessions = new Map();
  function get(user) {
    const time = now();
    for (const [id, session] of sessions)
      if (time - session.seenAt > 10 * 60000) sessions.delete(id);
    if (!sessions.has(user.id)) {
      if (sessions.size >= 32)
        throw new HttpError(503, 'TRAINING_FULL', '訓練場使用中，請稍後再試');
      sessions.set(user.id, { ...factory(user), seenAt: time });
    }
    const session = sessions.get(user.id);
    session.seenAt = time;
    return session;
  }
  function configure(user, input) {
    if (input?.action === 'close') {
      sessions.delete(user.id);
      return { closed: true };
    }
    const session = get(user);
    if (input?.action === 'settings') {
      const settings = botSettings({ ...input, action: 'update' }, session.characters);
      Object.assign(session.settings, settings);
    } else if (!['reset', 'replay', 'refill'].includes(input?.action))
      throw new HttpError(400, 'INVALID_TRAINING', '訓練操作不正確');
    return session.lobby.training(user, input.action, session.settings.entrance);
  }
  return { get, configure, clear: () => sessions.clear() };
}
module.exports = { createTrainingGrounds };
