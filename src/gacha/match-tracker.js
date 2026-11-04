'use strict';
const { randomUUID } = require('node:crypto');
const MANAGEMENT = new Set([
  'start',
  'next',
  'restart',
  'reset',
  'settings',
  'configure',
  'kick',
  'ban',
  'card-frame',
  'emote',
  'ping',
  'chat',
]);
function winners(room) {
  const w = room.winner,
    type = room.type || 'poker';
  if (type === 'poker') return new Set((room.results || []).map((r) => r.playerId).filter(Boolean));
  if (type === 'trpg')
    return new Set(
      w?.restored ? (room.players || []).filter((p) => !p.kicked).map((p) => p.id) : [],
    );
  if (type === 'quacks' && Number.isFinite(w?.score)) {
    const tied = (room.players || []).filter((p) => p.score === w.score);
    const position = Math.max(...tied.map((p) => p.position));
    return new Set(tied.filter((p) => p.position === position).map((p) => p.id));
  }
  if (Array.isArray(w?.ids)) return new Set(w.ids);
  if (typeof w?.id === 'string') return new Set([w.id]);
  if (Number.isFinite(w?.score))
    return new Set((room.players || []).filter((p) => p.score === w.score).map((p) => p.id));
  return new Set();
}
function normalEnd(room) {
  if (room.interrupted) return false;
  const type = room.type || 'poker';
  if (type === 'poker')
    return room.phase === 'showdown' && room.hand > 0 && room.results?.length > 0;
  if (room.phase !== 'finished') return false;
  if (type === 'telephone') return room.round >= room.roundLimit && room.books?.length >= 2;
  if (type === 'trpg') return room.round >= 6 && typeof room.winner?.restored === 'boolean';
  if (type === 'quacks' && room.round < 9) return false;
  return winners(room).size > 0;
}
function attachGachaMatch(room, freezeParticipants, purpose = 'production') {
  if (room.gachaMatch) return;
  let current = null;
  const start = room.start;
  Object.defineProperty(room, 'gachaMatch', {
    value: {
      snapshot: () => current,
      restore(value) {
        current = value || null;
      },
      get acknowledged() {
        return current?.acknowledged === true;
      },
      acknowledge() {
        if (current) current.acknowledged = true;
      },
      humanAction(id, action, run) {
        const active = !['waiting', 'finished', 'showdown'].includes(room.phase);
        const result = run();
        if (
          current &&
          active &&
          !MANAGEMENT.has(action) &&
          current.participants.some((p) => p.seatId === id)
        )
          current.operated.add(id);
        return result;
      },
      finish() {
        if (!current || current.acknowledged) return null;
        if (current.completed) return current.completed;
        if (!normalEnd(room)) return null;
        const stillPresent = current.participants.filter((p) => {
          const actor = room.players.find((a) => a.id === p.seatId);
          return actor && !actor.bot && !actor.kicked;
        });
        if (stillPresent.length < 2) return null;
        const won = winners(room);
        current.completed = {
          id: current.id,
          game: room.type || 'poker',
          purpose,
          normalEnd: true,
          completedAt: new Date(room.now?.() ?? Date.now()).toISOString(),
          participants: stillPresent.map((p) => ({
            userId: p.userId,
            operated: current.operated.has(p.seatId),
            winner: won.has(p.seatId),
          })),
        };
        return current.completed;
      },
    },
  });
  Object.defineProperty(room, 'start', {
    configurable: true,
    writable: true,
    value: function (...args) {
      const result = start.apply(this, args),
        type = this.type || 'poker';
      const seats = this.players
        .filter((p) => !p.bot && !p.kicked && (type !== 'poker' || p.cards?.length === 2))
        .map((p) => p.id);
      const participants = freezeParticipants(this, seats).map((p) => ({
        userId: p.user_id,
        seatId: p.seat_id,
      }));
      current = {
        id: randomUUID(),
        participants,
        operated: new Set(),
        completed: null,
        acknowledged: false,
      };
      return result;
    },
  });
}
module.exports = { attachGachaMatch, normalEnd, winners };
