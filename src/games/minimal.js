'use strict';
const {randomUUID}=require('node:crypto');
const {PartyRoom,fail,clone,text,normalize}=require('./party-base');
const {WORDS}=require('./draw-guess-words');
const BANK=WORDS.filter(w=>w.id.startsWith('builtin-easy-'));
function shapes(input){
 if(!Array.isArray(input)||input.length>40)fail('INVALID_SHAPES','每張最多 40 個直線或圓',400);
 return input.map(s=>{if(!s||!['line','circle'].includes(s.kind))fail('INVALID_SHAPES','只能畫直線與封閉圓',400);const keys=s.kind==='line'?['x1','y1','x2','y2']:['cx','cy','r'];if(keys.some(k=>!Number.isInteger(s[k])))fail('INVALID_SHAPES','座標必須是整數',400);
  if(s.kind==='line'){if(s.x1<0||s.x1>511||s.x2<0||s.x2>511||s.y1<0||s.y1>255||s.y2<0||s.y2>255||s.x1===s.x2&&s.y1===s.y2)fail('INVALID_SHAPES','直線需在畫布內且有長度',400);}
  else if(s.r<2||s.r>128||s.cx-s.r<2||s.cx+s.r>509||s.cy-s.r<2||s.cy+s.r>253)fail('INVALID_SHAPES','圓與外框需完整位於畫布內',400);
  return Object.fromEntries(['kind',...keys].map(k=>[k,s[k]]));});
}
class MinimalRoom extends PartyRoom{
 constructor(code,name,rng,now){super('minimal',code,name,6,3,rng,now);this.question=null;this.guesserId=null;this.drafts={};this.ready={};this.order=[];this.shown=0;this.attempts=[];this.deadline=null;this.used=[];}
 start(){this.prepare();this.roundLimit=this.players.length<=4?this.players.length*2:this.players.length;this.used=[];this.nextRound();}
 nextRound(){const pool=BANK.filter(w=>!this.used.includes(w.id)),index=this.rng(pool.length);if(!Number.isInteger(index)||index<0||index>=pool.length)throw Error('無效抽題結果');this.question=clone(pool[index]);this.used.push(this.question.id);this.round++;this.roundId=randomUUID();this.guesserId=this.players[(this.round-1)%this.players.length].id;this.phase='drawing';this.drafts={};this.ready={};this.order=[];this.shown=0;this.attempts=[];this.deadline=null;this.event('round','第 '+this.round+' 輪，輪替猜題者；畫家只用直線與圓。');}
 artists(){return this.activePlayers().filter(p=>p.id!==this.guesserId);}
 act(id,action,data={}){return this.command(id,action,data,p=>{
  if(['draft','submit'].includes(action)){
   if(this.phase!=='drawing'||id===this.guesserId)fail('ARTIST_ONLY','只有作畫中的畫家可以送圖',403);if(this.ready[id])fail('ALREADY_SUBMITTED','這張已送出');if(this.deadline!=null&&this.now()>=this.deadline)fail('DRAWING_CLOSED','倒數已結束');
   const accepted=shapes(data.shapes);this.drafts[id]=accepted;if(action==='submit'){this.ready[id]=true;this.event('submit',p.name+' 完成作畫');const remaining=this.artists().filter(q=>!this.ready[q.id]);if(!remaining.length)this.closeDrawing();else if(remaining.length===1&&this.deadline==null){this.deadline=this.now()+10000;this.event('countdown','最後一位畫家還有 10 秒；已同步的圖形會在時間到時保留。');}}else this.event('draft',p.name+' 同步私人草稿');
  }else if(action==='guess'){
   if(this.phase!=='guessing'||id!==this.guesserId)fail('GUESSER_ONLY','只有本輪猜題者可以猜',403);const answer=text(data.text);if(!answer)fail('INVALID_TEXT','請輸入猜詞',400);const artist=this.player(this.order[this.shown]),correct=[this.question.title,...this.question.aliases].some(x=>normalize(x)===normalize(answer));this.attempts.push({artistId:artist.id,artistName:artist.name,text:answer,correct});
   if(correct){artist.score+=2;p.score++;this.closeRound();}else{this.shown++;this.event('guess','猜錯，展示下一位畫家的圖。');if(this.shown===this.order.length)this.closeRound();}
  }else if(action==='next'){if(id!==this.host)fail('HOST_ONLY','只有房主可以開始下一輪',403);if(this.phase!=='reveal')fail('INVALID_PHASE','先完成本輪');this.nextRound();}
  else fail('INVALID_ACTION','不支援的操作',400);
 });}
 closeDrawing(){this.deadline=null;const artists=this.artists(),priority=id=>(this.players.findIndex(p=>p.id===id)-this.players.findIndex(p=>p.id===this.guesserId)+this.players.length)%this.players.length;this.order=artists.filter(p=>this.drafts[p.id]?.length).sort((a,b)=>this.drafts[a.id].length-this.drafts[b.id].length||priority(a.id)-priority(b.id)).map(p=>p.id);this.phase='guessing';this.event('show','由少筆畫到多筆畫依序猜；同筆畫按猜題者後的座位順序。');if(!this.order.length)this.closeRound();}
 auto(){if(this.phase==='drawing'&&this.deadline!=null&&this.now()>=this.deadline)this.closeDrawing();}
 closeRound(){this.phase='reveal';this.results.push({round:this.round,title:this.question.title,guesserName:this.player(this.guesserId).name,attempts:clone(this.attempts),drawings:this.artists().map(p=>({name:p.name,count:this.drafts[p.id]?.length||0,shapes:clone(this.drafts[p.id]||[])}))});this.event('reveal','答案：'+this.question.title+'。猜中的畫家 +2，猜題者 +1。');if(this.round===this.roundLimit)this.finish();}
 view(id){const base=this.baseView(id),guesser=id===this.guesserId,visible=this.phase==='guessing'?this.order[this.shown]:null;return clone({...base,guesserId:this.guesserId,deadline:this.deadline,readyIds:Object.keys(this.ready),prompt:this.phase==='drawing'&&!guesser?this.question.title:null,myShapes:this.drafts[id]||[],submitted:!!this.ready[id],currentDrawing:visible?{name:this.player(visible).name,shapes:this.drafts[visible],count:this.drafts[visible].length}:null,order:this.phase==='guessing'?this.order.map(seat=>({name:this.player(seat).name,count:this.drafts[seat].length})):[],attempts:this.phase==='drawing'?[]:this.attempts});}
}
module.exports={MinimalRoom,shapes,BANK};
