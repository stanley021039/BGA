const {randomInt,randomUUID}=require('node:crypto');
const labels=['高牌','一對','兩對','三條','順子','同花','葫蘆','四條','同花順'];
function rank5(cards){
 const nums=cards.map(c=>c%13+2).sort((a,b)=>b-a), counts={}; nums.forEach(n=>counts[n]=(counts[n]||0)+1);
 const groups=Object.entries(counts).map(([n,c])=>[c,+n]).sort((a,b)=>b[0]-a[0]||b[1]-a[1]);
 const unique=[...new Set(nums)];if(unique[0]===14)unique.push(1);
 let straight=0;for(let i=0;i<=unique.length-5;i++)if(unique[i]-unique[i+4]===4){straight=unique[i];break;}
 const flush=cards.every(c=>Math.floor(c/13)===Math.floor(cards[0]/13));
 if(flush&&straight)return [8,straight];if(groups[0][0]===4)return [7,groups[0][1],groups[1][1]];
 if(groups[0][0]===3&&groups[1][0]===2)return [6,groups[0][1],groups[1][1]];
 if(flush)return [5,...nums];if(straight)return [4,straight];
 if(groups[0][0]===3)return [3,groups[0][1],...groups.slice(1).map(g=>g[1])];
 if(groups[0][0]===2&&groups[1][0]===2)return [2,...groups.slice(0,2).map(g=>g[1]),groups[2][1]];
 if(groups[0][0]===2)return [1,...groups.map(g=>g[1])];return [0,...nums];
}
function compare(a,b){for(let i=0;i<Math.max(a.length,b.length);i++){const d=(a[i]||0)-(b[i]||0);if(d)return d;}return 0;}
function evaluate(cards){let best=[-1];for(let a=0;a<cards.length-4;a++)for(let b=a+1;b<cards.length-3;b++)for(let c=b+1;c<cards.length-2;c++)for(let d=c+1;d<cards.length-1;d++)for(let e=d+1;e<cards.length;e++){const r=rank5([cards[a],cards[b],cards[c],cards[d],cards[e]]);if(compare(r,best)>0)best=r;}return best;}
class Room{
 constructor(code,name,rng=randomInt){this.rng=rng;this.code=code;this.name=name;this.players=[];this.phase='waiting';this.board=[];this.button=-1;this.turn=-1;this.hand=0;this.log=[];this.results=[];this.updated=Date.now();}
 add(name,bot=false){if(this.players.length>=6)throw Error('房間已滿（最多 6 人）');const p={id:randomUUID(),secret:randomUUID(),name:name.slice(0,16),stack:2000,cards:[],bet:0,total:0,folded:true,bot,lastSeen:Date.now()};this.players.push(p);if(!this.host)this.host=p.id;this.note(`${p.name} 加入牌桌`);return p;}
 note(s){this.log.unshift(s);this.log=this.log.slice(0,30);this.updated=Date.now();}
 next(i,pred){for(let n=1;n<=this.players.length;n++){let j=(i+n+this.players.length)%this.players.length;if(pred(this.players[j]))return j;}return -1;}
 pay(p,n){n=Math.min(n,p.stack);p.stack-=n;p.bet+=n;p.total+=n;}
 start(){if(!['waiting','showdown'].includes(this.phase))throw Error('本局尚未結束');if(this.players.filter(p=>p.stack>0).length<2)throw Error('至少需要兩位有籌碼的玩家');
 this.deck=Array.from({length:52},(_,i)=>i);for(let i=51;i>0;i--){let j=this.rng(i+1);[this.deck[i],this.deck[j]]=[this.deck[j],this.deck[i]];}
 this.board=[];this.results=[];this.hand++;this.phase='preflop';this.currentBet=20;this.minRaise=20;
 for(const p of this.players){p.bet=0;p.total=0;p.folded=p.stack===0;p.cards=p.folded?[]:[this.deck.pop(),this.deck.pop()];p.acted=false;p.actedAt=null;p.action='';}
 this.button=this.next(this.button,p=>!p.folded);let sb=this.players.filter(p=>!p.folded).length===2?this.button:this.next(this.button,p=>!p.folded);let bb=this.next(sb,p=>!p.folded);
 this.pay(this.players[sb],10);this.pay(this.players[bb],20);this.note(`第 ${this.hand} 局 · 盲注 10 / 20`);this.setTurn(this.next(bb,p=>!p.folded&&p.stack>0));this.advance();
 }
 setTurn(i){this.turn=i;this.deadline=Date.now()+45000;this.botAt=Date.now()+1200;}
 canRaise(p){return p.actedAt===null||this.currentBet-p.actedAt>=this.minRaise;}
 act(id,type,amount){const p=this.players[this.turn];if(!p||p.id!==id||['waiting','showdown'].includes(this.phase))throw Error('還沒輪到你');let due=this.currentBet-p.bet;
 if(type==='fold'){p.folded=true;p.action='棄牌';}
 else if(type==='check'){if(due>0)throw Error('需要跟注或棄牌');p.action='過牌';}
 else if(type==='call'){this.pay(p,due);p.action=p.stack===0?'ALL IN':'跟注';}
 else if(type==='raise'||type==='allin'){
 let target=type==='allin'?p.bet+p.stack:Number(amount);if(!Number.isSafeInteger(target)||target<=p.bet||target>p.bet+p.stack)throw Error('下注金額不正確');
 if(target>this.currentBet){if(!this.canRaise(p))throw Error('短額 All-in 尚未重新開放加注');let raise=target-this.currentBet;if(raise<this.minRaise&&target!==p.bet+p.stack)throw Error(`最低加注至 ${this.currentBet+this.minRaise}`);if(raise>=this.minRaise){this.minRaise=raise;for(const q of this.players)if(q!==p)q.acted=false;}this.currentBet=target;}
 else if(type!=='allin')throw Error('加注必須高於目前下注');this.pay(p,target-p.bet);p.action=p.stack===0?'ALL IN':`加注至 ${target}`;
 }else throw Error('未知操作');
 p.acted=true;p.actedAt=this.currentBet;this.note(`${p.name} · ${p.action}`);const prev=this.turn,phase=this.phase;this.advance();if(this.phase===phase)this.setTurn(this.next(prev,q=>!q.folded&&q.stack>0&&(!q.acted||q.bet<this.currentBet)));
 }
 advance(){let alive=this.players.filter(p=>!p.folded);if(alive.length===1){const pot=this.players.reduce((s,p)=>s+p.total,0);alive[0].stack+=pot;this.results=[{name:alive[0].name,amount:pot,hand:'其他玩家棄牌'}];this.finish();return;}
 let movable=alive.filter(p=>p.stack>0);
 if(movable.some(p=>(!p.acted||p.bet<this.currentBet))&&!(movable.length<=1&&movable.every(p=>p.bet>=this.currentBet)))return;
 if(this.phase==='river'){this.settle();return;}
 this.phase={preflop:'flop',flop:'turn',turn:'river'}[this.phase];this.deck.pop();for(let n=this.phase==='flop'?3:1;n>0;n--)this.board.push(this.deck.pop());
 this.currentBet=0;this.minRaise=20;for(const p of this.players){p.bet=0;p.acted=false;p.actedAt=null;p.action='';}this.setTurn(this.next(this.button,p=>!p.folded&&p.stack>0));this.note({flop:'翻牌',turn:'轉牌',river:'河牌'}[this.phase]);if(movable.length<=1)this.advance();
 }
 settle(){const levels=[...new Set(this.players.map(p=>p.total).filter(Boolean))].sort((a,b)=>a-b);let prev=0;const winnings=new Map();
 for(const level of levels){const contributors=this.players.filter(p=>p.total>=level);const amount=(level-prev)*contributors.length;prev=level;const eligible=contributors.filter(p=>!p.folded);if(!eligible.length){for(const p of contributors)p.stack+=amount/contributors.length;continue;}let best=[-1],winners=[];for(const p of eligible){let rank=evaluate([...p.cards,...this.board]);let c=compare(rank,best);if(c>0){best=rank;winners=[p];}else if(c===0)winners.push(p);}winners.sort((a,b)=>((this.players.indexOf(a)-this.button-1+this.players.length)%this.players.length)-((this.players.indexOf(b)-this.button-1+this.players.length)%this.players.length));winners.forEach((p,i)=>{let win=Math.floor(amount/winners.length)+(i<amount%winners.length?1:0);p.stack+=win;let old=winnings.get(p.id);winnings.set(p.id,{name:p.name,amount:(old?.amount||0)+win,hand:labels[best[0]]});});}
 this.results=[...winnings.values()];this.finish();}
 finish(){this.phase='showdown';this.turn=-1;this.note(this.results.map(r=>`${r.name} 贏得 ${r.amount}（${r.hand}）`).join(' · '));}
 view(id){let me=this.players.find(p=>p.id===id);return {code:this.code,name:this.name,phase:this.phase,hand:this.hand,board:this.board,button:this.button,turn:this.turn,deadline:this.deadline,currentBet:this.currentBet||0,minRaise:this.minRaise||20,pot:this.players.reduce((s,p)=>s+p.total,0),host:this.host===id,me:me?.id,canRaise:me?this.canRaise(me):false,results:this.results,log:this.log,players:this.players.map(p=>({id:p.id,name:p.name,avatar:p.avatar||null,stack:p.stack,bet:p.bet,total:p.total,folded:p.folded,bot:p.bot,action:p.action,online:p.bot||Date.now()-p.lastSeen<15000,cards:p.id===id||(this.phase==='showdown'&&!p.folded&&this.players.filter(q=>!q.folded).length>1)?p.cards:p.cards.map(()=>null)}))};}
}
module.exports={Room,evaluate,compare};


