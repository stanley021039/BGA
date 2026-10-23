'use strict';
const { HttpError } = require('./errors');

// One factory per app. HTTP matching, parsing, authentication and response/error
// serialization remain in app.js; the lobby retains its own presence/cooldown rules.
function createLobbyHandlers({
  assertFrame = () => {},
  entranceAllowed = () => true,
  backgroundAllowed = () => true,
  lobby,
  withLobbyMedia,
  lobbyCharacter,
  expressionLabels,
  characterMedia,
}) {
  function view(user, entrance) {
    if (!entranceAllowed(user, entrance)) entrance = 'classic';
    return withLobbyMedia(user, lobby.view(user, { entrance }));
  }
  function move(user, data) {
    return withLobbyMedia(user, lobby.move(user, data));
  }
  function attack(user, data) {
    return withLobbyMedia(user, lobby.attack(user, data));
  }
  function teleport(user, data) {
    const entrance = entranceAllowed(user, data?.entrance) ? data?.entrance : 'classic';
    return withLobbyMedia(user, lobby.teleport(user, entrance));
  }
  function emotes(user) {
    const character = lobbyCharacter(user);
    return {
      emotes: Object.entries(character.expressions)
        .filter(([key]) => key !== 'neutral')
        .map(([expression, image]) => ({
          expression,
          image,
          label: character.labels[expression] || expressionLabels[expression] || expression,
          ...(character.sounds?.[expression] ? { sound: character.sounds[expression] } : {}),
        })),
    };
  }
  function emote(user, data) {
    const character = lobbyCharacter(user),
      expression = data.expression;
    if (
      typeof expression !== 'string' ||
      expression === 'neutral' ||
      !Object.hasOwn(character.expressions, expression)
    )
      throw new HttpError(400, 'INVALID_EXPRESSION', '這個角色沒有該表情');
    const sound = character.sounds?.[expression];
    return withLobbyMedia(
      user,
      lobby.emote(user, {
        image: characterMedia.broadcastImage(character.expressions[expression]),
        label: character.labels[expression] || expressionLabels[expression] || expression,
        ...(sound ? { sound: { ...sound, url: characterMedia.broadcastSound(sound.url) } } : {}),
      }),
    );
  }
  function barrage(user, data) {
    assertFrame(user, data.builtinFrameId);
    return withLobbyMedia(user, lobby.barrage(user, data));
  }
  function background(user, data) {
    if (!require('../../public/shared/lobby-backgrounds.json').some((item) => item.id === data?.id))
      throw new HttpError(400, 'INVALID_BACKGROUND', '請選擇可用的大廳背景');
    if (!backgroundAllowed(user, data?.id))
      throw new HttpError(403, 'BACKGROUND_LOCKED', '請先完成對應成就以解鎖這個背景');
    return withLobbyMedia(user, lobby.changeBackground(user, data));
  }
  return { view, move, emotes, emote, barrage, background, teleport, attack };
}
module.exports = { createLobbyHandlers };
