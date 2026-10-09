'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createLobbyHandlers}=require('../src/http/lobby-routes');

test('lobby handlers preserve label fallback and broadcast only event media',()=>{
 const user={id:'test-user'},calls=[];
 const sound={url:'/private/sound',durationMs:1000};
 const character={expressions:{neutral:'/neutral',happy:'/happy',custom:'/custom',unknown:'/unknown'},labels:{custom:'自訂'},sounds:{custom:sound}};
 const handlers=createLobbyHandlers({
  lobby:{emote:(actor,event)=>{assert.equal(actor,user);return {event};}},
  withLobbyMedia:(actor,view)=>{assert.equal(actor,user);return {...view,serverNow:123};},
  lobbyCharacter:actor=>{assert.equal(actor,user);return character;},
  expressionLabels:{happy:'開心'},
  characterMedia:{broadcastImage:image=>{calls.push(['image',image]);return image+'?v=image';},broadcastSound:url=>{calls.push(['sound',url]);return url+'?v=sound';}},
 });
 assert.deepEqual(handlers.emotes(user),{emotes:[
  {expression:'happy',image:'/happy',label:'開心'},
  {expression:'custom',image:'/custom',label:'自訂',sound},
  {expression:'unknown',image:'/unknown',label:'unknown'},
 ]});
 assert.deepEqual(calls,[]);
 assert.deepEqual(handlers.emote(user,{expression:'custom'}),{serverNow:123,event:{image:'/custom?v=image',label:'自訂',sound:{url:'/private/sound?v=sound',durationMs:1000}}});
 assert.deepEqual(calls,[['image','/custom'],['sound','/private/sound']]);
 assert.equal(sound.url,'/private/sound');assert.equal(character.expressions.custom,'/custom');
 assert.equal(handlers.emote(user,{expression:'happy'}).event.label,'開心');
 assert.equal(handlers.emote(user,{expression:'unknown'}).event.label,'unknown');
});
