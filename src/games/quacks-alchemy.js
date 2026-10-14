'use strict';
// Original Chinese rule descriptions; track data verified against the supplied rules and Schmidt's alchemist flask pipes.
const {randomUUID}=require('node:crypto');
const {fail,clone}=require('./party-base');
const {BOARD,NAMES}=require('./quacks-catalog');
const LAST=BOARD.length-2;
const passive=[{}, {rat:1},{},{rat:1},{},{rat:1},{},{points:1},{points:1},{points:2},{points:2}];
const actionTrack=[{},{rat:1},{},{},{},{},{},{points:1},{points:1},{points:2},{points:2}];
const patient=(id,name,text,track)=>({id,name,text,track});
const PATIENTS=[
 patient('nervous','精神緊張','下輪製藥開始先預抽藥材，白色炸彈放回，其餘私人保留。每次普通抽藥可改放一片預抽藥材；紅色第2面須停止後才投入。',[{},{rat:1},...[1,2,3,4,5,6,7,8,10].map(n=>({preview:n}))]),
 patient('earworm','耳蟲','本輪特效藥完成後逐片額外抽藥，執行藥材效果。保留原本爆炸狀態，這些額外藥材不會造成新爆炸。',[{},...Array.from({length:10},(_,i)=>({draw:i===9?6:Math.floor(i/2)+1,...(i%2&&i<8?{rat:1}:{})}))]),
 patient('carrot','胡蘿蔔鼻','開局多一片南瓜1。第二輪起，抽出南瓜可花2格特效藥，跳到下一個紅寶石格。',passive),
 patient('ears','招風耳','第二輪起，未造成爆炸的白色炸彈可花2格特效藥、按數值前進兩倍；或花3格直接放回袋。',actionTrack),
 patient('eyes','雞眼','特效藥完成時立即領取所選格的藥材、紅寶石、升級、補瓶、液滴或骰子獎勵。',[{},{rubies:1},{chip:{color:'orange',value:1}},{upgrade:2},{refill:true},{chip:{color:'red',value:1}},{rubies:3},{dice:2},{droplet:2},{upgrade:4},{dice:4}]),
 patient('hump','女巫駝峰','第二輪起，投入藥材落在紅寶石格可花2格特效藥：1級拿紅寶石；2級或黑色擲骰；3級或紫色拿黃色1；4級或愚人草拿3分。',passive),
 patient('forgetful','健忘症','開局多紅色1、藍色1。第二輪起，製藥時可收回任一彩色藥材（愚人草除外），花掉其實際數值的特效藥；其他藥材與進度不移動。',[{},{},{},{},{},{},{},{points:1},{points:1},{points:2},{points:2}]),
 patient('vampire','吸血鬼化','本輪特效藥完成時，用所選格的獨立預算額外買一片藥材；不占普通購物次數。',[{},{rat:1},...[2,4,6,8,10,12,14,16,18].map(buy=>({buy}))])
];
function rewardText(r){const a=[];if(r.rat)a.push('下輪鼠尾巴 +'+r.rat);if(r.points)a.push(r.points+' 分');if(r.preview)a.push('下輪預抽 '+r.preview+' 片');if(r.draw)a.push('額外抽 '+r.draw+' 片');if(r.buy)a.push('獨立買一片 · '+r.buy+' 金幣');if(r.rubies)a.push(r.rubies+' 顆紅寶石');if(r.chip)a.push(NAMES[r.chip.color]+' '+r.chip.value);if(r.upgrade)a.push('1級升為'+r.upgrade+'級');if(r.refill)a.push('補滿藥水瓶');if(r.dice)a.push('擲骰 '+r.dice+' 次');if(r.droplet)a.push('液滴 +'+r.droplet);return a.join('；')||'保留特效藥，沒有額外獎勵';}
const catalog=()=>PATIENTS.map(p=>({...p,track:p.track.map((r,position)=>({position,...r,text:rewardText(r)}))}));
const methods={
 initAlchemy(){
  const ids=PATIENTS.map(p=>p.id);this.patientChoices=[];
  for(let i=0;i<3;i++)this.patientChoices.push(ids.splice(this.index(ids.length),1)[0]);
  for(const p of this.players){Object.assign(p,{pending:[],position:0,rat:0,ready:false,draws:0,budget:0,bought:[],effectSummary:[]});p.alchemy={patientId:null,essence:0,nextRat:0,preview:0,pool:[],held:null,confirmed:false,diceRemaining:0,earLeft:0,distilling:false,calculation:null};}
  this.phase='patients';this.stage='choose-patient';this.roundId=randomUUID();this.event('patients','抽出三名病患，每人選一名治療；可重複選擇。');
 },
 prepareAlchemy(){
  if(!this.options.alchemists)return;
  for(const p of this.players){const a=p.alchemy;a.held=null;a.confirmed=false;a.calculation=null;a.max=0;a.diceRemaining=0;a.earLeft=0;a.distilling=false;
   const chips=this.look(p,a.preview||0);a.preview=0;a.pool=chips.filter(c=>c.color!=='white');p.bag.push(...chips.filter(c=>c.color==='white'));
  }
 },
 beginAlchemy(){
  this.stage='essence';this.intents={};
  for(const p of this.players){
   const a=p.alchemy,i=this.players.indexOf(p),neighbors=new Set([this.players[(i+1)%this.players.length],this.players[(i+this.players.length-1)%this.players.length]]);
   const colors=new Set(p.pot.filter(c=>c.color!=='white').map(c=>c.color)).size;
   const exactSeven=p.pot.filter(c=>c.color==='white').reduce((n,c)=>n+c.value,0)===7?1:0;
   const explosions=[...neighbors].filter(q=>q!==p&&q.exploded).length;
   const locoweed=this.setFor('locoweed')===7?p.pot.filter(c=>c.color==='locoweed').length:0;
   const fortune=(this.fortune.id==='alchemy-misfortune'&&p.exploded?2:0)+(this.fortune.id==='alchemy-last'?(p.pot.at(-1)?.value||0):0);
   a.calculation={colors,exactSeven,explosions,locoweed,fortune};a.max=Math.min(10,colors+exactSeven+explosions+locoweed+fortune);a.essence=a.max;a.confirmed=false;p.ready=false;
  }
  this.event('essence','進入特效藥階段：依大釜計算，爆炸者也參加。');
 },
 advanceAlchemy(){
  if(this.phase!=='settlement'||this.stage!=='essence'||this.hasPending())return;
  for(const p of this.players){const a=p.alchemy;if(!a.confirmed)continue;
   while(a.earLeft>0&&!p.pending.length){a.earLeft--;const c=this.drawOne(p);if(c)this.place(p,c,{safe:true});}
   if(p.pending.length)return;
   if(a.distilling){const must=p.reserve.find(c=>c.must);if(must){p.reserve=p.reserve.filter(c=>c!==must);delete must.must;this.place(p,must,{safe:true,fromReserve:true});if(p.pending.length)return;return this.advanceAlchemy();}a.distilling=false;}
  }
  if(this.players.every(p=>p.alchemy.confirmed&&!p.alchemy.earLeft&&!p.alchemy.diceRemaining)&&!this.hasPending())this.beginBonus();
 },
 beforeAlchemyPlace(p,c,flags){
  const a=p.alchemy;if(!this.options.alchemists||!a||this.round<2||this.phase!=='brewing'||this.stage!=='drawing'||p.stopped||p.exploded||flags.noEffect||flags.fromReserve||flags.alchemyHandled)return false;
  const options=[];
  if(a.patientId==='carrot'&&c.color==='orange'&&a.essence>=2&&BOARD.some(x=>x.ruby&&x.position>p.position&&x.position<=LAST))options.push(this.option('花2格特效藥：南瓜跳到下個紅寶石格',[{op:'alchemyPlace',chip:c,cost:2,jump:true}]));
  if(a.patientId==='ears'&&c.color==='white'&&this.white(p)+c.value<=this.threshold(p)){
   if(a.essence>=2)options.push(this.option('花2格特效藥：白色炸彈前進 '+c.value*2+' 格',[{op:'alchemyPlace',chip:c,cost:2,double:true}]));
   if(a.essence>=3)options.push(this.option('花3格特效藥：白色炸彈放回藥袋',[{op:'alchemyPlace',chip:c,cost:3,return:true}]));
  }
  if(!options.length)return false;
  a.held=c;this.queue(p,'特效藥 · '+PATIENTS.find(x=>x.id===a.patientId).name,[this.option('照常投入',[{op:'alchemyPlace',chip:c,cost:0}]),...options]);return true;
 },
 afterAlchemyPlace(p,c,{wasStopped,noEffect}){
  const a=p.alchemy;if(!this.options.alchemists||!a||a.patientId!=='hump'||a.essence<2||this.round<2||this.phase!=='brewing'||this.stage!=='drawing'||wasStopped||noEffect||!p.pot.includes(c)||!BOARD[c.position]?.ruby)return;
  const reward=c.color==='locoweed'||c.value>=4?'points':c.color==='purple'||c.value===3?'yellow':c.color==='black'||c.value===2?'dice':'ruby';
  this.queue(p,'女巫駝峰：紅寶石格獎勵',[this.option('不使用',[]),this.option('花2格特效藥：'+({points:'3分',yellow:'曼德拉草1',dice:'擲一次骰',ruby:'1顆紅寶石'})[reward],[{op:'alchemyHump',reward,cost:2}])]);
 },
 alchemyOperate(p,o){
  const a=p.alchemy;
  if(o.op==='alchemyPlace'){if(!a.held||a.held.id!==o.chip.id)fail('STALE_CHIP','藥材已處理');a.held=null;a.essence-=o.cost;if(o.return)p.bag.push(o.chip);else this.place(p,o.chip,{alchemyHandled:true,...(o.double?{moveOverride:o.chip.value*2}:{}),...(o.jump?{jumpRuby:true}:{})});}
  else if(o.op==='alchemyHump'){a.essence-=o.cost;if(o.reward==='points')p.score+=3;if(o.reward==='yellow')this.grant(p,'yellow',1);if(o.reward==='ruby')p.rubies++;if(o.reward==='dice')this.roll(p,'特效藥 · 女巫駝峰');}
  else if(o.op==='alchemyBuy')this.grant(p,o.color,o.value);
  else if(o.op==='alchemyUpgrade'){const old=this.remove(p,o.chipId,false);if(old)this.grant(p,old.color,o.value);}
  else fail('INVALID_EFFECT','未知特效藥操作');
 },
 alchemyChoiceValid(p,o){
  return o.ops.every(x=>!x.op.startsWith('alchemy')||
   (x.cost||0)<=p.alchemy?.essence&&(x.op!=='alchemyPlace'||p.alchemy.held?.id===x.chip.id)&&(x.op!=='alchemyUpgrade'||p.pot.some(c=>c.id===x.chipId)));
 },
 alchemyAct(p,action,data){
  const a=p.alchemy;
  if(!['patient','essence','essence-roll','alchemy-return','alchemy-pool'].includes(action))return false;
  if(!this.options.alchemists||!a)fail('NO_ALCHEMISTS','未加入煉金術士',400);
  if(action==='patient'){
   if(this.phase!=='patients')fail('INVALID_PHASE','病患已鎖定');
   if(!this.patientChoices.includes(data.patientId))fail('INVALID_PATIENT','只能選本場三名病患',400);
   a.patientId=data.patientId;this.event('patient',p.name+' 選擇'+PATIENTS.find(x=>x.id===a.patientId).name);
   if(this.players.every(q=>q.alchemy.patientId)){for(const q of this.players){if(q.alchemy.patientId==='carrot')this.grant(q,'orange',1);if(q.alchemy.patientId==='forgetful'){this.grant(q,'red',1);this.grant(q,'blue',1);}}this.nextRound();}
  }else if(action==='essence'){
   if(this.phase!=='settlement'||this.stage!=='essence'||a.confirmed||p.pending.length)fail('INVALID_PHASE','現在不能確認特效藥');
   if(!Number.isInteger(data.position)||data.position<0||data.position>a.max)fail('INVALID_ESSENCE','只能選已達到的特效藥格位',400);
   a.essence=data.position;a.confirmed=true;p.ready=true;
   const reward=PATIENTS.find(x=>x.id===a.patientId).track[a.essence];
   if(this.round===9)p.score+=a.essence;
   else{
    p.score+=reward.points||0;a.nextRat=reward.rat||0;a.preview=reward.preview||0;
    if(reward.draw){a.earLeft=reward.draw;a.distilling=true;}
    p.rubies+=reward.rubies||0;if(reward.chip)this.grant(p,reward.chip.color,reward.chip.value);
    if(reward.refill)p.potion=true;if(reward.droplet)p.droplet=Math.min(LAST,p.droplet+reward.droplet);
    a.diceRemaining=reward.dice||0;
    if(reward.upgrade){const chips=p.pot.filter(c=>c.value===1&&(c.color==='white'?reward.upgrade===2:this.bookFor(c.color).offers.some(o=>o.value===reward.upgrade)));
     this.queue(p,'雞眼：升級一片1級藥材',[this.option('不升級',[]),...chips.map(c=>this.option(NAMES[c.color]+'1 → '+reward.upgrade,[{op:'alchemyUpgrade',chipId:c.id,value:reward.upgrade}]))]);}
    if(reward.buy)this.queue(p,'吸血鬼化：獨立購物預算 '+reward.buy,[this.option('不購買',[]),...this.availableBooks().flatMap(b=>b.offers.filter(o=>o.price<=reward.buy).map(o=>this.option(b.name+' '+o.value+' · '+o.price+'金幣',[{op:'alchemyBuy',color:b.color,value:o.value}])))]);
   }
   this.event('essence',p.name+' 確認特效藥第 '+a.essence+' 格');this.advanceAlchemy();
  }else if(action==='essence-roll'){
   if(this.phase!=='settlement'||this.stage!=='essence'||!a.confirmed||!a.diceRemaining||p.pending.length)fail('CANNOT_ROLL','現在不能擲特效藥骰');
   a.diceRemaining--;this.roll(p,'特效藥 · 雞眼');this.advanceAlchemy();
  }else if(action==='alchemy-return'){
   if(this.phase!=='brewing'||!['drawing','reserves'].includes(this.stage)||this.round<2||a.patientId!=='forgetful'||p.pending.length||Object.hasOwn(this.intents,p.id))fail('INVALID_PHASE','現在不能收回藥材');
   const c=p.pot.find(c=>c.id===data.chipId);if(!c||['white','locoweed'].includes(c.color)||a.essence<c.value)fail('INVALID_CHIP','此藥材不能收回',400);
   a.essence-=c.value;this.remove(p,c.id);this.event('alchemy-return',p.name+' 收回一片藥材，其他格位不變');this.advance();
  }else if(action==='alchemy-pool'){
   if(this.phase!=='brewing'||this.stage!=='reserves'||!p.stopped||p.pending.length||this.setFor('red')!==2)fail('INVALID_PHASE','停止後才能投入預抽紅色');
   const c=a.pool.find(c=>c.id===data.chipId&&c.color==='red');if(!c)fail('INVALID_CHIP','預抽藥材不存在',400);
   a.pool=a.pool.filter(x=>x!==c);this.place(p,c,{fromReserve:true});this.event('alchemy-pool',p.name+' 投入預抽紅色');this.advance();
  }
  return true;
 },
 alchemyView(p){
  if(!this.options.alchemists||!p.alchemy)return null;const a=p.alchemy;
  return clone({...a,held:undefined,distilling:undefined,
   patient:PATIENTS.find(x=>x.id===a.patientId)||null,
   returnable:this.phase==='brewing'&&['drawing','reserves'].includes(this.stage)&&this.round>1&&a.patientId==='forgetful'&&!p.pending.length&&!Object.hasOwn(this.intents,p.id)?p.pot.filter(c=>!['white','locoweed'].includes(c.color)&&c.value<=a.essence).map(c=>({id:c.id,color:c.color,value:c.value})):[],
   drawablePool:this.phase==='brewing'&&this.stage==='drawing'?a.pool.filter(c=>!(c.color==='red'&&this.setFor('red')===2)):[],
   rewardText:this.round===9?'第九輪：特效藥格數直接換成分數':rewardText(PATIENTS.find(x=>x.id===a.patientId)?.track[a.essence]||{})});
 }
};
module.exports={PATIENTS,catalog,rewardText,methods};
