'use strict';
const {randomInt,randomUUID,createHash}=require('node:crypto');
const {HttpError}=require('../http/errors');
const {assertRecordCapacity}=require('../rooms/membership');
const {PROMPTS,SOURCES}=require('./telephone-prompts');
const clone=x=>JSON.parse(JSON.stringify(x));
const fail=(code,message,status=409)=>{throw new HttpError(status,code,message);};
function drawing(input){
 if(!Array.isArray(input)||!input.length||input.length>100)fail('INVALID_DRAWING','畫作需有 1–100 筆',400);
 let points=0;
 return input.map(s=>{
  if(!s||!['brush','erase'].includes(s.tool)||!/^#[a-f0-9]{6}$/i.test(s.color)||![2,4,8,16].includes(s.size)||!Array.isArray(s.points)||!s.points.length||s.points.length>256)fail('INVALID_DRAWING','筆畫格式不正確',400);
  points+=s.points.length;if(points>3000)fail('DRAWING_LIMIT','每頁最多 3,000 點',400);
  const coordinates=s.points.map(p=>{if(!Array.isArray(p)||p.length!==2||!p.every(Number.isInteger)||p[0]<0||p[0]>511||p[1]<0||p[1]>255)fail('INVALID_DRAWING','畫作座標不正確',400);return p.slice();});
  return {tool:s.tool,color:s.color,size:s.size,points:coordinates};
 });
}
class TelephoneRoom{
 constructor(code,name,rng=randomInt){
  Object.assign(this,{type:'telephone',code,name,rng,players:[],host:null,phase:'waiting',version:0,updated:Date.now(),round:0,roundLimit:0,stepId:null,books:[],roster:[],submissions:{},options:{sources:['everyday','silly']},events:[],log:[],interrupted:false});
  Object.defineProperty(this,'receipts',{value:new Map(),enumerable:false});
  Object.defineProperty(this,'books',{value:[],writable:true,enumerable:false});
  this.runId=null;this.pageCommits=[];
 }
 activePlayers(){return this.players.filter(p=>!p.kicked);}
 player(id){return this.activePlayers().find(p=>p.id===id);}
 event(kind,text){this.events.push({id:++this.version,kind,text});this.events=this.events.slice(-30);this.log.unshift(text);this.log=this.log.slice(0,60);this.updated=Date.now();}
 add(name,bot=false){
  if(!['waiting','finished'].includes(this.phase))fail('MATCH_STARTED','傳遞中不能加入，請等下一場');
  if(this.activePlayers().length>=8)fail('ROOM_FULL','房間已滿',400);assertRecordCapacity(this);
  const p={id:randomUUID(),name:String(name).slice(0,16),secret:randomUUID(),bot:!!bot,kicked:false,lastSeen:Date.now()};this.players.push(p);this.host||=p.id;this.event('join',p.name+' 入座');return p;
 }
 configure(id,data){
  if(id!==this.host)fail('HOST_ONLY','只有房主可以設定',403);
  if(!['waiting','finished'].includes(this.phase))fail('MATCH_STARTED','傳遞中不能改題庫');
  if(!Array.isArray(data.sources)||!data.sources.length||data.sources.length>2||new Set(data.sources).size!==data.sources.length||data.sources.some(x=>!SOURCES.some(s=>s.id===x)))fail('INVALID_SOURCES','請選擇有效題庫',400);
  this.options.sources=data.sources.slice();this.event('settings','房主更新獨立情境題庫');
 }
 start(){
  if(!['waiting','finished'].includes(this.phase))fail('MATCH_STARTED','已經開始傳遞');
  const active=this.activePlayers();if(active.length<3)fail('NEED_PLAYERS','至少三人，可加入腳本測試夥伴',400);
  const pool=PROMPTS.filter(p=>this.options.sources.includes(p.source)),books=[];
  // Allocate all prompts before mutating: bad RNG cannot partially start a match.
  for(const p of active){const index=this.rng(pool.length);if(!Number.isInteger(index)||index<0||index>=pool.length)throw Error('無效抽題結果');const prompt=pool.splice(index,1)[0];books.push({ownerId:p.id,ownerName:p.name,promptId:prompt.id,pages:[{kind:'text',authorName:'情境題庫',text:prompt.text}]});}
  this.players=active;this.roster=active.map(p=>p.id);this.books=books;this.runId=randomUUID();this.pageCommits=[];this.round=1;this.roundLimit=active.length%2?active.length-1:active.length;this.phase='passing';this.stepId=randomUUID();this.submissions={};this.interrupted=false;this.receipts.clear();this.event('start','每人只看上一頁，畫圖與猜詞交替；最後一起揭曉。');
 }
 bookFor(id){const seat=this.roster.indexOf(id);return this.books[(seat-this.round+1+this.roster.length)%this.roster.length];}
 act(id,action,data={}){
  const p=this.player(id);if(!p)fail('NOT_SEATED','尚未入座',403);
  if(data.stepId!==this.stepId)fail('STALE_STEP','已換頁，請更新畫面');
  if(typeof data.requestId!=='string'||! /^[a-zA-Z0-9-]{8,80}$/.test(data.requestId))fail('INVALID_REQUEST_ID','操作識別碼不正確',400);
  const key=id+':'+data.requestId,fingerprint=createHash('sha256').update(JSON.stringify([action,data.stepId,data.text??null,data.strokes??null])).digest('hex');
  if(this.receipts.has(key)){if(this.receipts.get(key)!==fingerprint)fail('REQUEST_CONFLICT','操作識別碼內容不一致');return;}
  if(this.phase!=='passing')fail('INVALID_PHASE','這場已結束');
  if(action==='advance'){
   if(id!==this.host)fail('HOST_ONLY','只有房主可以傳下一頁',403);
   if(this.roster.some(seat=>!this.submissions[seat]))fail('NOT_READY','還有人未送出');
   this.commitPages();
   if(this.round===this.roundLimit){this.phase='finished';this.event('finish','全部故事揭曉！沒有排名，一起看看故事如何變形。');}
   else{this.round++;this.stepId=randomUUID();this.submissions={};this.event('pass','第 '+this.round+' 頁：'+(this.round%2?'畫圖':'猜詞'));}
  }else if(action==='submit'||action==='skip'){
   if(this.submissions[id])fail('ALREADY_SUBMITTED','這頁已送出');
   const kind=this.round%2?'drawing':'text';let page={kind,authorName:p.name,authorId:id,skipped:action==='skip'};
   if(action==='skip'){page=kind==='drawing'?{...page,strokes:[]}:{...page,text:'（本頁略過）'};}
   else if(kind==='drawing')page.strokes=drawing(data.strokes);
   else{if(typeof data.text!=='string'||![...data.text.trim()].length||[...data.text.trim()].length>80||/[\u0000-\u001f\u007f]/.test(data.text))fail('INVALID_TEXT','猜詞需 1–80 字且不能換行',400);page.text=data.text.trim();}
   this.submissions[id]=page;this.event('submit',p.name+' 已送出');
  }else fail('INVALID_ACTION','不支援的操作',400);
  this.receipts.set(key,fingerprint);if(this.receipts.size>128)this.receipts.delete(this.receipts.keys().next().value);
 }
 kick(id,targetId,leaving=false){
  if(id!==this.host&&!leaving)fail('HOST_ONLY','只有房主可以移除席位',403);
  const p=this.player(targetId);if(!p)fail('PLAYER_NOT_FOUND','找不到玩家',404);p.kicked=true;
  if(this.host===targetId)this.host=this.activePlayers()[0]?.id??null;
  if(this.phase==='passing'){this.commitPages();this.interrupted=true;this.phase='finished';this.event('interrupted','有人離席，傳遞中止；只揭曉已送出的頁面，不冒充正常完局。');}
  this.event('leave',p.name+' 離席');
 }
 commitPages(){this.pageCommits=[];for(const seat of this.roster){const page=this.submissions[seat];if(!page)continue;const book=this.bookFor(seat);book.pages.push(page);this.pageCommits.push({bookIndex:this.books.indexOf(book),round:this.round,page});}this.submissions={};}
 // History stores bounded page deltas; completed books are reconstructed from rows.
 historyState(){return {...this,bookHeaders:this.books.map(b=>({...b,pages:b.pages.slice(0,1)}))};}
 view(id){
  if(!this.player(id))fail('NOT_SEATED','尚未入座',403);
  const passing=this.phase==='passing',book=passing?this.bookFor(id):null;
  return clone({type:this.type,code:this.code,name:this.name,me:id,host:this.host,version:this.version,phase:this.phase,round:this.round,roundLimit:this.roundLimit,stepId:this.stepId,interrupted:this.interrupted,options:this.options,sources:SOURCES,
   players:this.activePlayers().map(p=>({id:p.id,name:p.name,bot:p.bot,avatar:p.avatar,ready:!!this.submissions[p.id],offline:!p.bot&&Date.now()-p.lastSeen>=15000})),
   task:passing?{kind:this.round%2?'drawing':'text',previous:book.pages.at(-1),submitted:!!this.submissions[id]}:null,
   canAdvance:passing&&id===this.host&&this.roster.every(seat=>this.submissions[seat]),books:this.phase==='finished'?this.books:[],events:this.events,log:this.log});
 }
}
module.exports={TelephoneRoom,drawing};
