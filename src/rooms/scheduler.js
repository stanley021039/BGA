const { createRoomTransitions } = require('./transitions');
const { expireEmptyRooms, endRoomHistory } = require('./lifecycle');
const { runTestAIStep } = require('../ai');
function advanceTimedPhase(room, history) {
  const now = Date.now();
  let due = false;
  if (room.type === 'musicquiz')
    due =
      ['intro', 'timeline', 'challenge'].includes(room.phase) &&
      room.deadline != null &&
      now >= room.deadline;
  if (room.type === 'bluff')
    due = room.phase === 'preparing' && room.deadline != null && now >= room.deadline;
  if (room.type === 'quacks')
    due = room.phase === 'round-intro' && room.nextRoundAt != null && now >= room.nextRoundAt;
  if (room.type === 'telephone')
    due =
      ['prompting', 'passing'].includes(room.phase) &&
      room.deadline != null &&
      now >= room.deadline;
  if (room.type === 'minimal')
    due = room.phase === 'drawing' && room.deadline != null && now >= room.deadline;
  if (room.type === 'majority')
    due = room.phase === 'answering' && room.deadline != null && now >= room.deadline;
  if (room.type === 'draw') {
    const artist = room.player(room.presenterId);
    due =
      (room.deadline != null && now >= room.deadline) ||
      (['choosing', 'drawing'].includes(room.phase) &&
        artist &&
        !artist.bot &&
        now - artist.lastSeen > 15000);
  }
  if (!due) return false;
  try {
    history.transact(room, { action: 'auto', source: 'timeout' }, () => room.auto());
  } catch (e) {
    console.error(e);
  }
  return true;
}
function startRoomScheduler({
  rooms,
  history,
  onDelete = () => {},
  onDrawStroke = () => {},
  onTransition = () => {},
  onSweep = () => {},
  transitions = createRoomTransitions({ history, onTransition }),
}) {
  let emptyTimer, timer;
  try {
    emptyTimer = setInterval(() => expireEmptyRooms({ rooms, history, onDelete }), 400);
    emptyTimer.unref();
    timer = setInterval(() => {
      for (const [code, r] of rooms) {
        if (Date.now() - Math.max(...r.players.map((p) => p.lastSeen)) > 86400000) {
          endRoomHistory(history, r, '房間閒置逾 24 小時');
          rooms.delete(code);
          onDelete(code);
          continue;
        }
        if (history.isPaused?.(r)) continue;
        // Expired phases must advance before an AI attempts a now-illegal action.
        if (advanceTimedPhase(r, transitions)) continue;
        try {
          if (r.type !== 'thunder' && runTestAIStep(r, { history, transitions, onDrawStroke }))
            continue;
        } catch (e) {
          console.error('Test AI action failed:', e);
        }
        // The deadline can also pass during an AI action that throws.
        if (advanceTimedPhase(r, transitions)) continue;
        if (
          [
            'majority',
            'draw',
            'gift',
            'trpg',
            'telephone',
            'musicquiz',
            'minimal',
            'bluff',
            'quacks',
            'ceo',
          ].includes(r.type)
        )
          continue;
        if (r.type === 'thunder' && r.diceCheck?.status === 'rolling') {
          if (Date.now() >= r.diceCheck.readyAt)
            try {
              transitions.transact(
                r,
                { action: 'revealDice', source: 'timer', actor: r.actor() },
                () => r.advanceDice(Date.now()),
              );
            } catch (e) {
              console.error(e);
            }
          continue;
        }
        const p = r.type === 'thunder' ? r.player(r.actor()) : r.players[r.turn];
        if (!p || ['waiting', 'finished'].includes(r.phase)) continue;
        if ((p.bot && Date.now() > r.botAt) || Date.now() > r.deadline) {
          try {
            if (r.type === 'thunder') {
              transitions.transact(
                r,
                { action: 'auto', source: p.bot ? 'bot' : 'timeout', actor: p.id },
                () => r.auto(),
              );
              continue;
            }
            let due = r.currentBet - p.bet;
            let action = due === 0 ? 'check' : 'call';
            if (!p.bot) action = due === 0 ? 'check' : 'fold';
            else if (due > 150 && Math.random() < 0.4) action = 'fold';
            transitions.transact(
              r,
              { action, source: p.bot ? 'bot' : 'timeout', actor: p.id },
              () => r.act(p.id, action),
            );
          } catch (e) {
            console.error(e);
          }
        }
      }
      try {
        onSweep();
      } catch (error) {
        console.error(error);
      }
    }, 400);
    timer.unref();
    return () => {
      clearInterval(timer);
      clearInterval(emptyTimer);
    };
  } catch (error) {
    clearInterval(timer);
    clearInterval(emptyTimer);
    throw error;
  }
}
module.exports = { startRoomScheduler };
