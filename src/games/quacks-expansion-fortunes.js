'use strict';
const {BOARD,WITCHES,NAMES}=require('./quacks-catalog'),{fail,clone}=require('./party-base');
const LAST=BOARD.length-2;
const rows=[
 ['give-get','方捨方得','棄1／2／4顆紅寶石換同數值藥材（紫色除外），或獲得2顆紅寶石。','immediate'],
 ['strong-water','強大藥水','水滴後退1／2格，換一片2／4級藥材。','immediate'],
 ['precious-rats','珍愛老鼠','最多棄3顆紅寶石，每顆換本輪3條鼠尾巴。','immediate'],
 ['feed-pets','實用的餵養動物','放棄本輪2／4／6條鼠尾巴，換1／2／4級藥材（紫色除外）。','immediate'],
 ['neighbor-help','芳鄰相助','可永久移除袋中一片白色炸彈1，或取得任意一片藥材。','immediate'],
 ['twin-shopping','跳樓拍賣','本輪普通購物買足兩片時，免費多拿一片其中較便宜的藥材。','round'],
 ['give-get-again','有所方得','棄1／2／4顆紅寶石換同數值藥材（紫色除外），或獲得2顆紅寶石。','immediate'],
 ['good-neighbor','好鄰居','未爆炸時，本輪可一次把白色炸彈3加入自己的袋，其他玩家各得2顆紅寶石。','round'],
 ['generous-choice','優渥選項','選擇：本輪多8条鼠尾巴、擲4次骰、或水滴前進3格。','immediate'],
 ['small-donation','小小捐獻','本輪開始時有至少2條鼠尾巴的玩家各擲一次骰。','immediate'],
 ['witch-visit','女巫來訪','隨機抽一位本場未選用的草藥女巫；每位玩家本輪可免費使用她一次。','immediate','witches'],
 ['witch-trade','快速成交','可棄掉自己的任一女巫幣，換任意一片藥材。','immediate','witches'],
 ['refine','精益求精','停止製藥時，可永久移除大釜一片2／4級彩色藥材，換同級另一片放在原位置。','round'],
 ['snow','雪白情節','安全停止時，最後一片若是白色炸彈，獲得其數值的分數。','round'],
 ['rat-rich','鼠來寶','本輪普通購物金幣額外增加本輪鼠尾巴數量的兩倍。','round'],
 ['glow-stones','霞石照耀','每人從袋抽一片，得到其數值的紅寶石，再放回袋。','immediate'],
 ['tough-choice','難以抉擇','選擇：1顆紅寶石、擲骰一次並多3條鼠尾巴；或一片紅色2。','immediate'],
 ['alchemy-misfortune','因禍得福','本輪爆炸時，特效藥額外前進2格。','round','alchemists'],
 ['alchemy-last','好兄弟','特效藥額外前進大釜最後一片藥材的實際數值格數。','round','alchemists'],
 ['witch-return','故地重遊','本輪結束時，可取回一枚已使用的女巫幣。','round','witches']
];
const FORTUNES=rows.map(([id,name,text,timing,requires])=>({id,name,text,timing,requires}));
const methods={
 expansionFortunes(){return this.options.alchemists?FORTUNES.filter(f=>!f.requires||this.options[f.requires]):[];},
 freeOffers(value,excludePurple=false){return Object.keys(NAMES).filter(c=>c!=='white'&&(!excludePurple||c!=='purple')&&(c!=='locoweed'||this.options.witches||this.options.alchemists)).flatMap(color=>this.bookFor(color).offers.filter(o=>!value||o.value===value).map(o=>({color,...o})));},
 applyExpansionFortune(){
  const f=this.fortune.id;if(!FORTUNES.some(x=>x.id===f))return false;
  if(f==='witch-visit'){const choices=Object.entries(WITCHES).flatMap(([color,ws])=>ws.filter(w=>this.witches[color]?.id!==w.id).map(w=>({color,...w})));this.visitingWitch=choices[this.index(choices.length)];}
  for(const p of this.players){
   let options=[];
   if(f==='give-get'||f==='give-get-again')options=[this.option('獲得2顆紅寶石',[{op:'ruby',amount:2}]),...[1,2,4].filter(n=>p.rubies>=n).flatMap(n=>this.freeOffers(n,true).map(o=>this.option('付'+n+'顆紅寶石：'+NAMES[o.color]+' '+o.value,[{op:'ruby',amount:-n},{op:'grant',color:o.color,value:o.value}])) )];
   if(f==='strong-water')options=[this.option('不交換',[]),...[1,2].filter(n=>p.droplet>=n).flatMap(n=>this.freeOffers(n*2).map(o=>this.option('水滴後退'+n+'：'+NAMES[o.color]+' '+o.value,[{op:'droplet',amount:-n},{op:'grant',color:o.color,value:o.value}])))];
   if(f==='precious-rats')options=[this.option('不交換',[]),...[1,2,3].filter(n=>p.rubies>=n).map(n=>this.option('棄'+n+'顆紅寶石，多'+n*3+'條鼠尾巴',[{op:'ruby',amount:-n},{op:'expRat',amount:n*3}]))];
   if(f==='feed-pets')options=[this.option('不交換',[]),...[[2,1],[4,2],[6,4]].filter(([n])=>p.rat>=n).flatMap(([n,v])=>this.freeOffers(v,true).map(o=>this.option('放棄'+n+'條鼠尾巴：'+NAMES[o.color]+' '+v,[{op:'expRat',amount:-n},{op:'grant',color:o.color,value:v}])))];
   if(f==='neighbor-help'){const c=p.bag.find(c=>c.color==='white'&&c.value===1);options=[...(c?[this.option('移除白色炸彈1',[{op:'discardBag',chipId:c.id}])]:[]),...this.freeOffers().map(o=>this.option(NAMES[o.color]+' '+o.value,[{op:'grant',color:o.color,value:o.value}]))];}
   if(f==='generous-choice')options=[this.option('8條鼠尾巴',[{op:'expRat',amount:8}]),this.option('擲骰4次',[{op:'expRoll',amount:4}]),this.option('水滴前進3格',[{op:'droplet',amount:3}])];
   if(f==='small-donation'&&p.rat>=2)this.roll(p,'占卜牌');
   if(f==='witch-trade')options=[this.option('保留女巫幣',[]),...Object.keys(p.coins).filter(c=>p.coins[c]).flatMap(coin=>this.freeOffers().map(o=>this.option('棄'+({gold:'金',copper:'銅',silver:'銀'})[coin]+'幣：'+NAMES[o.color]+' '+o.value,[{op:'expCoin',color:coin},{op:'grant',color:o.color,value:o.value}])))];
   if(f==='glow-stones'){const c=this.drawOne(p);if(c){p.rubies+=c.value;p.bag.push(c);}}
   if(f==='tough-choice')options=[this.option('紅寶石＋擲骰＋3條鼠尾巴',[{op:'ruby',amount:1},{op:'expRoll',amount:1},{op:'expRat',amount:3}]),this.option('毒蘑菇2',[{op:'grant',color:'red',value:2}])];
   if(options.length)this.queue(p,this.fortune.name,options);
  }
  return true;
 },
 expansionBeforeSettlement(){
  if(this.fortune.id==='snow')for(const p of this.players)if(!p.fortuneSettlementApplied&&!p.exploded&&p.pot.at(-1)?.color==='white'){p.score+=p.pot.at(-1).value;p.fortuneSettlementApplied=true;}
  if(this.fortune.id==='refine')for(const p of this.players){if(p.fortuneSettlementApplied)continue;p.fortuneSettlementApplied=true;
   const chips=p.pot.filter(c=>c.color!=='white'&&[2,4].includes(c.value));
   this.queue(p,'精益求精：交換原位置的藥材',[this.option('不交換',[]),...chips.flatMap(c=>this.freeOffers(c.value).map(o=>this.option(NAMES[c.color]+' '+c.value+' → '+NAMES[o.color],[{op:'expSwap',chipId:c.id,color:o.color,value:o.value}])))]);
  }
 },
 expansionOperate(p,o){
  if(o.op==='expRat'){p.rat+=o.amount;p.position=Math.min(LAST,p.droplet+p.rat);}
  else if(o.op==='expRoll')for(let i=0;i<o.amount;i++)this.roll(p,'占卜牌');
  else if(o.op==='expCoin')p.coins[o.color]=false;
  else if(o.op==='expReturnCoin'){if(o.color)p.coins[o.color]=true;p.returnCoinDone=true;}
  else if(o.op==='expSwap'){const i=p.pot.findIndex(c=>c.id===o.chipId),old=p.pot[i];if(!old)fail('INVALID_CHIP','藥材已不存在');p.pot[i]={...this.chip(o.color,o.value),position:old.position,fromPosition:old.fromPosition,effectColor:o.color,effectValue:o.value};}
  else fail('INVALID_EFFECT','未知擴充占卜效果');
 },
 expansionChoiceValid(p,o){return o.ops.every(x=>(x.op!=='droplet'||x.amount>=0||p.droplet>=-x.amount)&&(x.op!=='expRat'||x.amount>=0||p.rat>=-x.amount)&&(x.op!=='expCoin'||p.coins[x.color])&&(x.op!=='expSwap'||p.pot.some(c=>c.id===x.chipId)));},
 expansionShopping(p){if(this.fortune.id==='rat-rich'&&p.canBuy)p.budget+=p.rat*2;},
 expansionAfterBuy(p){if(this.fortune.id==='twin-shopping'&&p.bought.length===2&&!p.freeCheap){const c=p.bought.reduce((a,b)=>a.price<=b.price?a:b);this.grant(p,c.color,c.value);p.freeCheap=true;}},
 expansionEndReady(p){
  if(this.fortune.id!=='witch-return'||p.returnCoinDone)return false;
  const coins=Object.keys(p.coins).filter(c=>!p.coins[c]);if(!coins.length){p.returnCoinDone=true;return false;}
  this.queue(p,'故地重遊：取回一枚女巫幣',[this.option('不取回',[{op:'expReturnCoin'}]),...coins.map(color=>this.option('取回'+({gold:'金',copper:'銅',silver:'銀'})[color]+'幣',[{op:'expReturnCoin',color}]))]);return true;
 },
 visitorAllowed(p){
  const w=this.visitingWitch;if(this.fortune?.id!=='witch-visit'||!w||p.visitorUsed)return false;
  const old=this.witches[w.color],coin=p.coins[w.color];this.witches[w.color]=w;p.coins[w.color]=true;
  try{return this.witchAllowed(p,w.color);}finally{this.witches[w.color]=old;p.coins[w.color]=coin;}
 },
 expansionAct(p,action){
  if(action==='fortune-neighbor'){
   if(this.fortune?.id!=='good-neighbor'||this.phase!=='brewing'||p.exploded||p.goodNeighborUsed||p.pending.length||Object.hasOwn(this.intents,p.id))fail('INVALID_PHASE','現在不能使用好鄰居');
   p.goodNeighborUsed=true;this.grant(p,'white',3);for(const q of this.players)if(q!==p)q.rubies+=2;this.event('fortune',p.name+' 使用好鄰居，其他玩家各得2顆紅寶石');return true;
  }
  if(action==='free-witch'){
   if(!this.visitorAllowed(p))fail('WITCH_UNAVAILABLE','現在不能使用來訪女巫');
   const w=this.visitingWitch,old=this.witches[w.color],coin=p.coins[w.color];this.witches[w.color]=w;p.coins[w.color]=true;
   try{this.useWitch(p,w.color,true);p.visitorUsed=true;}finally{this.witches[w.color]=old;p.coins[w.color]=coin;}
   return true;
  }
  return false;
 }
};
module.exports={FORTUNES,methods};
