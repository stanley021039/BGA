'use strict';

const { randomUUID } = require('node:crypto');
const { planTutorialAction } = require('../ai');

function planPartyLesson(type, room, player) {
  const actor = player.id;
  const snapshot = room.view(actor);
  const operation = (action, input, roundId = snapshot.roundId) => ({
    actor,
    action,
    run: (table) => table.act(actor, action, { ...input, roundId, requestId: randomUUID() }),
  });
  if (type === 'oracle') {
    const { oracle } = snapshot;
    if (snapshot.phase === 'oracle-guessing' && oracle.turnId === actor) {
      // The tutor uses the answer key only to pick a plausible practice move.
      // The live view still hides the assignment until the normal reveal.
      const term =
        room.oracle.terms.find(
          (entry) => !entry.artist && !room.oracle.eliminated.includes(entry.id),
        ) ?? oracle.terms.find((entry) => !entry.eliminated);
      return operation('oracle-eliminate', { termId: term.id }, oracle.roundId);
    }
    return planTutorialAction(room, player);
  }
  if (type === 'brainwave' && snapshot.phase === 'drawing' && !snapshot.board.length) {
    return operation('shape', {
      shape: { kind: 'ellipse', x1: 0.25, y1: 0.25, x2: 0.65, y2: 0.65 },
    });
  }
  if (
    snapshot.phase === room.guessPhase &&
    snapshot.actorId !== actor &&
    !snapshot.myGuesses.length
  ) {
    // Include a correct and an incorrect guess so the scoring examples are visible.
    const answeredCorrectly = room.guesses.some(({ option }) => option === room.correct);
    const option = answeredCorrectly ? (room.correct + 1) % room.optionsCount : room.correct;
    return operation('guess', { option });
  }
  return planTutorialAction(room, player);
}

module.exports = { planPartyLesson };
