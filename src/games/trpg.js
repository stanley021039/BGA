'use strict';
const {randomInt,randomUUID}=require('node:crypto');
const {HttpError}=require('../http/errors');
const {assertRecordCapacity}=require('../rooms/membership');

// Original adventure and rules. No D&D/CoC text, licensed setting or remote AI.
const ROLES=Object.freeze({
 scout:{name:'尋路者',skill:'mind',description:'觀察與機關 +2'},
 envoy:{name:'說書人',skill:'heart',description:'交涉與共感 +2'},
 guardian:{name:'守望者',skill:'brave',description:'行動與勇氣 +2'}
});
const APPROACHES=Object.freeze({
 careful:{name:'觀察線索',skill:'mind',difficulty:6,cost:1,reward:1,risk:1},
 connect:{name:'建立信任',skill:'heart',difficulty:7,cost:0,reward:1,risk:1},
 bold:{name:'冒險突破',skill:'brave',difficulty:8,cost:0,reward:2,risk:2}
});
const SCENES=Object.freeze([
 {zone:0,title:'失聲的渡口',text:'霧港的鐘聲突然消失。最後一班渡船停在岸邊，船夫握著一枚不再發光的銅鈴。你們必須在黎明前把鐘聲帶回燈塔。',choices:['花一份補給檢查鈴上的刻痕','聽船夫說完那段沒人相信的故事','沿斷裂的纜繩躍上渡船'],success:'渡船駛入霧中，一道微光指向舊市場。',partial:'渡船終於出發，但霧中的腳步聲也跟了上來。',failure:'船纜斷了，你們改乘小艇抵達市場；鐘影已察覺你們。'},
 {zone:0,title:'市場裡的回音',text:'攤位空無一人，影子卻仍在叫賣。一本帳簿、一位怕生的小販與一條屋頂捷徑，都通向同一間鐘匠鋪。',choices:['花一份補給拓印帳簿的浮字','用自己的旅行故事換小販的信任','踏上搖晃的招牌追逐鐘影'],success:'你們帶著鐘匠的地址離開，還知道了銅鈴的來歷。',partial:'地址找到了，卻驚醒一排會追人的影子。',failure:'影子搶走了帳簿，但它逃跑的方向暴露了鐘匠鋪。'},
 {zone:1,title:'鐘匠的約定',text:'鐘匠說：鐘聲不是被偷走，而是替一個承諾躲起來。她願意給你們鑰匙，卻要先知道你們打算怎麼使用它。',choices:['花一份補給修好桌上的小鐘','承諾讓港口每個人都能被聽見','抬起沉重的鐘模證明你們的決心'],success:'鐘匠交出鑰匙，並教你們辨認真正的鐘聲。',partial:'她交出鑰匙，但裂開的鐘模讓鐘影更加躁動。',failure:'鐘匠仍把鑰匙交給你們：「帶著錯誤也要走下去。」'},
 {zone:1,title:'潮水下的階梯',text:'燈塔的門在海面下。潮水每退一次，才露出一段階梯。一個沉默的水手守在入口，牆上的潮汐線逐漸消失。',choices:['花一份補給標記下一次退潮的路線','邀請水手一起守住入口','趁退潮帶領大家穿過斷階'],success:'所有人抵達塔底，水手留下最後一段鐘聲。',partial:'你們抵達了塔底，海水卻灌進身後的通道。',failure:'繩索救回了落水者，隊伍仍向塔頂前進，但失去一份補給。'},
 {zone:2,title:'倒轉的鐘室',text:'鐘室裡的每個指針都在倒走。鏡中的你们提出三種說法：找到齒輪、說服鐘影，或親手拉住擺錘。',choices:['花一份補給找出卡住的齒輪','告訴鐘影你們願意記住誰的聲音','在擺錘間把銅鈴掛回原位'],success:'鐘室重新走動，港口的聲音一個接一個回來。',partial:'鐘室恢復了一半，餘下的聲音仍藏在霧裡。',failure:'銅鈴裂開，卻讓你們第一次聽見鐘影真正的呼救。'},
 {zone:2,title:'黎明之前',text:'最後一道鐘聲就在燈塔頂。你們可以修復光源、與鐘影約定未來，或把銅鈴高舉到第一道晨光中。這次，每個人的選擇都會留在港口。',choices:['花一份補給把碎片修成完整光源','邀請鐘影成為港口的新守望者','帶著銅鈴穿過狂風走上塔頂'],success:'第一道晨光照亮海面，所有付出都被鐘聲記住。',partial:'鐘聲仍有裂痕，但港口終於聽見彼此。',failure:'黎明來了。你們護著銅鈴撤回港口，留下下一次再訪的約定。'}
]);
const clone=value=>JSON.parse(JSON.stringify(value));
const fail=(code,message,status=409)=>{throw new HttpError(status,code,message);};
class TrpgRoom{
 constructor(code,name,rng=randomInt){
  this.type='trpg';this.code=code;this.name=name;this.rng=rng;this.players=[];this.host=null;
  this.phase='waiting';this.version=0;this.round=0;this.updated=Date.now();this.log=[];this.events=[];
  this.sceneId=null;this.leaderId=null;this.plans={};this.supplies=0;this.clues=0;this.danger=0;
  this.results=[];this.winner=null;this.runId=null;
  Object.defineProperty(this,'receipts',{value:new Map(),enumerable:false});
 }
 event(kind,text){this.events.push({id:++this.version,kind,text});this.events=this.events.slice(-30);this.log.unshift(text);this.log=this.log.slice(0,60);this.updated=Date.now();}
 player(id){return this.players.find(p=>p.id===id&&!p.kicked);}
 activePlayers(){return this.players.filter(p=>!p.kicked);}
 add(name,bot=false){
  if(!['waiting','finished'].includes(this.phase))fail('MATCH_STARTED','冒險已開始，請等下一場');
  if(this.activePlayers().length>=6)fail('ROOM_FULL','房間已滿',400);
  assertRecordCapacity(this);
  const p={id:randomUUID(),name:String(name).slice(0,16),secret:randomUUID(),bot:!!bot,kicked:false,lastSeen:Date.now(),role:Object.keys(ROLES)[this.activePlayers().length%3],focus:3};
  this.players.push(p);this.host||=p.id;this.event('join',p.name+' 加入冒險隊');return p;
 }
 start(){
  if(!['waiting','finished'].includes(this.phase))fail('MATCH_STARTED','冒險已開始');
  if(!this.activePlayers().length)fail('NEED_PLAYERS','至少需要一位玩家',400);
  this.players=this.activePlayers();this.players.forEach(p=>p.focus=3);
  this.runId=randomUUID();this.receipts.clear();this.supplies=4;this.clues=0;this.danger=0;this.results=[];this.winner=null;this.round=0;
  this.newScene();this.event('start','霧港鐘聲：在六個場景內找回至少 5 枚線索，危機不超過 7。');
 }
 newScene(){this.round++;this.sceneId=randomUUID();this.leaderId=this.activePlayers()[(this.round-1)%this.activePlayers().length].id;this.plans={};this.phase='planning';}
 act(id,action,data={}){
  const p=this.player(id);if(!p)fail('NOT_SEATED','尚未入座',403);
  if(action==='role'){
   if(!['waiting','finished'].includes(this.phase))fail('MATCH_STARTED','開局前才能選角色');
   if(!Object.hasOwn(ROLES,data.role))fail('INVALID_ROLE','請選擇有效角色',400);
   p.role=data.role;this.event('role',p.name+' 選擇'+ROLES[p.role].name);return;
  }
  if(!['plan','resolve','skip','next'].includes(action))fail('INVALID_ACTION','不支援的操作',400);
  // Scope every command to this scene, including retries after advancing/restarting.
  if(data.sceneId!==this.sceneId)fail('STALE_SCENE','場景已變更，請先更新畫面');
  if(typeof data.requestId!=='string'||! /^[a-zA-Z0-9-]{8,80}$/.test(data.requestId))fail('INVALID_REQUEST_ID','操作識別碼不正確',400);
  const key=id+':'+data.requestId,fingerprint=JSON.stringify([action,data.sceneId,data.approach??null,data.stance??null,data.note??'',data.playerId??null,data.confirmed??false]);
  if(this.receipts.has(key)){if(this.receipts.get(key)!==fingerprint)fail('REQUEST_CONFLICT','同一操作識別碼不能用於不同內容');return;}
  if(action==='plan'){
   if(this.phase!=='planning')fail('INVALID_PHASE','這個場景已經結算');
   if(!['assist','recover'].includes(data.stance))fail('INVALID_STANCE','請選擇協助或整備',400);
   if(typeof data.note!=='string'||[...data.note].length>160||/[\u0000-\u001f\u007f]/.test(data.note))fail('INVALID_NOTE','描述最多 160 字，且不能換行',400);
   if(id===this.leaderId&&!Object.hasOwn(APPROACHES,data.approach))fail('INVALID_APPROACH','請選擇解法',400);
   if(data.stance==='assist'&&id!==this.leaderId&&p.focus<1)fail('NO_FOCUS','專注不足，請先整備',400);
   if(id===this.leaderId&&APPROACHES[data.approach].cost>this.supplies)fail('NO_SUPPLIES','補給不足，請選其他解法',400);
   this.plans[id]={stance:data.stance,approach:id===this.leaderId?data.approach:null,note:data.note.trim(),skipped:false};
   this.event('plan',p.name+' 已準備好');
  }else if(action==='skip'){
   if(id!==this.host)fail('HOST_ONLY','只有房主可以處理離線席位',403);
   if(this.phase!=='planning'||data.confirmed!==true)fail('CONFIRM_REQUIRED','請確認離線席位本場景休息',400);
   const target=this.player(data.playerId);
   if(!target||target.bot||target.id===this.leaderId||Date.now()-target.lastSeen<15000||this.plans[target.id])fail('NOT_OFFLINE','只能讓尚未準備的離線隊友休息');
   this.plans[target.id]={stance:'recover',approach:null,note:'本場景離線休息',skipped:true};
   this.event('skip',target.name+' 離線，本場景休息；沒有代替其擲骰或花費專注。');
  }else if(action==='resolve'){
   if(id!==this.leaderId)fail('LEADER_ONLY','只有本場景領隊可以檢定',403);
   if(this.phase!=='planning')fail('INVALID_PHASE','這個場景已經結算');
   if(this.activePlayers().some(q=>!this.plans[q.id]))fail('NOT_READY','還有隊友尚未準備好');
   this.resolve();
  }else{
   if(id!==this.leaderId)fail('LEADER_ONLY','只有本場景領隊可以前往下一幕',403);
   if(this.phase!=='reveal')fail('INVALID_PHASE','先完成本場景檢定');
   this.newScene();this.event('next','前往第 '+this.round+' 幕，由 '+this.player(this.leaderId).name+' 領隊。');
  }
  this.receipts.set(key,fingerprint);if(this.receipts.size>128)this.receipts.delete(this.receipts.keys().next().value);
 }
 resolve(){
  const scene=SCENES[this.round-1],leader=this.player(this.leaderId),plan=this.plans[leader.id],approach=APPROACHES[plan.approach];
  if(this.supplies<approach.cost)fail('NO_SUPPLIES','補給不足，請重新選擇解法',400);
  const helpers=this.activePlayers().filter(p=>p.id!==leader.id&&this.plans[p.id].stance==='assist');
  // All validation precedes RNG and resource mutations; an extra helper is not charged.
  const charged=helpers.slice(0,2);if(charged.some(p=>p.focus<1))fail('NO_FOCUS','隊友專注不足');
  const roll=this.rng(6);if(!Number.isInteger(roll)||roll<0||roll>5)throw Error('無效骰子結果');
  const die=roll+1,skill=plan.stance==='assist'&&ROLES[leader.role].skill===approach.skill?2:0,support=charged.length,total=die+skill+support;
  const outcome=total>=approach.difficulty?'success':total>=approach.difficulty-2?'partial':'failure';
  this.supplies-=approach.cost;charged.forEach(p=>p.focus--);
  for(const p of this.activePlayers())if(this.plans[p.id].stance==='recover'&&!this.plans[p.id].skipped)p.focus=Math.min(3,p.focus+1);
  const clues=outcome==='success'?approach.reward:outcome==='partial'?1:0;
  const danger=outcome==='success'?0:outcome==='partial'?1:approach.risk;
  this.clues+=clues;this.danger+=danger;
  if(outcome==='failure')this.supplies=Math.max(0,this.supplies-1);
  const result={sceneId:this.sceneId,round:this.round,title:scene.title,leaderName:leader.name,approach:approach.name,die,skill,support,total,difficulty:approach.difficulty,outcome,clues,danger,text:scene[outcome],participants:this.activePlayers().map(p=>({id:p.id,name:p.name,note:this.plans[p.id].note,stance:this.plans[p.id].stance,charged:charged.some(h=>h.id===p.id),skipped:this.plans[p.id].skipped}))};
  this.results.push(result);this.phase='reveal';
  this.event('resolve',leader.name+'：'+die+' + 角色 '+skill+' + 協助 '+support+' = '+total+'／難度 '+approach.difficulty+'；'+({success:'成功',partial:'付出代價仍推進',failure:'受挫仍推進'})[outcome]+'。');
  if(this.round===SCENES.length){
   this.phase='finished';const restored=this.clues>=5&&this.danger<=7;
   this.winner={restored,clues:this.clues,danger:this.danger,title:restored?'鐘聲回到霧港':'帶著約定回港',text:restored?'你們找回足夠線索，讓鐘聲與鐘影共存。每位隊友都留下自己的故事。':'你們保護了彼此，也帶回銅鈴。燈塔還需要下一次冒險；沒有人因失敗被淘汰。'};
   this.event('finish',this.winner.title);
  }
 }
 kick(id,targetId,leaving=false){
  if(id!==this.host&&!leaving)fail('HOST_ONLY','只有房主可以移除席位',403);
  const target=this.player(targetId);if(!target)fail('PLAYER_NOT_FOUND','找不到玩家',404);
  target.kicked=true;delete this.plans[targetId];
  const active=this.activePlayers();
  if(this.host===targetId)this.host=active[0]?.id??null;
  if(this.leaderId===targetId&&this.phase==='planning'){
   this.leaderId=active[0]?.id??null;
   // Invalidate all old commands after ownership changes and let the new leader propose.
   this.sceneId=randomUUID();this.plans={};
  }else if(this.leaderId===targetId&&this.phase==='reveal')this.leaderId=active[0]?.id??null;
  this.event('leave',target.name+' 離開；'+(this.phase==='planning'?'本場景繼續，由目前領隊決定。':'已揭曉的結果保留。'));
 }
 view(id){
  const p=this.player(id);if(!p)fail('NOT_SEATED','尚未入座',403);
  const scene=SCENES[this.round-1];
  return clone({type:this.type,code:this.code,name:this.name,me:id,host:this.host,phase:this.phase,version:this.version,round:this.round,roundLimit:6,sceneId:this.sceneId,leaderId:this.leaderId,narratorMode:'rules',adventure:'霧港鐘聲',supplies:this.supplies,clues:this.clues,danger:this.danger,
   players:this.activePlayers().map(q=>({id:q.id,name:q.name,bot:q.bot,avatar:q.avatar,role:q.role,roleName:ROLES[q.role].name,focus:q.focus,ready:!!this.plans[q.id],offline:!q.bot&&Date.now()-q.lastSeen>=15000})),
   scene:scene?{title:scene.title,text:scene.text,zone:scene.zone}:null,
   approaches:scene?Object.entries(APPROACHES).map(([key,a],i)=>({id:key,...a,description:scene.choices[i]})):[],roles:ROLES,
   myPlan:this.plans[id]||null,readyCount:this.activePlayers().filter(q=>this.plans[q.id]).length,
   canResolve:this.phase==='planning'&&id===this.leaderId&&this.activePlayers().every(q=>this.plans[q.id]),
   results:this.results,winner:this.winner,events:this.events,log:this.log});
 }
}
module.exports={TrpgRoom,ROLES,APPROACHES,SCENES};
