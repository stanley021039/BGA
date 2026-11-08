'use strict';
const { createStateStream } = require('../rooms/state-stream');

function createGachaAnnouncements(valid, { fallbackMs = 12000 } = {}) {
  const channel = { code: '__GACHA_ANNOUNCEMENTS__' };
  const stream = createStateStream({ valid, roomLimit: 1500 });
  const pending = new Map();
  const keyFor = (userId, requestId) => userId + ':' + requestId;

  function release(userId, requestId, { fallback = false } = {}) {
    const key = keyFor(userId, requestId);
    const entry = pending.get(key);
    if (!entry) return;
    pending.delete(key);
    clearTimeout(entry.timer);
    stream.publish(channel.code, 'legendary', entry.message, {
      excludeUserId: fallback ? userId : undefined,
    });
  }
  function stage(user, receipt) {
    const prizes = new Map();
    for (const item of receipt.results) {
      if (item.rarity !== 'legendary') continue;
      const prize = prizes.get(item.key);
      if (prize) prize.count++;
      else prizes.set(item.key, { label: item.label, count: 1 });
    }
    if (!prizes.size || pending.size >= 2048) return;
    const timer = setTimeout(
      () => release(user.id, receipt.requestId, { fallback: true }),
      fallbackMs,
    );
    timer.unref();
    pending.set(keyFor(user.id, receipt.requestId), {
      timer,
      message: { name: user.display_name, prizes: [...prizes.values()] },
    });
  }
  return {
    stage,
    release,
    hide(userId, requestId) {
      const key = keyFor(userId, requestId);
      clearTimeout(pending.get(key)?.timer);
      pending.delete(key);
    },
    subscribe: (entry) => stream.subscribe(channel, entry),
    close() {
      for (const { timer } of pending.values()) clearTimeout(timer);
      pending.clear();
      stream.close();
    },
  };
}

module.exports = { createGachaAnnouncements };
