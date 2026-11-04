'use strict';
const { HttpError } = require('../http/errors');
// Separate, bounded adapter registry. No app database, rewards or real visitors.
const adapters = Object.freeze({ 'lobby-pvp': createPractice });
function createPractice() {
  let clock = 1000,
    step = 0;
  const self = { id: 'practice-self', display_name: '你' };
  const bot = { id: 'practice-opponent', display_name: '練習對手' };
  const lobby = require('../rooms/lobby').createLobby(
    () => clock,
    () => '',
    () => 0.5,
  );
  const refresh = () => {
    lobby.view(bot);
    return lobby.view(self);
  };
  function advance(ms) {
    const end = clock + ms;
    while (clock < end) {
      clock = Math.min(end, clock + 5000);
      refresh();
    }
  }
  refresh();
  lobby.move(self, { x: 14, y: 85 });
  lobby.move(bot, { x: 27, y: 85 });
  advance(7000);
  function next() {
    if (step === 0) {
      lobby.arena(self, { action: 'team', team: 'red' });
      lobby.arena(bot, { action: 'team', team: 'blue' });
      lobby.arena(self, { action: 'start', mode: 'pk', matchId: null });
      lobby.move(self, { x: 18, y: 84 });
      lobby.move(bot, { x: 18, y: 93 });
      advance(7000);
    } else if (step === 1 || step === 3) {
      lobby.attack(self, {
        requestId: 'practice-attack-' + step,
        aspectRatio: 1,
        effect: 'barrage',
        slot: 'q',
      });
      advance(2200);
    } else if (step === 2) {
      lobby.move(self, { x: 27, y: 93 });
      advance(3000);
    } else if (step === 4) {
      const match = refresh().arena.match;
      advance(Math.max(0, match.endsAt - clock) + 1);
    }
    step = Math.min(5, step + 1);
  }
  function state() {
    const view = refresh();
    return {
      adapter: 'lobby-pvp',
      step,
      arena: view.arena,
      visitors: view.visitors.map(({ id, name, x, y, health }) => ({ id, name, x, y, health })),
    };
  }
  return { next, state };
}
function createLobbyPractice(now = Date.now) {
  const sessions = new Map();
  function command(user, data) {
    for (const [id, session] of sessions) if (now() - session.at > 30 * 60000) sessions.delete(id);
    if (
      !data ||
      !['start', 'next', 'close'].includes(data.action) ||
      Object.keys(data).some((k) => !['action', 'step'].includes(k))
    )
      throw new HttpError(400, 'INVALID_PRACTICE', '教學操作不正確');
    if (data.action === 'close') {
      sessions.delete(user.id);
      return { closed: true };
    }
    if (data.action === 'start') {
      if (!sessions.has(user.id) && sessions.size >= 32)
        throw new HttpError(503, 'PRACTICE_FULL', '教學使用中，請稍後再試');
      sessions.set(user.id, { at: now(), runtime: adapters['lobby-pvp']() });
    }
    const session = sessions.get(user.id);
    if (!session) throw new HttpError(404, 'PRACTICE_EXPIRED', '教學已結束，請重新開始');
    if (data.action === 'next') {
      if (data.step !== session.runtime.state().step)
        throw new HttpError(409, 'PRACTICE_CHANGED', '教學步驟已更新');
      session.runtime.next();
    }
    session.at = now();
    return session.runtime.state();
  }
  return { command, clear: () => sessions.clear() };
}
module.exports = { createLobbyPractice, adapters };
