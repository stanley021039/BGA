'use strict';
const {HttpError}=require('./errors');

// One factory per app. HTTP matching, parsing, authentication and response/error
// serialization remain in app.js; the lobby retains its own presence/cooldown rules.
function createLobbyHandlers({lobby,withLobbyMedia,lobbyCharacter,expressionLabels,characterMedia}){
 function view(user){return withLobbyMedia(user,lobby.view(user));}
 function move(user,data){return withLobbyMedia(user,lobby.move(user,data));}
 function emotes(user){
  const character=lobbyCharacter(user);
  return {emotes:Object.entries(character.expressions).filter(([key])=>key!=='neutral').map(([expression,image])=>({expression,image,label:character.labels[expression]||expressionLabels[expression]||expression,...(character.sounds?.[expression]?{sound:character.sounds[expression]}:{})}))};
 }
 function emote(user,data){
  const character=lobbyCharacter(user),expression=data.expression;
  if(typeof expression!=='string'||expression==='neutral'||!Object.hasOwn(character.expressions,expression))throw new HttpError(400,'INVALID_EXPRESSION','這個角色沒有該表情');
  const sound=character.sounds?.[expression];
  return withLobbyMedia(user,lobby.emote(user,{image:characterMedia.broadcastImage(character.expressions[expression]),label:character.labels[expression]||expressionLabels[expression]||expression,...(sound?{sound:{...sound,url:characterMedia.broadcastSound(sound.url)}}:{})}));
 }
 return {view,move,emotes,emote};
}
module.exports={createLobbyHandlers};
