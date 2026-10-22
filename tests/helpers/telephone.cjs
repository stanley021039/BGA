const { randomUUID } = require('node:crypto');

// Existing drawing/guessing fixtures must enter those phases through the new
// public topic-submission flow rather than mutating the engine's phase.
function completeTelephoneTopics(
  room,
  commit = (player, data) => room.act(player.id, 'submit', data),
) {
  if (room.phase !== 'prompting') return;
  for (const player of room.activePlayers())
    commit(player, {
      stepId: room.stepId,
      requestId: randomUUID(),
      text: player.name + '的主題',
    });
}
module.exports = { completeTelephoneTopics };
