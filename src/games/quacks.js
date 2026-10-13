'use strict';
const {randomUUID}=require('node:crypto');
const {PartyRoom,fail,clone,text}=require('./party-base');
const {QuacksAchievements}=require('./quacks-achievements');
const Alchemy=require('./quacks-alchemy');
const ExpansionFortunes=require('./quacks-expansion-fortunes');
const {POT_COLORS,NAMES,BOARD,WITCHES,FORTUNES,book}=require('./quacks-catalog');
const LAST=BOARD.length-2, Spoon=BOARD.at(-1);
const label=c=>NAMES[c.color]+' '+c.value;
class QuacksRoom extends PartyRoom {
 constructor(code,name,rng,now){super('quacks',code,name,5,2,rng,now);Object.defineProperty(this,'quacksAchievements',{value:new QuacksAchievements(this),enumerable:false});this.options={witches:false,alchemists:false,hiddenProgress:false,bookSet:1};this.alchemyDraws={};this.bookVotes={};this.bookTieChoices={};this.activeBooks=null;this.rollEvents=[];this.step=0;this.intents={};this.fortune=null;this.witches={};this.stage=null;}
 configure(id,data){
  if(id!==this.host)fail('HOST_ONLY','只有房主可以設定',403);
  if(!['waiting','finished'].includes(this.phase))fail('MATCH_STARTED','開始後不能改設定');
  const options={...this.options,...Object.fromEntries(['witches','alchemists','hiddenProgress','bookSet'].filter(k=>data[k]!==undefined).map(k=>[k,data[k]]))};
  if(typeof options.alchemists!=='boolean'||typeof options.witches!=='boolean'||typeof options.hiddenProgress!=='boolean'||!Number.isInteger(options.bookSet)||options.bookSet<1||options.bookSet>(options.witches?6:4))fail('INVALID_SETTINGS','請選有效的擴充、隱藏進度及藥材書',400);
  if(!options.witches&&this.activePlayers().length>4)fail('NEED_EXPANSION','五人局須開啟草藥女巫');
  this.options=options;this.bookTieChoices={};this.max=options.witches?5:4;this.event('settings','更新遊戲設定');
 }
 add(name,bot=false){this.max=this.options?.witches?5:4;const p=super.add(name,bot);p.potColor=Object.keys(POT_COLORS).find(c=>!this.activePlayers().some(q=>q.id!==p.id&&q.potColor===c));p.potName=p.name+'的好運釜';return p;}

 choiceSets(color){if(color==='orange')return [this.options.witches?5:1];if(color==='black')return this.options.witches?[1,5,6]:[1];if(color==='locoweed')return [...(this.options.witches?[5,6]:[]),...(this.options.alchemists?[7,8,9,10]:[])];return this.options.witches?[1,2,3,4,5,6]:[1,2,3,4];}
 defaultBook(color){const sets=this.choiceSets(color);return sets.includes(this.options.bookSet)?this.options.bookSet:sets[0];}
 bookSelection(){
  const voters=this.activePlayers().filter(p=>!p.bot),colors=Object.keys(NAMES).filter(c=>c!=='white'&&(c!=='locoweed'||this.options.witches||this.options.alchemists));
  return colors.map(color=>{const sets=this.choiceSets(color),votes=voters.map(p=>({id:p.id,name:p.name,set:sets.includes(this.bookVotes[p.id]?.[color])?this.bookVotes[p.id][color]:this.defaultBook(color),explicit:sets.includes(this.bookVotes[p.id]?.[color])})),counts=sets.map(set=>({set,count:votes.filter(v=>v.set===set).length})),max=Math.max(...counts.map(c=>c.count)),leaders=counts.filter(c=>c.count===max).map(c=>c.set),key=JSON.stringify([color,votes.map(v=>[v.id,v.set])]),choice=this.bookTieChoices[color],selected=!voters.length?this.defaultBook(color):leaders.length===1?leaders[0]:choice?.key===key&&leaders.includes(choice.set)?choice.set:null;return {color,name:NAMES[color],candidates:sets.map(set=>({...book(color,set,this.options.witches),set})),votes,counts,leaders,selected,key,tied:selected===null};});
 }
 setFor(color){return this.activeBooks?.[color]??this.defaultBook(color);}
 bookFor(color){return book(color,this.setFor(color),this.options.witches);}
 index(n){const i=this.rng(n);if(!Number.isInteger(i)||i<0||i>=n)throw Error('無效亂數');return i;}
 chip(color,value=1){return {id:randomUUID(),color,value};}
 grant(p,color,value=1){const chip=this.chip(color,value);if(color==='black'&&this.setFor('black')===5){const left=this.players[(this.players.indexOf(p)+1)%this.players.length];left.bag.push(chip);p.droplet=Math.min(LAST,p.droplet+1);}else p.bag.push(chip);}
 start(){
  if(!this.options.witches&&this.activePlayers().length>4)fail('NEED_EXPANSION','五人局須開啟草藥女巫');const selection=this.bookSelection();if(selection.some(c=>c.tied))fail('BOOK_TIE','藥材書平票，請房主先選擇平票的書面');this.activeBooks=Object.fromEntries(selection.map(c=>[c.color,c.selected]));this.options.books=clone(this.activeBooks);this.prepare();this.quacksAchievements.start();this.roundLimit=9;
  this.deck=FORTUNES.concat(this.expansionFortunes()).map(x=>x.id);this.witches=this.options.witches?Object.fromEntries(Object.entries(WITCHES).map(([color,items])=>[color,items[this.index(items.length)]])):{};
  for(const p of this.players){Object.assign(p,{bag:[],pot:[],overflow:[],reserve:[],startChips:[],bagPeekUsed:false,bagPeek:null,potName:p.potName||p.name+'的好運釜',droplet:0,rubies:1,potion:true,coins:{gold:true,copper:true,silver:true}});
   for(let i=0;i<4;i++)p.bag.push(this.chip('white',1));for(let i=0;i<2;i++)p.bag.push(this.chip('white',2));p.bag.push(this.chip('white',3),this.chip('orange',1),this.chip('green',1));
  }if(this.options.alchemists)this.initAlchemy();else{this.patientChoices=[];this.players.forEach(p=>delete p.alchemy);this.nextRound();}
 }
 drawOne(p){return p.bag.length?p.bag.splice(this.index(p.bag.length),1)[0]:null;}
 look(p,count){const out=[];while(out.length<count&&p.bag.length)out.push(this.drawOne(p));return out;}
 queue(p,title,options){if(!options.length)return;const q={id:randomUUID(),title,color:this.phase==='settlement'&&this.stage==='effects'?(title.startsWith(NAMES.green)?'green':title.startsWith(NAMES.purple)?'purple':'fortune'):null,options:options.map((o,i)=>({id:String(i),...o}))};p.pending.push(q);}
 option(label,ops){return {label,ops};}
 selectChip(p,title,candidates,op,extra={},skip=true){
  this.queue(p,title,[...candidates.map(c=>this.option(label(c),[{op,...extra,chipId:c.id}])),...(skip?[this.option('略過',[])]:[])]);
 }
 setPosition(p,n){p.position=Math.min(LAST,n);if(p.pot.length)p.pot.at(-1).position=p.position;}
 white(p){return [...p.pot,...p.overflow,...p.reserve.filter(c=>c.must)].filter(c=>c.color==='white').reduce((n,c)=>n+c.value,0);}
 threshold(p){let t=this.fortune?.id==='living'?9:7;if(this.setFor('yellow')===3){const n=p.pot.filter(c=>c.effectColor==='yellow').length;t=Math.max(t,n>=3?9:n>=1?8:7);}return t;}
 exploded(p){if(this.options.alchemists&&this.stage==='essence'&&p.alchemy?.distilling)return;if(this.white(p)>this.threshold(p)&&!p.exploded){p.exploded=true;p.stopped=true;p.explosionId=randomUUID();this.quacksAchievements.explosion(p);this.event('explosion',p.name+' 的大釜爆炸！');}}
 remove(p,id,toBag=true){for(const area of ['pot','overflow','reserve']){const i=p[area].findIndex(c=>c.id===id);if(i>=0){const c=p[area].splice(i,1)[0];if(toBag){delete c.position;delete c.effectColor;delete c.effectValue;delete c.must;p.bag.push(c);}return c;}}return null;}
 availableBooks(){return Object.keys(NAMES).filter(c=>c!=='white'&&(c!=='yellow'||this.round>=2)&&(c!=='purple'||this.round>=3)&&(c!=='locoweed'||this.options.witches||this.options.alchemists)).map(c=>this.bookFor(c));}
 gifts(p,title,value,filter=()=>true){const offers=Object.keys(NAMES).filter(c=>c!=='white'&&(c!=='locoweed'||this.options.witches||this.options.alchemists)).map(c=>this.bookFor(c)).filter(filter).flatMap(b=>b.offers.filter(o=>o.value===value).map(o=>({color:b.color,value:o.value})));this.queue(p,title,offers.map(o=>this.option(label(o),[{op:'grant',...o}])));}
 roll(p,sourceOverride){const n=this.index(6);if(n<3)p.score+=n===2?2:1;else if(n===3)p.rubies++;else if(n===4)p.droplet=Math.min(LAST,p.droplet+1);else this.grant(p,'orange',1);p.dice.push(n);const source=sourceOverride||(this.stage==='bonus'?'獎勵骰':this.phase==='settlement'?'花園蜘蛛':'占卜牌');this.rollEvents.push({id:randomUUID(),playerId:p.id,name:p.name,potName:p.potName,face:n,source,round:this.round,at:this.now()});this.rollEvents=this.rollEvents.slice(-64);this.event('dice',p.name+' 擲出 '+['1 分','1 分','2 分','紅寶石','液滴前進','南瓜'][n]);return n;}

 nextRound(){
  this.visitingWitch=null;this.rollEvents=[];this.alchemyDraws={};this.round++;this.roundId=randomUUID();this.step=1;this.phase='fortune';this.stage='draw-card';this.intents={};this.fortune=null;this.fortuneRevealId=null;this.fortuneDrawnAt=null;this.roundStarterId=this.players[(this.round-1)%this.players.length].id;this.advanceStep=false;
  for(const p of this.players){
   Object.assign(p,{goodNeighborUsed:false,visitorUsed:false,freeCheap:false,returnCoinDone:false,fortuneSettlementApplied:false,bagPeekUsed:false,bagPeek:null,pending:[],stopped:false,exploded:false,explosionId:null,draws:0,position:p.droplet,roundStartPosition:p.droplet,rat:0,protect:0,doubleNext:false,secondUsed:false,firstWhite:false,strongDone:false,reserveDone:false,fullBenefits:false,settlementChoice:null,ready:false,budget:0,bought:[],discount:2,dice:[],bonusDice:[],bonusEligible:false,bonusRolled:false,silverRuby:false,copyUsed:false,effectSummary:[]});
   if(this.round===6)p.bag.push(this.chip('white',1));
  }
  this.event('round','第 '+this.round+' 回合：等 '+this.player(this.roundStarterId).name+' 抽占卜牌。');
 }
 drawFortune(){
  const fortuneId=this.deck.splice(this.index(this.deck.length),1)[0];this.fortune=FORTUNES.concat(ExpansionFortunes.FORTUNES).find(f=>f.id===fortuneId);this.fortuneRevealId=randomUUID();this.fortuneDrawnAt=this.now();this.phase='brewing';this.stage='prepare';
  const best=Math.max(...this.players.map(p=>p.score));for(const p of this.players){const tails=Math.max(0,Math.floor((best-1)/2)-Math.floor(Math.max(0,p.score-1)/2));p.rat=tails*(this.fortune.id==='rats'?2:1)+(this.options.alchemists?p.alchemy.nextRat:0);if(this.options.alchemists)p.alchemy.nextRat=0;p.position=Math.min(LAST,p.droplet+p.rat);}
  this.applyFortune();this.event('fortune',this.player(this.roundStarterId).name+' 抽到 '+this.fortune.name);this.advance();
 }
 applyFortune(){
  if(this.applyExpansionFortune())return;
  const f=this.fortune.id,min=Math.min(...this.players.map(p=>p.score)),rubyMin=Math.min(...this.players.map(p=>p.rubies));
  if(f==='less'){const seen=this.players.map(p=>({p,chips:this.look(p,5)}));const low=Math.min(...seen.map(s=>s.chips.reduce((n,c)=>n+c.value,0)));for(const s of seen){s.p.bag.push(...s.chips);if(s.chips.reduce((n,c)=>n+c.value,0)===low)this.grant(s.p,'blue',2);else s.p.rubies++;}return;}
  for(const p of this.players){
   if(f==='donations')this.roll(p);
   if(f==='beginner'&&p.score===min)this.grant(p,'green',1);
   if(f==='alms'&&p.rubies===rubyMin)p.rubies++;
   if(f==='filling'){p.droplet=Math.min(LAST,p.droplet+1);p.position=Math.min(LAST,p.droplet+p.rat);}
   if(f==='time'){const c=p.bag.find(c=>c.color==='white'&&c.value===1);this.queue(p,'正逢其時',[this.option('獲得 4 分',[{op:'score',amount:4}]),...(c?[this.option('永久移除白色炸彈 1',[{op:'discardBag',chipId:c.id}])]:[])]);}
   if(f==='wise')this.queue(p,'明智選擇',[this.option('液滴前進 2 格',[{op:'droplet',amount:2}]),this.option('紫色 1',[{op:'grant',color:'purple',value:1}])]);
   if(f==='choose'){const offers=Object.keys(NAMES).filter(c=>!['white','locoweed'].includes(c)).flatMap(c=>this.bookFor(c).offers.filter(o=>o.value===2).map(o=>this.option(label({color:c,value:2}),[{op:'grant',color:c,value:2}])));this.queue(p,'只能選一個',[this.option('黑色 1',[{op:'grant',color:'black',value:1}]),...offers,this.option('3 顆紅寶石',[{op:'ruby',amount:3}])]);}
   if(f==='deal'&&p.rubies)this.queue(p,'投機取巧',[...['orange','blue','red','yellow','green'].map(color=>this.option(label({color,value:1}),[{op:'ruby',amount:-1},{op:'grant',color,value:1}])),this.option('保留紅寶石',[])]);
   if(f==='friends')for(let i=0;i<p.rat;i++)this.queue(p,'老鼠好朋友 '+(i+1),[this.option('1 分',[{op:'score',amount:1}]),...['blue','red','yellow','green'].map(color=>this.option(label({color,value:4}),[{op:'grant',color,value:4}]))]);
   if(f==='start'&&p.rat)this.queue(p,'好的開始',[this.option('照常推進老鼠石',[]),...[1,2,3].filter(n=>n<=p.rat).map(n=>this.option('放棄 '+n+' 條老鼠尾換紅寶石',[{op:'ratTrade',amount:n}]))]);
   if(f==='opportunity'){
    const chips=this.look(p,4);p.bag.push(...chips);const candidates=chips.filter(c=>c.color!=='orange'&&[1,2].includes(c.value)&&!['white','black','purple','locoweed'].includes(c.color));
    this.selectChip(p,'鹹魚翻身：選一片升級',candidates,'fortuneUpgrade');
   }
  }
 }
 place(p,c,{noEffect=false,safe=false,fromReserve=false,alchemyHandled=false,moveOverride=null,jumpRuby=false}={}){
  const wasStopped=p.stopped,distilling=this.options.alchemists&&this.stage==='essence'&&p.alchemy?.distilling;safe=!!(safe||distilling);
  if(this.beforeAlchemyPlace(p,c,{noEffect,safe,fromReserve,alchemyHandled}))return;
  if(p.exploded&&!fromReserve&&!distilling){p.bag.push(c);return;}
  if(this.fortune.id==='stirred'&&c.color==='white'&&!p.firstWhite){p.firstWhite=true;p.bag.push(c);return;}
  delete c.noEffect;if(noEffect)c.noEffect=true;let color=c.color,value=c.value,previous=p.pot.at(-1);
  if(color==='locoweed'){
   if(this.setFor('locoweed')===6){const last=[...p.pot].reverse().find(x=>x.color!=='white');color=last?.effectColor||last?.color||'locoweed';value=last?.effectValue||last?.value||1;}
   else if(this.setFor('locoweed')===5)value=Math.min(4,p.rat+1);
  }
  const set=this.setFor(color);c.effectColor=color;c.effectValue=value;
  if(p.position>=LAST){p.overflow.push(c);if(!safe)this.exploded(p);return;}
  if(color==='red'&&set===2&&!fromReserve&&!noEffect){c.reserveRound=this.round;p.reserve.push(c);return;}
  let move=moveOverride??value;
  if(c.color==='locoweed'&&set>=7){move=set===8?new Set([...p.pot.filter(x=>x.color!=='white').map(x=>x.color),'locoweed']).size:set===10?Math.max(1,p.pot.filter(x=>x.color==='white').reduce((n,x)=>n+x.value,0)):1;}
  if(color==='orange'&&this.fortune.id==='pumpkin')move++;
  if(!noEffect){
   if(color==='red'&&set===1){const count=p.pot.filter(x=>x.effectColor==='orange').length;move+=count>=3?2:count?1:0;}
   if(color==='red'&&set===3&&previous?.color==='white')move+=previous.value;
   if(color==='red'&&set===5)move=Math.max(value,...p.pot.filter(x=>x.effectColor==='red').map(x=>x.effectValue));
   if(color==='white'&&value===1&&this.setFor('red')===4&&p.pot.some(x=>x.effectColor==='red'))move=2;
   if(color==='yellow'&&set===4){const count=p.pot.filter(x=>x.effectColor==='yellow').length+1;if(count<=3)move+=count;}
   if(color==='yellow'&&set===5){const extra=this.drawOne(p);if(extra){move+=extra.color==='locoweed'?1:extra.value;p.bag.push(extra);}}
   if(p.doubleNext){move*=2;p.doubleNext=false;}
  }
  const protection=p.protect>0;if(p.protect)p.protect--;
  c.fromPosition=p.position;c.position=jumpRuby?(BOARD.find(x=>x.ruby&&x.position>p.position&&x.position<=LAST)?.position??LAST):Math.min(LAST,p.position+move);p.position=c.position;p.pot.push(c);
  if(!safe)this.exploded(p);if(p.exploded&&protection)p.fullBenefits=true;
  if(!this.options.witches&&p.position>=LAST)p.stopped=true;if(noEffect)return;
  if(color==='blue'){
   if(set===1&&(!p.exploded||distilling)&&p.position<LAST){const chips=this.look(p,value);this.queue(p,'烏鴉頭骨：最多放入一片',[...chips.map(x=>this.option(label(x),[{op:'lookPlace',chip:x,others:chips.filter(c=>c.id!==x.id)}])),this.option('全部放回',[{op:'returnLook',chips}])]);}
   if(set===2&&p.position<LAST)p.protect=Math.max(p.protect,value);
   if(set===3&&BOARD[c.position].ruby)p.rubies++;
   if(set===4&&BOARD[c.position].ruby)p.score+=value;
   if(set===5&&p.pot.slice(0,-1).filter(x=>x.effectColor==='orange').length>=value)p.score+=value;
   if(set===6)p.rubies+=p.pot.slice(0,-1).slice(-value).filter(x=>x.color==='white'&&x.value===1).length;
  }
  if(color==='yellow'){
   if(set===1&&previous?.color==='white')this.queue(p,'曼德拉草：收回前一片白色炸彈？',[this.option('放回藥袋',[{op:'remove',chipId:previous.id}]),this.option('保留',[])]);
   if(set===2&&p.position<LAST)p.doubleNext=true;
   if(set===6&&p.rubies)this.queue(p,'曼德拉草：付 1 顆紅寶石額外前進 3 格？',[this.option('支付',[{op:'ruby',amount:-1},{op:'move',amount:3}]),this.option('略過',[])]);
  }
  if(color==='red'&&set===6&&p.position<LAST){const extra=this.drawOne(p);if(extra){extra.must=true;extra.reserveRound=this.round;p.reserve.push(extra);this.exploded(p);}}
  if(c.color==='locoweed'&&set===9)this.selectChip(p,'愚人草：收回一片彩色藥材',p.pot.filter(x=>x.color!=='white'),'remove');
  this.afterAlchemyPlace(p,c,{wasStopped,noEffect});
  if(this.phase==='brewing'&&this.fortune.id==='second'&&p.pot.length===5&&!p.secondUsed&&!p.exploded){p.secondUsed=true;this.queue(p,'第二機會：重新開始本輪？',[this.option('保留目前藥材',[]),this.option('重新開始',[{op:'restart'}])]);}
 }
 operate(p,o){
  if(o.op.startsWith('exp'))return this.expansionOperate(p,o);
  if(o.op.startsWith('alchemy'))return this.alchemyOperate(p,o);
  if(o.op==='score')p.score+=o.amount;
  else if(o.op==='ruby')p.rubies+=o.amount;
  else if(o.op==='droplet'){p.droplet=Math.min(LAST,p.droplet+o.amount);if(this.stage==='prepare')p.position=Math.min(LAST,p.droplet+p.rat);}
  else if(o.op==='grant')this.grant(p,o.color,o.value);
  else if(o.op==='remove')this.remove(p,o.chipId);
  else if(o.op==='discardBag')p.bag=p.bag.filter(c=>c.id!==o.chipId);
  else if(o.op==='ratTrade'){p.rat-=o.amount;p.rubies+=o.amount;p.position=Math.min(LAST,p.droplet+p.rat);}
  else if(o.op==='move')this.setPosition(p,p.position+o.amount);
  else if(o.op==='returnLook')p.bag.push(...o.chips);
  else if(o.op==='lookPlace'){p.bag.push(...o.others);this.place(p,o.chip,{noEffect:!!o.noEffect,safe:!!o.safe});}
  else if(o.op==='fortuneUpgrade'){const c=p.bag.find(c=>c.id===o.chipId);if(c){c.value=c.value===1?2:4;this.grant(p,'black',1);}}
  else if(o.op==='restart'){p.bag.push(...p.pot,...p.overflow,...p.reserve.filter(c=>c.reserveRound===this.round));p.reserve=p.reserve.filter(c=>c.reserveRound!==this.round);p.pot=[];p.overflow=[];p.position=p.roundStartPosition;p.protect=0;p.doubleNext=false;p.firstWhite=false;p.stopped=false;p.exploded=false;p.explosionId=null;}
  else if(o.op==='purpleReward'){if(o.count===1)p.score++;else if(o.count===2){p.score++;p.rubies++;}else{p.score+=2;p.droplet=Math.min(LAST,p.droplet+1);}}
  else if(o.op==='purpleTrade'){
   let n=o.count;for(const c of [...p.pot])if(n&&c.effectColor==='purple'){this.remove(p,c.id,false);n--;}
   if(o.count===1){this.grant(p,'black',1);p.score++;p.rubies++;}
   if(o.count===2){this.grant(p,'green',1);this.grant(p,'blue',2);p.score+=3;p.droplet=Math.min(LAST,p.droplet+1);}
   if(o.count===3){this.grant(p,'yellow',4);p.score+=6;p.rubies++;p.droplet=Math.min(LAST,p.droplet+2);}
  }
  else if(o.op==='upgrade'){const c=this.remove(p,o.chipId,false);if(c)this.grant(p,c.color,o.value);}
  else if(o.op==='retain'){const c=this.remove(p,o.chipId,false);if(c)p.startChips.push(c);}
  else if(o.op==='extraBuy')this.grant(p,o.color,o.value);
  else fail('INVALID_EFFECT','未知藥材效果');
  if(p.rubies<0)fail('NOT_ENOUGH_RUBIES','紅寶石不足');
 }
 hasPending(){return this.players.some(p=>p.pending.length);}
 advance(){
  if(this.hasPending())return;
  if(this.phase==='settlement'&&this.stage==='essence'){this.advanceAlchemy();return;}
  if(this.phase==='brewing'){
   if(this.stage==='prepare'){this.stage='starting-chips';this.prepareAlchemy();for(const p of this.players){p.position=Math.min(LAST,p.droplet+p.rat);p.roundStartPosition=p.position;for(const c of p.startChips.splice(0))this.place(p,c);}if(this.hasPending())return;}if(this.stage==='starting-chips')this.stage='drawing';
   if(this.advanceStep){this.step++;this.intents={};this.advanceStep=false;}
   for(const p of this.players)if(!p.bag.length&&!p.alchemy?.pool.some(c=>!(c.color==='red'&&this.setFor('red')===2)))p.stopped=true;
   if(this.players.every(p=>p.stopped)){
    if(this.fortune.id==='strong'){for(const p of this.players)if(!p.exploded&&!p.strongDone){p.strongDone=true;const chips=this.look(p,5);if(chips.length)this.queue(p,'強效碎片：選一片（不執行效果且不會爆炸）',chips.map(c=>this.option(label(c),[{op:'lookPlace',chip:c,others:chips.filter(x=>x.id!==c.id),noEffect:true,safe:true}])));}if(this.hasPending())return;}const reserves=this.players.some(p=>(p.reserve.length||p.alchemy?.pool.some(c=>c.color==='red'&&this.setFor('red')===2))&&!p.reserveDone);if(reserves){this.stage='reserves';return;}this.beginSettlement();
   }
  }else if(this.phase==='settlement'&&this.stage==='effects'){this.stage='effects-confirm';for(const p of this.players){const before=p.effectsBefore;p.effectSummary.push({color:'summary',text:'本階段合計：分數 '+(p.score-before.score)+'、紅寶石 '+(p.rubies-before.rubies)+'、液滴 +'+(p.droplet-before.droplet)+' 格。'});p.ready=false;}}
 }
 beginSettlement(){this.expansionBeforeSettlement();this.phase='settlement';this.stage='witches';this.intents={};this.players.forEach(p=>p.ready=false);this.event('settlement','全員已停止或爆炸，公開大釜，準備結算。');}

 beginBonus(){
  this.stage='bonus';const eligible=this.players.filter(p=>!p.exploded||p.goldAll),best=Math.max(...eligible.map(p=>p.position));for(const p of this.players){p.ready=false;p.bonusEligible=eligible.includes(p)&&p.position===best;p.bonusRolled=false;p.bonusDice=[];}this.event('bonus','獎勵骰階段：符合資格的玩家親自擲骰。');
 }
 effectSnapshot(p){return {score:p.score,rubies:p.rubies,droplet:p.droplet,position:p.position,bag:p.bag.map(c=>c.id),starts:p.startChips.length,extraBudget:p.extraBudget||0};}
 effectRecord(p,color,before,choice){
  const changes=[];for(const [key,name]of [['score','分數'],['rubies','紅寶石'],['droplet','液滴'],['position','大釜格位'],['extraBudget','獨立購物預算']]){const n=(p[key]||0)-before[key];if(n)changes.push(name+' '+(n>0?'+':'')+n);}
  const gifts=p.bag.filter(c=>!before.bag.includes(c.id));if(gifts.length)changes.push('獲得 '+gifts.map(label).join('、'));
  if(p.startChips.length>before.starts)changes.push('保留 '+(p.startChips.length-before.starts)+' 片下輪起始藥材');
  p.effectSummary.push({color,text:(choice?choice+'：':'')+(changes.length?changes.join('；'):'未觸發額外獎勵或選擇保留。')});
 }
 beginEffects(){
  this.stage='effects';for(const p of this.players){p.ready=false;p.effectsBefore={score:p.score,rubies:p.rubies,droplet:p.droplet};p.effectSummary=['black','green','purple'].map(color=>({color,text:NAMES[color]+' · 第 '+this.setFor(color)+' 面：'+this.bookFor(color).effect}));}const blackBefore=this.players.map(p=>this.effectSnapshot(p)),blackSet=this.setFor('black');

  if(blackSet<=4){const counts=this.players.map(p=>p.pot.filter(c=>c.effectColor==='black'&&!c.noEffect).length);for(let i=0;i<this.players.length;i++){const p=this.players[i],count=counts[i];if(!count)continue;if(this.players.length===2){if(count>=counts[1-i])p.droplet=Math.min(LAST,p.droplet+1);if(count>counts[1-i])p.rubies++;}else{const left=counts[(i+1)%counts.length],right=counts[(i+counts.length-1)%counts.length];if(count>left||count>right)p.droplet=Math.min(LAST,p.droplet+1);if(count>left&&count>right)p.rubies++;}}}
  if(blackSet===5)for(let i=0;i<this.players.length;i++){const p=this.players[i],left=this.players[(i+1)%this.players.length];p.rubies+=left.pot.filter(c=>c.effectColor==='black'&&!c.noEffect).length;left.rubies+=left.pot.slice(-2).filter(c=>c.effectColor==='black'&&!c.noEffect).length;}
  if(blackSet===6){const chips=this.players.flatMap(p=>p.pot.filter(c=>c.effectColor==='black'&&!c.noEffect).map(c=>({p,pos:c.position}))).sort((a,b)=>b.pos-a.pos);if(chips.length){const top=chips[0].pos,second=chips[1]?.pos;for(const p of new Set(chips.filter(c=>c.pos===top).map(c=>c.p)))p.droplet=Math.min(LAST,p.droplet+1);if(second!==undefined)for(const p of new Set(chips.filter(c=>c.pos===second).map(c=>c.p)))p.rubies++;}}
  this.players.forEach((p,i)=>this.effectRecord(p,'black',blackBefore[i]));
  for(const p of this.players){
   const greenBefore=this.effectSnapshot(p),greens=p.pot.slice(-2).filter(c=>c.effectColor==='green'&&!c.noEffect),purple=p.pot.filter(c=>c.effectColor==='purple'&&!c.noEffect);
   const greenSet=this.setFor('green'),purpleSet=this.setFor('purple');
   for(const g of greens){
    if(greenSet===1)p.rubies++;
    if(greenSet===2){const colors=g.effectValue===1?['orange']:g.effectValue===2?['blue','red']:['yellow','purple'];this.queue(p,'花園蜘蛛：取得一片',[...colors.map(color=>this.option(label({color,value:1}),[{op:'grant',color,value:1}]))]);}
    if(greenSet===4&&p.rubies)this.queue(p,'花園蜘蛛：付 1 顆紅寶石推進液滴？',[this.option('支付',[{op:'ruby',amount:-1},{op:'droplet',amount:1}]),this.option('略過',[])]);
    if(greenSet===5&&this.round<9)this.selectChip(p,'花園蜘蛛：保留下輪起始藥材',p.pot.filter(c=>c.value<=g.effectValue&&!p.startChips.some(x=>x.id===c.id)),'retain');
    if(greenSet===6)for(let i=0;i<(this.fortune.id==='full'?2:1);i++)this.roll(p);
   }
   if(greenSet===3&&this.white(p)===7)this.setPosition(p,p.position+p.pot.filter(c=>c.effectColor==='green'&&!c.noEffect).reduce((n,c)=>n+c.effectValue,0));
   this.effectRecord(p,'green',greenBefore);const purpleBefore=this.effectSnapshot(p);
   if(purple.length&&purpleSet===1)this.queue(p,'幽靈氣息：選一組獎勵',[1,2,3].filter(n=>n<=purple.length).map(n=>this.option(n===1?'1 分':n===2?'1 分及 1 顆紅寶石':'2 分及液滴前進 1 格',[{op:'purpleReward',count:n}])));
   if(purple.length&&purpleSet===2)this.queue(p,'幽靈氣息：永久棄掉紫色換一組獎勵',[this.option('不交換',[]),...[1,2,3].filter(n=>n<=purple.length).map(n=>this.option('棄 '+n+' 片換獎勵',[{op:'purpleTrade',count:n}]))]);
   if(purpleSet===3)for(const c of purple)p.score+=Math.min(3,Math.floor(BOARD[c.position].coins/10));
   if(purple.length&&purpleSet===4){const count=purple.length,upgrades=[[1,2],[2,4],[1,4]].slice(0,Math.min(3,count));this.queue(p,'幽靈氣息：選一片升級',[this.option('不升級',[]),...upgrades.flatMap(([from,to])=>p.pot.filter(c=>c.value===from&&!['orange','white','black','purple','locoweed'].includes(c.color)).map(c=>this.option(label(c)+' → '+to,[{op:'upgrade',chipId:c.id,value:to}]))) ]);}
   if(purpleSet===5&&purple.length){const budget=purple.reduce((n,c)=>n+BOARD[c.position].points,0);p.extraBudget=budget;p.extraBought=[];if(this.round===9)p.score+=Math.floor(budget/5);}
   if(purpleSet===6)for(let i=0;i<p.pot.length-1;i++)if(p.pot[i].effectColor==='purple'&&!p.pot[i].noEffect)p.score+=p.pot[i+1].effectValue;
   this.effectRecord(p,'purple',purpleBefore);
   if(this.fortune.id==='seasoned'&&this.white(p)===7)p.droplet=Math.min(LAST,p.droplet+1);
   if(this.fortune.id==='malicious'&&p.exploded)this.gifts(this.players[(this.players.indexOf(p)+1)%this.players.length],'幸災樂禍：左鄰爆炸獎勵',2);
  }this.advance();
 }
 field(p){return p.position>=LAST?Spoon:BOARD[Math.min(LAST+1,p.position+1)];}
 rewardPhase(){this.stage='rewards';for(const p of this.players){const field=this.field(p);p.field=field;if(field.ruby){const reward=p.silverRuby?field.points:this.fortune.id==='shining'?2:1;p.rubies+=reward;if(this.fortune.id==='lucky')p.score+=2;}p.ready=false;}}
 enterShopping(){
  this.stage='shopping';for(const p of this.players){
   const both=!p.exploded||p.fullBenefits||p.goldAll;p.canBuy=both||p.settlementChoice==='buy';p.canScore=both||p.settlementChoice==='score';
   const overflow=this.options.witches?Math.floor(p.overflow.reduce((n,c)=>n+c.effectValue,0)/2):0;
   if(p.canScore)p.score+=p.field.points+overflow;
   p.budget=p.canBuy?p.field.coins:0;this.expansionShopping(p);p.ready=false;
  }
 }
 endRound(){
  const detail=this.players.map(p=>({id:p.id,name:p.name,score:p.score,exploded:p.exploded,position:p.position,field:p.field,draws:p.draws,...(this.options.alchemists?{alchemy:{patientId:p.alchemy.patientId,essence:p.alchemy.essence,calculation:clone(p.alchemy.calculation)}}:{}),pot:clone(p.pot),overflow:clone(p.overflow),bought:clone(p.bought),rubies:p.rubies,dice:p.dice.slice()}));
  if(this.round===9){
   for(const p of this.players){p.score+=Math.floor(p.rubies/2)+(this.options.witches?Object.values(p.coins).filter(Boolean).length*2:0);p.rubies%=2;}
   for(const d of detail)d.score=this.player(d.id).score;this.results.push({round:this.round,fortune:this.fortune,players:detail});
   const score=Math.max(...this.players.map(p=>p.score)),tied=this.players.filter(p=>p.score===score),position=Math.max(...tied.map(p=>p.position));
   this.winner={score,names:tied.filter(p=>p.position===position).map(p=>p.name)};this.phase='finished';this.quacksAchievements.finish();this.event('finish','九回合完成。');return;
  }
  this.results.push({round:this.round,fortune:this.fortune,players:detail});
  for(const p of this.players){if(this.options.alchemists){p.bag.push(...p.alchemy.pool);p.alchemy.pool=[];}p.bag.push(...p.pot,...p.overflow);p.pot=[];p.overflow=[];p.goldAll=false;p.extraBudget=0;if(this.fortune.id==='potion')p.potion=true;}
  this.phase='between';this.event('round-end','本回合結算完成，等房主開始下一回合。');
 }

 witchAllowed(p,color){
  const w=this.witches[color];if(!w||!p.coins[color]||p.ready||p.pending.length||Object.hasOwn(this.intents,p.id))return false;
  if(color==='gold'){
   if(w.id==='all')return this.phase==='settlement'&&this.stage==='witches';
   if(w.id==='rescue')return p.exploded&&p.potion&&(this.phase==='brewing'||this.phase==='settlement'&&this.stage==='witches')&&p.pot.at(-1)?.color==='white';
   return this.phase==='brewing'&&['drawing','reserves'].includes(this.stage)&&!p.exploded&&(w.id==='white'||!p.stopped&&this.stage==='drawing');
  }
  if(color==='silver'&&w.id==='ruby')return this.phase==='settlement'&&this.stage==='witches'&&this.field(p).ruby;
  if(color==='silver'&&['colors','bag'].includes(w.id))return this.phase==='settlement'&&this.stage==='rewards';
  if(color==='silver'&&w.id==='discount')return this.phase==='settlement'&&this.stage==='shopping';
  if(color==='copper')return this.phase==='settlement'&&this.stage==='shopping'&&(w.id==='upgrade'||p.canBuy)&&(w.id!=='copy'||p.bought.length>0)&&(w.id!=='rubies'||p.rubies>0);
  return false;
 }
 sixQueue(p){if(!p.sixPool.length)return;this.queue(p,'六選自由配：選下一片或結束',[...p.sixPool.map(c=>this.option(label(c),[{op:'sixPick',chipId:c.id}])),this.option('其餘全部放回',[{op:'sixEnd'}])]);}
 useWitch(p,color,free=false){
  if(!this.witchAllowed(p,color))fail('WITCH_UNAVAILABLE','現在無法使用這位女巫');
  const w=this.witches[color];if(!free){p.coins[color]=false;this.quacksAchievements.witch(p,color);}
  if(w.id==='rescue'){
   const returned=this.remove(p,p.pot.at(-1).id);p.position=returned.fromPosition??p.pot.at(-1)?.position??Math.min(LAST,p.droplet+p.rat);p.potion=false;p.exploded=false;p.stopped=false;p.explosionId=null;
   if(this.phase==='settlement'){this.phase='brewing';this.stage='drawing';this.players.forEach(q=>q.ready=false);this.step++;this.intents={};}
  }
  if(w.id==='white'){const candidates=[...p.pot].reverse().filter(c=>c.color==='white').slice(0,2);this.queue(p,'清除白色炸彈',[...candidates.map(c=>this.option('收回 '+label(c),[{op:'remove',chipId:c.id}])),...(candidates.length===2?[this.option('收回兩片',[...candidates.map(c=>({op:'remove',chipId:c.id}))])]:[]),this.option('不收回',[])]);}
  if(w.id==='six'){p.sixPool=this.look(p,6);this.sixQueue(p);}
  if(w.id==='all'){p.goldAll=true;p.fullBenefits=true;}
  if(w.id==='double')p.budget*=2;
  if(w.id==='rubies')p.budget+=p.rubies*2;
  if(w.id==='copy')this.queue(p,'再來一片',[...p.bought.map(c=>this.option(label(c),[{op:'grant',color:c.color,value:c.value}]))]);
  if(w.id==='upgrade'){
   const eligible=p.pot.filter(c=>[1,2].includes(c.value)&&!['orange','white','black','purple','locoweed'].includes(c.color)),last=p.pot.slice(-2).filter(c=>eligible.includes(c));
   this.queue(p,'藥材升級',[...eligible.map(c=>this.option(label(c)+' 升一階',[{op:'upgrade',chipId:c.id,value:c.value===1?2:4}])),...(last.length===2?[this.option('最後兩片一起升級',last.map(c=>({op:'upgrade',chipId:c.id,value:c.value===1?2:4})))]:[]),this.option('不升級',[])]);
  }
  if(w.id==='colors'){const n=new Set(p.pot.map(c=>c.color).filter(c=>c!=='white')).size;p.score+=n===0?0:n<=4?3:n===5?4:n===6?7:n===7?10:14;}
  if(w.id==='bag')p.score+=2*p.bag.filter(c=>c.color!=='white'&&([2,4,6].includes(c.value)||['purple','locoweed'].includes(c.color))).length;
  if(w.id==='ruby')p.silverRuby=true;
  if(w.id==='discount')p.discount=1;
  this.event('witch',p.name+' 使用'+w.name);this.advance();
 }
 act(id,action,data={}){return this.command(id,action,data,p=>{
  if(this.interrupted)fail('MATCH_INTERRUPTED','本場已中止');
  if(this.alchemyAct(p,action,data)||this.expansionAct(p,action))return;

  if(action==='color-pot'){if(!Object.hasOwn(POT_COLORS,data.color))fail('INVALID_COLOR','請選有效的藥鍋顏色',400);if(this.activePlayers().some(q=>q.id!==id&&q.potColor===data.color))fail('COLOR_TAKEN','這個顏色已被別人選走');p.potColor=data.color;this.event('pot-color',p.name+' 選擇'+POT_COLORS[data.color].name+'大釜');return;}
  if(action==='book-random'){
   if(!['waiting','finished'].includes(this.phase))fail('MATCH_STARTED','開局後不能變更藥材書');if(p.bot)fail('HUMANS_ONLY','測試 AI 不參與配書',403);
   const rows=this.bookSelection().filter(row=>data.color===undefined||row.color===data.color);if(!rows.length)fail('INVALID_BOOK','沒有這個藥材色',400);
   for(const row of rows){this.bookVotes[id]={...(this.bookVotes[id]||{}),[row.color]:row.candidates[this.index(row.candidates.length)].set};delete this.bookTieChoices[row.color];}
   this.event('book-random',p.name+' 隨機挑選藥材書');return;
  }
  if(action==='name-pot'){const name=text(data.name,24);if(!name)fail('INVALID_NAME','大釜名稱不能空白',400);p.potName=name;this.event('pot-name',p.name+' 的大釜改名為「'+name+'」');return;}
  if(action==='peek-bag'){
   if(!p.bag||['waiting','patients','finished'].includes(this.phase))fail('INVALID_PHASE','開局後才能查看藥袋');
   if(p.bot)fail('HUMANS_ONLY','測試 AI 不使用查看藥袋',403);
   if(data.targetId&&data.targetId!==id)fail('OWN_BAG_ONLY','只能查看自己的藥袋',403);
   if(p.bagPeekUsed)fail('PEEK_USED','本回合只能查看一次');
   p.bagPeekUsed=true;p.bagPeek={id:randomUUID(),round:this.round,chips:p.bag.map(c=>({color:c.color,value:c.value}))};this.event('bag-peek',p.name+' 使用本回合一次的藥袋查看');return;
  }
  if(action==='close-bag'){if(!p.bagPeek)fail('PEEK_CLOSED','藥袋內容已關閉');p.bagPeek=null;this.event('bag-close',p.name+' 關閉藥袋查看');return;}
  if(action==='book-vote'||action==='book-tie'){
   if(!['waiting','finished'].includes(this.phase))fail('MATCH_STARTED','開局後不能變更藥材書');
   const row=this.bookSelection().find(b=>b.color===data.color);if(!row||!row.candidates.some(b=>b.set===data.set))fail('INVALID_BOOK','此藥材書未開放',400);
   if(action==='book-vote'){if(p.bot)fail('HUMANS_ONLY','測試 AI 不參與藥材書投票',403);this.bookVotes[id]={...(this.bookVotes[id]||{}),[data.color]:data.set};delete this.bookTieChoices[data.color];this.event('book-vote',p.name+' 選擇 '+row.name+' 第 '+data.set+' 面');}
   else{if(id!==this.host)fail('HOST_ONLY','只有房主可處理平票',403);if(!row.tied||!row.leaders.includes(data.set))fail('INVALID_TIE','只能選平票候選面');this.bookTieChoices[data.color]={set:data.set,key:row.key};this.event('book-tie','房主選擇 '+row.name+' 第 '+data.set+' 面');}
   return;
  }
  if(action==='draw-fortune'){if(this.phase!=='fortune')fail('INVALID_PHASE','目前不能抽占卜牌');if(id!==this.roundStarterId)fail('STARTER_ONLY','這回合的抽牌者才可抽牌',403);this.drawFortune();return;}
  if(action==='roll-bonus'){
   if(this.phase!=='settlement'||this.stage!=='bonus'||!p.bonusEligible||p.bonusRolled||p.ready)fail('CANNOT_ROLL','現在不能擲獎勵骰');
   p.bonusRolled=true;for(let i=0;i<(this.fortune.id==='full'?2:1);i++)p.bonusDice.push(this.roll(p));this.event('bonus-roll',p.name+' 擲出獎勵骰');return;
  }
  if(action==='bonus-ready'){if(this.phase!=='settlement'||this.stage!=='bonus'||p.ready||p.bonusEligible&&!p.bonusRolled)fail('ROLL_FIRST','請先擲獎勵骰');p.ready=true;this.event('ready',p.name+' 完成獎勵骰階段');if(this.players.every(q=>q.ready))this.beginEffects();return;}
  if(action==='confirm-effects'){if(this.phase!=='settlement'||this.stage!=='effects-confirm'||p.ready)fail('INVALID_PHASE','先完成藥材效果選擇');p.ready=true;this.event('ready',p.name+' 確認綠色、黑色、紫色結算');if(this.players.every(q=>q.ready))this.rewardPhase();return;}
  if(action==='next'){
   if(id!==this.host)fail('HOST_ONLY','只有房主能換輪',403);if(this.phase!=='between')fail('INVALID_PHASE','先完成本輪');this.nextRound();return;
  }
  if(action==='choice'){
   const q=p.pending[0];if(!q||q.id!==data.choiceId)fail('STALE_CHOICE','選項已更新');const choice=q.options.find(o=>o.id===data.optionId);if(!choice)fail('INVALID_CHOICE','無效選項',400);
   if(!this.choiceValid(p,choice))fail('CHOICE_UNAVAILABLE','此選項所需藥材或紅寶石已不存在');const cost=choice.ops.filter(o=>o.op==='ruby'&&o.amount<0).reduce((n,o)=>n-o.amount,0);if(p.rubies<cost)fail('NOT_ENOUGH_RUBIES','紅寶石不足');
   const effectBefore=q.color?this.effectSnapshot(p):null;p.pending.shift();
   for(const o of choice.ops){
    if(o.op==='sixPick'){const c=p.sixPool.find(x=>x.id===o.chipId);p.sixPool=p.sixPool.filter(x=>x.id!==o.chipId);this.place(p,c);if(p.exploded){p.bag.push(...p.sixPool);p.sixPool=[];}else this.sixQueue(p);}
    else if(o.op==='sixEnd'){p.bag.push(...p.sixPool);p.sixPool=[];}
    else this.operate(p,o);
   }
   if(effectBefore)this.effectRecord(p,q.color,effectBefore,choice.label);this.event('choice',p.name+' 完成效果選擇');this.advance();return;
  }
  if(action==='witch'){this.useWitch(p,data.color);return;}
  if(action==='potion'){
   if(this.phase!=='brewing'||this.stage!=='drawing'||p.pending.length||p.stopped||p.exploded||!p.potion||Object.hasOwn(this.intents,id)||p.pot.at(-1)?.color!=='white')fail('POTION_UNAVAILABLE','藥水瓶只能在爆炸前收回最後一片白色炸彈');
   const returned=this.remove(p,p.pot.at(-1).id);p.position=returned.fromPosition??p.pot.at(-1)?.position??Math.min(LAST,p.droplet+p.rat);p.potion=false;this.event('potion',p.name+' 使用藥水瓶');return;
  }
  if(action==='draw'||action==='stop'){
   if(this.phase!=='brewing'||this.stage!=='drawing'||this.hasPending()||p.stopped)fail('INVALID_PHASE','先完成效果或等待下一次抽藥');
   if(data.step!==this.step)fail('STALE_STEP','抽藥次序已更新');if(Object.hasOwn(this.intents,id))fail('ALREADY_CHOSEN','這次已選擇');
   if(action==='draw'&&data.chipId){const c=p.alchemy?.pool.find(c=>c.id===data.chipId);if(!this.options.alchemists||!c||c.color==='red'&&this.setFor('red')===2)fail('INVALID_CHIP','此預抽藥材現在不能投入',400);this.alchemyDraws[id]=c.id;}
   this.quacksAchievements.decision(p);this.intents[id]=action;this.event('intent',p.name+' 已選擇');
   if(this.players.filter(q=>!q.stopped).every(q=>Object.hasOwn(this.intents,q.id))){
    const drawing=this.players.filter(q=>!q.stopped);
    for(const q of drawing){if(this.intents[q.id]==='stop')q.stopped=true;else{const chipId=this.alchemyDraws[q.id],c=chipId?q.alchemy.pool.find(c=>c.id===chipId):this.drawOne(q);if(chipId){q.alchemy.pool=q.alchemy.pool.filter(x=>x.id!==chipId);delete this.alchemyDraws[q.id];}if(c){q.draws++;this.place(q,c);}else q.stopped=true;}}
    this.advanceStep=true;this.advance();
   }return;
  }
  if(action==='reserve'||action==='reserve-return'){
   if(this.phase!=='brewing'||!['drawing','reserves'].includes(this.stage)||p.pending.length||Object.hasOwn(this.intents,id))fail('INVALID_PHASE','現在不能投入暫存藥材');
   const c=p.reserve.find(c=>c.id===data.chipId);if(!c)fail('INVALID_CHIP','藥材不存在',400);
   if(action==='reserve-return'){if(c.must)fail('MUST_PLACE','本輪必須投入此藥材');this.remove(p,c.id);this.event('reserve',p.name+' 收回暫存藥材');this.advance();return;}if(this.setFor('red')===2&&c.effectColor==='red'&&!p.stopped)fail('MUST_STOP','停止抽藥後才能投入暫存紅色');p.reserve=p.reserve.filter(x=>x.id!==c.id);delete c.must;this.place(p,c,{fromReserve:true});this.event('reserve',p.name+' 投入暫存藥材');this.advance();return;
  }
  if(action==='reserve-done'){
   if(this.phase!=='brewing'||this.stage!=='reserves'||p.pending.length||p.reserve.some(c=>c.must))fail('INVALID_PHASE','本輪必須投入的藥材尚未完成');
   p.reserveDone=true;this.event('ready',p.name+' 暫存藥材已決定');if(this.players.every(q=>q.reserveDone||!q.reserve.length&&!q.alchemy?.pool.some(c=>c.color==='red'&&this.setFor('red')===2)))this.beginSettlement();return;
  }
  if(action==='settle-ready'){
   if(this.phase!=='settlement'||this.stage!=='witches'||this.hasPending()||p.ready)fail('INVALID_PHASE','先完成效果');p.ready=true;this.event('ready',p.name+' 準備結算');if(this.players.every(q=>q.ready)){if(this.options.alchemists)this.beginAlchemy();else this.beginBonus();}return;
  }
  if(action==='reward'){
   if(this.phase!=='settlement'||this.stage!=='rewards'||p.ready)fail('INVALID_PHASE','現在不能選結算方式');
   if(!['score','buy'].includes(data.mode))fail('INVALID_CHOICE','選擇得分或購物',400);
   p.settlementChoice=data.mode;p.ready=true;this.event('ready',p.name+' 選擇結算方式');if(this.players.every(q=>q.ready))this.enterShopping();return;
  }
  if(action==='buy'||action==='extra-buy'){
   if(this.phase!=='settlement'||this.stage!=='shopping'||p.ready||p.pending.length)fail('INVALID_PHASE','現在不能買藥材');
   const extra=action==='extra-buy';if(this.round===9||!extra&&!p.canBuy)fail('CANNOT_BUY','本輪不能買藥材');
   const b=this.availableBooks().find(b=>b.color===data.color),offer=b?.offers.find(o=>o.value===data.value);
   if(!offer)fail('INVALID_CHIP','此藥材未解鎖',400);
   const bought=extra?p.extraBought:p.bought,budget=extra?p.extraBudget:p.budget;
   if(!Array.isArray(bought)||bought.length>=2||bought.some(c=>c.color===data.color)||budget<offer.price)fail('CANNOT_BUY','預算不足或已購買此顏色');
   if(extra)p.extraBudget-=offer.price;else p.budget-=offer.price;
   this.grant(p,b.color,offer.value);bought.push({color:b.color,value:offer.value,price:offer.price});if(!extra)this.expansionAfterBuy(p);this.event('buy',p.name+' 買入 '+label({color:b.color,value:offer.value}));return;
  }
  if(action==='ruby'){
   if(this.phase!=='settlement'||this.stage!=='shopping'||p.ready||p.pending.length||this.round===9)fail('INVALID_PHASE','現在不能使用紅寶石');
   if(!['refill','droplet'].includes(data.mode))fail('INVALID_CHOICE','請選補瓶或液滴',400);
   if(p.rubies<p.discount||data.mode==='refill'&&p.potion)fail('NOT_ENOUGH_RUBIES','紅寶石不足或瓶子已滿');
   p.rubies-=p.discount;if(data.mode==='refill')p.potion=true;else p.droplet=Math.min(LAST,p.droplet+1);this.event('ruby',p.name+' 使用紅寶石');return;
  }
  if(action==='shop-ready'){
   if(this.phase!=='settlement'||this.stage!=='shopping'||p.ready||p.pending.length)fail('INVALID_PHASE','先完成購物效果');
   if(this.expansionEndReady(p)){this.event('fortune',p.name+' 選擇取回女巫幣');return;}
   if(this.round===9&&p.canBuy){p.score+=Math.floor(p.budget/5);p.budget%=5;}
   p.ready=true;this.event('ready',p.name+' 完成結算');if(this.players.every(q=>q.ready))this.endRound();return;
  }
  fail('INVALID_ACTION','不支援的操作',400);
 });}
 choiceValid(p,o){return this.expansionChoiceValid(p,o)&&(!this.options.alchemists||this.alchemyChoiceValid(p,o))&&o.ops.filter(x=>x.op==='ruby'&&x.amount<0).reduce((n,x)=>n-x.amount,0)<=p.rubies&&o.ops.every(x=>!['upgrade','retain','remove'].includes(x.op)||p.pot.some(c=>c.id===x.chipId))&&o.ops.every(x=>x.op!=='sixPick'||p.sixPool.some(c=>c.id===x.chipId));}
 view(id){
  const base=this.baseView(id),p=this.player(id),revealed=['settlement','between','finished'].includes(this.phase),books=this.availableBooks();
  const recipes=this.activePlayers().map(q=>{const show=q.id===id||!this.options.hiddenProgress||q.exploded||revealed;return {id:q.id,name:q.name,alchemy:this.options.alchemists&&q.alchemy?{patientId:q.alchemy.patientId,essence:q.alchemy.essence,confirmed:q.alchemy.confirmed,calculation:revealed?q.alchemy.calculation:null}:null,potColor:q.potColor||Object.keys(POT_COLORS)[this.players.indexOf(q)],potName:q.potName||q.name+'的好運釜',bagCount:q.bag?.length??0,rat:q.rat||0,coins:q.coins||null,score:q.score,rubies:q.rubies,droplet:q.droplet,stopped:q.stopped,exploded:q.exploded,explosionId:q.explosionId,ready:q.ready,chosen:Object.hasOwn(this.intents,q.id),hidden:!show,position:show?q.position:null,startPosition:show?q.roundStartPosition:null,bonusEligible:revealed?q.bonusEligible:null,bonusDice:revealed?q.bonusDice:[],pot:show?clone(q.pot||[]):null,overflow:show?clone(q.overflow||[]):null,white:show&&q.bag?this.white(q):null,threshold:show?(q.bag?this.threshold(q):7):null,draws:show?q.draws:null};});
  return clone({...base,serverNow:this.now(),potColors:POT_COLORS,rollEvents:this.rollEvents,options:this.options,step:this.step,stage:this.stage,fortune:this.fortune,fortuneRevealId:this.fortuneRevealId,fortuneDrawnAt:this.fortuneDrawnAt,roundStarterId:this.roundStarterId,bookSelection:this.bookSelection().map(({key,...b})=>b),visitingWitch:this.visitingWitch||null,witches:this.witches,patients:this.options.alchemists?Alchemy.catalog().filter(p=>this.patientChoices?.includes(p.id)):[],board:BOARD,books,recipes,mine:p.bag?{alchemy:this.alchemyView(p),canVisit:this.visitorAllowed(p),canGoodNeighbor:this.fortune?.id==='good-neighbor'&&this.phase==='brewing'&&!p.exploded&&!p.goodNeighborUsed&&!p.pending.length&&!Object.hasOwn(this.intents,id),bagCount:p.bag.length,bagPeek:p.bagPeek,peekUsed:!!p.bagPeekUsed,peekAvailable:!p.bot&&!p.bagPeekUsed&&!['waiting','patients','finished'].includes(this.phase),potion:p.potion,bonusEligible:p.bonusEligible,bonusRolled:p.bonusRolled,bonusDice:p.bonusDice,effectSummary:p.effectSummary,coins:p.coins,position:p.position,white:this.white(p),threshold:this.threshold(p),reserve:p.reserve,pending:p.pending[0]?{id:p.pending[0].id,title:p.pending[0].title,options:p.pending[0].options.map(o=>({id:o.id,label:o.label,disabled:!this.choiceValid(p,o)}))}:null,budget:p.budget,extraBudget:p.extraBudget||0,extraBought:p.extraBought||[],bought:p.bought,canBuy:p.canBuy,canScore:p.canScore,discount:p.discount,ready:p.ready,draws:p.draws,canDraw:this.phase==='brewing'&&this.stage==='drawing'&&!this.hasPending()&&!p.stopped&&!Object.hasOwn(this.intents,id),canPotion:this.phase==='brewing'&&this.stage==='drawing'&&!p.stopped&&!p.pending.length&&p.potion&&p.pot.at(-1)?.color==='white'&&!Object.hasOwn(this.intents,id),witchAvailable:Object.fromEntries(Object.keys(this.witches).map(c=>[c,this.witchAllowed(p,c)])),waitingEffect:this.hasPending()&&!p.pending.length}:null});
 }
}
Object.assign(QuacksRoom.prototype,Alchemy.methods,ExpansionFortunes.methods);
module.exports={QuacksRoom,LAST};
