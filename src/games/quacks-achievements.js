'use strict';
const {randomUUID}=require('node:crypto');
const freeze=value=>{if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;};
class QuacksAchievements{
 constructor(room){this.room=room;this.current=null;this.completed=null;}
 start(){
  const r=this.room,participants=[],usedUsers=new Set(),usedSeats=new Set(),ids=r.players.filter(p=>!p.bot).map(p=>p.id),matchId=randomUUID();
  try{const supplied=r.achievementUnitStart?.(freeze({match_id:matchId,game_type:'quacks',unit:'match',participantSeatIds:ids.slice()}));
   if(Array.isArray(supplied))for(const item of supplied){if(!item||!ids.includes(item.seat_id)||! /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(item.user_id)||usedUsers.has(item.user_id.toLowerCase())||usedSeats.has(item.seat_id))continue;participants.push({user_id:item.user_id,seat_id:item.seat_id});usedUsers.add(item.user_id.toLowerCase());usedSeats.add(item.seat_id);}
  }catch{/* Optional identity capture cannot prevent a game starting. */}
  this.current={id:matchId,participants:freeze(participants),complete:ids.every(id=>usedSeats.has(id)),stats:new Map(r.players.map(p=>[p.id,{rounds:new Set(),explosions:0,witches:new Set()}]))};this.completed=null;
 }
 decision(p){if(!p.bot)this.current?.stats.get(p.id)?.rounds.add(this.room.round);}
 explosion(p){const s=this.current?.stats.get(p.id);if(s)s.explosions++;}
 witch(p,color){this.current?.stats.get(p.id)?.witches.add(color);}
 finish(){
  const r=this.room,c=this.current;if(!c||this.completed||r.interrupted||r.round!==9||r.results.length!==9||!c.complete)return;
  const winners=r.players.filter(p=>p.score===r.winner.score),best=Math.max(...winners.map(p=>p.position));
  this.completed=freeze({id:c.id,completed_at:new Date(r.now()).toISOString(),participants:c.participants.map(identity=>{const p=r.player(identity.seat_id),s=c.stats.get(identity.seat_id);return {...identity,eligible:!!p&&!p.bot&&s.rounds.size===9,winner:!!p&&p.score===r.winner.score&&p.position===best,noExplosion:s.explosions===0,threeWitches:s.witches.size===3,fiftyPoints:!!p&&p.score>=50};})});
 }
}
module.exports={QuacksAchievements};
