'use strict';
const { randomUUID } = require('node:crypto');
const { UUID } = require('./units');
const TYPES = new Set(['musicquiz', 'bluff', 'minimal', 'telephone', 'trpg']);
function attachMatchAchievements(room) {
  if (!TYPES.has(room.type)) return;
  let current = null;
  const start = room.start,
    act = room.act;
  Object.defineProperty(room, 'matchAchievements', {
    value: {
      get completed() {
        return current?.completed || null;
      },
      finish() {
        if (
          !current ||
          current.completed ||
          room.phase !== 'finished' ||
          room.interrupted ||
          (!room.results?.length && room.type !== 'telephone')
        )
          return;
        if (room.type !== 'telephone' && !room.winner) return;
        const rounds = new Set((room.results || []).map((r) => r.round));
        const required =
          room.type === 'trpg'
            ? 6
            : room.type === 'telephone'
              ? room.roundLimit
              : room.type === 'bluff'
                ? room.roundLimit
                : 3;
        if (room.type !== 'telephone' && rounds.size < required) return;
        const participants = current.participants.map((p) => {
          const player = room.player(p.seat_id),
            set = current.decisions.get(p.seat_id) || new Set();
          const count =
            room.type === 'telephone' ? set.size : [...set].filter((r) => rounds.has(r)).length;
          const challenges = [...(current.challenges.get(p.seat_id) || [])];
          if (room.type === 'musicquiz') {
            let streak = 0;
            for (const r of room.results) {
              streak = r.answers?.some((a) => a.id === p.seat_id && a.titleCorrect)
                ? streak + 1
                : 0;
              if (streak >= 3 && !challenges.includes('musicquiz-intro-streak'))
                challenges.push('musicquiz-intro-streak');
              if (
                r.djId !== p.seat_id &&
                !r.djCorrect &&
                r.receiverId === p.seat_id &&
                !challenges.includes('musicquiz-rescue')
              )
                challenges.push('musicquiz-rescue');
            }
          }
          if (
            room.type === 'telephone' &&
            current.colors.has(p.seat_id) &&
            current.longText.has(p.seat_id)
          )
            challenges.push('telephone-color-relay');
          if (room.type === 'trpg' && (current.assists.get(p.seat_id)?.size || 0) >= 3)
            challenges.push('trpg-support-three');
          return {
            ...p,
            challenges,
            eligible: !!player && !player.bot && !player.kicked && count >= required,
          };
        });
        if (!participants.length) return;
        current.completed = Object.freeze({
          id: current.id,
          game: room.type,
          completed_at: new Date(room.now?.() || Date.now()).toISOString(),
          participants: Object.freeze(participants.map(Object.freeze)),
        });
      },
    },
  });
  Object.defineProperty(room, 'start', {
    value: function (...args) {
      const result = start.apply(this, args),
        id = randomUUID(),
        ids = this.activePlayers()
          .filter((p) => !p.bot)
          .map((p) => p.id),
        seen = new Set();
      const supplied =
        this.achievementUnitStart?.({
          match_id: id,
          game_type: this.type,
          unit: 'match',
          participantSeatIds: ids,
        }) || [];
      const participants = supplied
        .filter(
          (p) =>
            ids.includes(p.seat_id) &&
            UUID.test(p.user_id) &&
            !seen.has(p.user_id.toLowerCase()) &&
            (seen.add(p.user_id.toLowerCase()), true),
        )
        .map((p) => Object.freeze({ user_id: p.user_id, seat_id: p.seat_id }));
      current = {
        id,
        participants,
        decisions: new Map(),
        challenges: new Map(),
        colors: new Set(),
        longText: new Set(),
        assists: new Map(),
        completed: null,
      };
      return result;
    },
  });
  Object.defineProperty(room, 'act', {
    value: function (id, action, data = {}) {
      const round = this.round,
        stepId = this.stepId,
        p = this.player(id),
        targetRole = this.roles?.[data.targetId],
        artistId = this.order?.[this.shown],
        shapeCount = this.drafts?.[artistId]?.length,
        already =
          this.type === 'trpg'
            ? Object.hasOwn(this.plans || {}, id)
            : this.type === 'telephone'
              ? Object.hasOwn(this.submissions || {}, id)
              : false,
        result = act.call(this, id, action, data);
      const effective =
        this.type === 'musicquiz'
          ? (action === 'guess' && !!(data.choiceId || data.text?.trim() || data.artist?.trim())) ||
            ['place', 'challenge'].includes(action)
          : this.type === 'bluff'
            ? ['spoken', 'answer', 'guess', 'decide'].includes(action)
            : this.type === 'minimal'
              ? (action === 'submit' && data.shapes?.length > 0) || action === 'guess'
              : this.type === 'telephone'
                ? action === 'submit' && round > 0 && data.stepId === stepId
                : action === 'plan';
      if (current && p && !p.bot && effective) {
        if (!current.decisions.has(id)) current.decisions.set(id, new Set());
        current.decisions.get(id).add(round);
      }
      if (current && p && !p.bot) {
        const add = (seat, challenge) => {
          if (!current.challenges.has(seat)) current.challenges.set(seat, new Set());
          current.challenges.get(seat).add(challenge);
        };
        if (this.type === 'bluff' && action === 'guess') {
          if (targetRole === 'bluffer') add(data.targetId, 'bluff-convincing');
          if (targetRole === 'honest') add(id, 'bluff-lie-detector');
        }
        if (
          this.type === 'minimal' &&
          action === 'guess' &&
          shapeCount > 0 &&
          shapeCount <= 3 &&
          this.results.at(-1)?.round === round &&
          this.results.at(-1).attempts.at(-1)?.correct
        )
          add(artistId, 'minimal-three-shapes');
        if (this.type === 'telephone' && action === 'submit' && !already) {
          if (
            data.strokes &&
            new Set(
              data.strokes.filter((s) => s.tool !== 'erase').map((s) => s.color.toLowerCase()),
            ).size >= 3
          )
            current.colors.add(id);
          if (typeof data.text === 'string' && [...data.text.trim()].length >= 8)
            current.longText.add(id);
        }
        if (
          this.type === 'trpg' &&
          action === 'plan' &&
          !already &&
          data.stance === 'assist' &&
          [...(data.note || '').trim()].length >= 4
        ) {
          if (!current.assists.has(id)) current.assists.set(id, new Set());
          current.assists.get(id).add(round);
        }
      }
      return result;
    },
  });
}
module.exports = { attachMatchAchievements };
