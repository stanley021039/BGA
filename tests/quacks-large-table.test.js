'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {QuacksRoom,MAX_PLAYERS}=require('../src/games/quacks'),{POT_COLORS}=require('../src/games/quacks-catalog'),{listRooms}=require('../src/rooms/listing'),{rejoinPlayer}=require('../src/rooms/membership');
const act=(r,p,action,data={})=>r.act(p.id,action,{roundId:r.roundId,requestId:randomUUID(),...data});
function room(count,options={}){const r=new QuacksRoom('ABCDEF','親友加大桌',()=>0);for(let i=0;i<count;i++)r.add('朋友'+i);r.configure(r.host,{hiddenProgress:true,...options});return r;}

function play(r,cap=2000){
 let steps=0;while(r.phase!=='finished'){
  assert.ok(++steps<cap,'progress '+r.round+' '+r.phase+' '+r.stage);if(r.phase==='round-intro'){r.auto(r.nextRoundAt);continue;}if(r.phase==='between'){act(r,r.player(r.host),'next');continue;}
  for(const p of r.players){
   const s=r.view(p.id),m=s.mine;
   if(m.pending){const q=m.pending,o=q.options.find(o=>!o.disabled);assert.ok(o);act(r,p,'choice',{choiceId:q.id,optionId:o.id});continue;}
   if(s.phase==='patients'){if(!m.alchemy.patientId)act(r,p,'patient',{patientId:s.patients[0].id});continue;}
   if(s.phase==='fortune'){if(s.roundStarterId===p.id)act(r,p,'draw-fortune');continue;}
   if(s.phase==='brewing'){if(s.stage==='reserves'){const c=m.reserve.find(c=>c.must)||m.reserve[0];if(c)act(r,p,'reserve',{chipId:c.id});else if(!p.reserveDone)act(r,p,'reserve-done');}
    else if(m.canDraw)act(r,p,m.white>=m.threshold-2||p.draws>=7?'stop':'draw',{step:s.step});continue;}
   if(s.phase==='settlement'){
    if(s.stage==='essence'){if(!m.alchemy.confirmed)act(r,p,'essence',{position:m.alchemy.max});else if(m.alchemy.diceRemaining)act(r,p,'essence-roll');continue;}
    if(m.ready)continue;
    if(s.stage==='witches')act(r,p,'settle-ready');
    if(s.stage==='bonus'){if(m.bonusEligible&&!m.bonusRolled)act(r,p,'roll-bonus');else act(r,p,'bonus-ready');}
    if(s.stage==='effects-confirm')act(r,p,'confirm-effects');
    if(s.stage==='rewards')act(r,p,'reward',{mode:'score'});
    if(s.stage==='shopping'){if(r.round<9&&m.canBuy&&m.bought.length<2){const b=s.books.find(b=>!m.bought.some(c=>c.color===b.color)&&b.offers.some(o=>o.price<=m.budget));if(b){act(r,p,'buy',{color:b.color,value:b.offers.filter(o=>o.price<=m.budget).at(-1).value});continue;}}act(r,p,'shop-ready');}
   }
  }
 }
 return steps;
}

test('six/eight seats have unique pot colors with optional expansions, and a ninth seat is rejected',()=>{for(const witches of [false,true])for(const alchemists of [false,true])for(const n of [6,8]){const r=room(n,{witches,alchemists});assert.equal(r.max,MAX_PLAYERS);assert.equal(r.view(r.host).maxPlayers,8);assert.equal(new Set(r.players.map(p=>p.potColor)).size,n);assert.ok(r.players.every(p=>POT_COLORS[p.potColor]));if(n===8)assert.throws(()=>r.add('超額'),e=>e.code==='ROOM_FULL');r.configure(r.host,{witches:false,bookSet:1});assert.equal(r.max,8);const listed=listRooms(new Map([[r.code,r]]),new Map(),new Map(),'visitor')[0];assert.equal(listed.maxPlayers,8);assert.equal(listed.joinable,n<8);}});
test('all eight intents are required, retries do not draw twice, and other bags remain private',()=>{const r=room(8);r.start();act(r,r.player(r.roundStarterId),'draw-fortune');const step=r.step;for(const p of r.players.slice(0,7)){const data={roundId:r.roundId,requestId:randomUUID(),step};r.act(p.id,'draw',data);r.act(p.id,'draw',data);}assert.ok(r.players.every(p=>p.pot.length===0));act(r,r.players[7],'draw',{step});assert.ok(r.players.every(p=>p.draws===1&&p.pot.length===1));assert.equal(r.step,step+1);for(const p of r.players){const s=r.view(p.id);assert.equal(s.mine.drawEvents.length,1);assert.equal(s.mine.bag,undefined);assert.ok(s.recipes.filter(q=>q.id!==p.id).every(q=>q.hidden&&q.pot===null&&!Object.hasOwn(q,'drawEvents')));}});
test('rejoining after a replacement seat preserves eight distinct colors',()=>{const r=room(8),old=r.players[1],color=old.potColor;r.kick(r.host,old.id);const replacement=r.add('新朋友');assert.equal(replacement.potColor,color);assert.throws(()=>rejoinPlayer(r,old.id,old.name),/房間已滿/);r.kick(r.host,r.players[2].id);rejoinPlayer(r,old.id,old.name);assert.notEqual(old.potColor,replacement.potColor);assert.equal(new Set(r.activePlayers().map(p=>p.potColor)).size,8);});
test('six/eight-player base, witches, alchemists and combined tables complete nine rounds',()=>{for(const count of [6,8])for(const options of [{},{witches:true},{alchemists:true},{witches:true,alchemists:true}]){const r=room(count,options);r.start();assert.ok(play(r,2000)>0);assert.equal(r.results.length,9);assert.equal(r.interrupted,false);assert.ok(r.winner.names.length);assert.ok(r.players.every(p=>Number.isInteger(p.score)&&p.rubies>=0));}});

test('eight-player neighbor effects still use only adjacent seats across the ring boundary',()=>{const r=room(8,{alchemists:true});r.start();for(const p of r.players)act(r,p,'patient',{patientId:r.patientChoices[0]});act(r,r.player(r.roundStarterId),'draw-fortune');for(const [i,p]of r.players.entries()){p.pending=[];p.pot=Array.from({length:i===0?2:i===1||i===7?1:5},(_,j)=>({...r.chip('black'),effectColor:'black',effectValue:1,position:j+1}));p.exploded=i!==0;p.stopped=true;}const p=r.players[0],ruby=p.rubies;r.phase='settlement';r.beginEffects();assert.equal(p.droplet,1);assert.equal(p.rubies,ruby+1,'distant seats with five moths do not reduce the reward');r.beginAlchemy();assert.equal(p.alchemy.calculation.explosions,2,'six other explosions still count only the two neighbors');});
