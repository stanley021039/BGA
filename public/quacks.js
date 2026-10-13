(()=>{
'use strict';
const $=s=>document.querySelector(s),code=location.pathname.match(/^\/quacks\/([a-f0-9]{6})\/?$/i)?.[1]?.toUpperCase(),names={white:'白色炸彈',orange:'南瓜',blue:'烏鴉頭骨',red:'毒蘑菇',yellow:'曼德拉草',green:'花園蜘蛛',black:'非洲骷髏天蛾',purple:'幽靈氣息',locoweed:'愚人草'},colors={white:'#d9f1ef',orange:'#d87e20',blue:'#3280b5',red:'#bf4348',yellow:'#d7b936',green:'#40906a',black:'#273b49',purple:'#995ec1',locoweed:'#dd719e'};
let state,scope,timer,busy=false,reading=false,disposed=false,retry=null,lastVersion=-1,previousState=null,botControl=null;
const sounds=window.GameSounds?.create(),seenExplosion=new Set(),node=(t,text)=>{const n=document.createElement(t);if(text!==undefined)n.textContent=text;return n;};
function button(label,icon,fn,blocked=false){const b=node('button',label);b.type='button';b.dataset.blocked=String(blocked);b.onclick=fn;window.GameUI?.decorateButton(b,icon);return b;}
function lock(){if(botControl)botControl.disabled=busy||botControl.dataset.blocked==='true';for(const b of $('#controls').querySelectorAll('button,input,select'))b.disabled=busy||b.dataset.blocked==='true';for(const b of document.querySelectorAll('#witches button,#bookVoting button,#bookVoting select,#potTabs button,#alchemy button'))b.disabled=busy||b.dataset.blocked==='true';$('#bagButton').disabled=busy;$('#peekBag').disabled=busy||!state?.mine?.peekAvailable;for(const b of $('#potColors').querySelectorAll('button'))b.disabled=busy||b.dataset.blocked==='true';$('#savePotName').disabled=busy;$('#leave').disabled=busy;$('#retry').disabled=busy;}
async function api(route,data){return RoomApi.request(route,data,{code,room:'quacks',session:true,signal:scope.signal});}
async function mutate(route,data){if(busy||disposed)return;busy=true;retry=null;$('#retry').hidden=true;$('#feedback').textContent='';lock();try{const s=await api(route,data);if(!disposed)render(s);}catch(e){if(!disposed&&e.name!=='AbortError'){$('#feedback').textContent=e.message;if(!e.status){retry={route,data};$('#retry').hidden=false;}}}finally{busy=false;if(!disposed){lock();refresh();}}}
const act=(action,extra={})=>mutate('action',{action,roundId:state.roundId,requestId:crypto.randomUUID(),...extra});

const art=window.QuacksArt,scoreboard=window.QuacksFx.createScoreboard($('#scoreboard')),fx=window.QuacksFx.create($('#quacksFx'));const seenRolls=new Set();
let viewedPotId=null,potKey='',lastReveal=null;
function chip(c){const n=node('span');n.className='chip';n.append(art.token(c,{size:42}));return n;}
function coloredCard(color,heading){const a=node('article');a.className='book-card';a.dataset.ingredient=color;a.style.setProperty('--ingredient',art.palette[color][0]);const h=node('div');h.className='book-heading';h.append(art.token({color,value:1},{size:58,decorative:true}),node('h3',heading));a.append(h);return a;}
function hideTooltip(){$('#potTooltip').hidden=true;document.querySelector('[aria-describedby="potTooltip"]')?.removeAttribute('aria-describedby');}
function inspectPot(details,event,anchor){
 const tip=$('#potTooltip');hideTooltip();tip.replaceChildren(node('strong',details.title),node('p',details.effect),node('small',details.caption));tip.dataset.ingredient=details.color;tip.hidden=false;anchor.setAttribute('aria-describedby','potTooltip');
 const rect=anchor.getBoundingClientRect(),width=tip.getBoundingClientRect().width,height=tip.getBoundingClientRect().height;
 const left=Math.max(8,Math.min(innerWidth-width-8,rect.left+rect.width/2-width/2)),top=Math.max(8,Math.min(innerHeight-height-8,rect.bottom+10));
 tip.style.left=left+'px';tip.style.top=top+'px';
}
function drawPot(s){
 const p=art.selectRecipe(s,viewedPotId);viewedPotId=p.id;$('#potHeading').textContent=p.potName||p.name+'的好運釜';const markers=art.markerPositions(p);$('#potMarkerSummary').textContent='永久液滴：第 '+markers.droplet+' 格 · 本輪起點：第 '+markers.start+' 格'+(p.rat?'（'+p.rat+' 條鼠尾巴）':'（沒有鼠尾巴加成）');
 $('#potTabs').replaceChildren(...s.recipes.map(q=>{const b=button(q.name+(q.id===s.me?'（你）':q.hidden?' · 未公開':''),'users',()=>{viewedPotId=q.id;drawPot(state);},!art.canInspect(s,q));b.setAttribute('aria-pressed',q.id===p.id?'true':'false');b.classList.toggle('selected',q.id===p.id);return b;}));
 const key=JSON.stringify([p.id,p.potName,p.potColor,p.position,p.startPosition,p.droplet,p.rat,p.pot,p.exploded,p.stopped,s.books,s.options.books]);
 if(key!==potKey){potKey=key;hideTooltip();const svg=art.cauldron(s,p,inspectPot);svg.addEventListener('pointerleave',()=>{if(!svg.contains(document.activeElement))hideTooltip();});svg.addEventListener('focusout',event=>{if(!svg.contains(event.relatedTarget))hideTooltip();});$('#cauldron').replaceChildren(svg);}
 renderBag(s);renderPotCustomization(s);
}

let bagViewerId=null;
function renderBag(s){
 const selected=art.selectRecipe(s,viewedPotId),bagButton=$('#bagButton');
 bagButton.replaceChildren(art.resource('bag',{size:70,decorative:true}),node('span',(selected.id===s.me?'我的藥袋':selected.name+'的藥袋')),node('strong',(selected.bagCount??0)+' 片'));bagButton.disabled=busy;
 const p=s.recipes.find(p=>p.id===bagViewerId)||selected,own=p.id===s.me,m=own?s.mine:null;
 $('#bagDialogTitle').textContent=own?'我的藥袋與暫存藥材':p.name+'的藥袋';
 $('#bagTotal').textContent='袋中剩餘 '+(p.bagCount??0)+' 片'+(own&&m?' · 藥水瓶'+(m.potion?'已裝滿':'空瓶'):'');
 $('#peekBag').hidden=!own;$('#peekBag').disabled=busy||!m?.peekAvailable;$('#peekBag').textContent=m?.peekUsed?'本回合查看機會已使用':'查看真正內容（每回合一次）';
 const content=$('#bag'),peek=m?.bagPeek;
 if(peek){const counts=new Map();for(const c of peek.chips){const key=c.color+':'+c.value;if(!counts.has(key))counts.set(key,{...c,count:0});counts.get(key).count++;}
 const grid=node('div');grid.className='bag-grid';for(const c of counts.values()){const item=node('div');item.className='bag-item';item.append(art.token(c,{size:50,decorative:true}),node('span',names[c.color]+' '+c.value),node('strong','× '+c.count));grid.append(item);}
 content.replaceChildren(node('p','第 '+peek.round+' 回合查看當下的內容；關閉後本回合不能再查看。'),grid);
 }else content.replaceChildren(node('p',own?'平常只顯示總數，每人每回合可查看一次自己的內容。':'其他人的藥袋只公開總數。'));
 $('#reserve').replaceChildren(...(m?.reserve||[]).map(c=>{const p=node('p');p.className='reserve-item';p.append(chip(c),document.createTextNode(names[c.color]+' '+c.value+(c.must?' · 本輪必須投入':' · 暫存')));return p;}));
 if(own&&m&&!m.reserve.length)$('#reserve').append(node('p','目前沒有暫存藥材。'));
}
async function closeBag(){if(busy)return;if(state?.mine?.bagPeek&&bagViewerId===state.me){await act('close-bag');if(state.mine.bagPeek)return;}$('#bagDialog').close();bagViewerId=null;}
function renderResources(s,p){
 const row=node('div');row.className='resource-row';
 for(const [kind,value,label]of [['bag',p.bagCount??0,'片'],['ruby',p.rubies??0,'顆'],['rat',p.rat??0,'條']]){const item=node('div');item.className='resource-pill';item.append(art.resource(kind,{size:35,decorative:true}),node('span',value+' '+label));item.setAttribute('aria-label',({bag:'藥袋',ruby:'紅寶石',rat:'老鼠尾巴'})[kind]+' '+value);row.append(item);}
 if(s.options.witches&&p.coins){const coins=node('div');coins.className='witch-coins';for(const color of ['gold','copper','silver']){const coin=node('span');coin.className='coin-status'+(p.coins[color]?'':' used');coin.append(art.resource(color,{size:34}));coin.setAttribute('aria-label',({gold:'金',copper:'銅',silver:'銀'})[color]+'女巫幣'+(p.coins[color]?'尚未使用':'已使用'));coins.append(coin);}row.append(coins);}
 return row;
}
function renderPotCustomization(s){
 const own=s.recipes.find(p=>p.id===s.me),grid=$('#potColors');grid.replaceChildren();
 for(const [color,theme]of Object.entries(s.potColors||{})){const taken=s.recipes.find(p=>p.id!==s.me&&p.potColor===color),b=button(theme.name+(taken?' · '+taken.name+'使用中':''),'check',()=>act('color-pot',{color}),!!taken);b.className+=' pot-swatch';b.style.setProperty('--swatch',theme.liquid[1]);b.setAttribute('aria-pressed',String(own.potColor===color));grid.append(b);}
 $('#potOwner').textContent=(viewedPotId===s.me?'你的大釜':s.recipes.find(p=>p.id===viewedPotId)?.name+'的大釜');
}
function purchaseOffer(s,b,o,action,blocked){
 const wrap=node('div');wrap.className='purchase-offer';wrap.tabIndex=0;
 const buy=button((action==='extra-buy'?'額外買 ':'')+b.name+' '+o.value+' · '+o.price+' 金幣','gift',()=>act(action,{color:b.color,value:o.value}),blocked);
 buy.prepend(art.token({color:b.color,value:o.value},{size:44,decorative:true}));
 const explain=()=>inspectPot({title:b.name+' · 數值 '+o.value,effect:b.effect,caption:'本場'+b.faceName+' · '+o.price+' 金幣',color:b.color},null,wrap);
 wrap.addEventListener('pointerenter',explain);wrap.addEventListener('focusin',explain);wrap.addEventListener('pointerleave',()=>{if(!wrap.contains(document.activeElement))hideTooltip();});wrap.addEventListener('focusout',event=>{if(!wrap.contains(event.relatedTarget))hideTooltip();});
 const info=button('查看'+b.name+' '+o.value+'的效果','help',explain);window.GameUI?.decorateButton(info,'help',{iconOnly:true});info.classList.add('purchase-info');wrap.append(buy,info);return wrap;
}
function renderTableDice(s){
 const box=$('#tableDice');box.hidden=!(s.rollEvents?.length);if(box.hidden)return;box.replaceChildren(node('h3','本回合擲骰結果 · 全桌公開'));const rows=node('div');rows.className='table-dice-grid';
 for(const e of s.rollEvents||[]){const item=node('article');item.append(QuacksFx.die(e.face,42),node('strong',e.name),node('span',QuacksFx.labels[e.face]),node('small',e.source));rows.append(item);}box.append(rows);
}
function renderFortune(s,live){
 const f=$('#fortune'),isDrawing=s.phase==='fortune',starter=s.players.find(p=>p.id===s.roundStarterId),key=JSON.stringify([isDrawing,s.fortune?.id,s.fortuneRevealId,s.roundStarterId]);
 if(f.dataset.renderKey===key)return;f.dataset.renderKey=key;
 f.dataset.timing=s.fortune?.timing||'unknown';f.classList.toggle('face-down',isDrawing);f.setAttribute('aria-label',isDrawing?'尚未翻開的占卜牌':'本輪占卜牌');
 if(isDrawing)f.replaceChildren(node('span','✦ 占卜牌 ✦'),node('h3',starter?.name+'抽牌'),node('p','由本回合的起始玩家親自抽取一張，之後輪流。'));
 else f.replaceChildren(node('span',s.fortune?(s.fortune.timing==='immediate'?'立即結算 · 紫色占卜':'本輪效果／回合結算 · 藍色占卜'):'本輪占卜'),node('h3',s.fortune?.name||'九回合的命運，等你揭曉'),node('p',s.fortune?.text||'每輪抽一張占卜牌，所有人同步抽藥。'));
 f.classList.remove('card-reveal');
 lastReveal=s.fortuneRevealId;
}
function renderBookVoting(s){
 const box=$('#bookVoting'),waiting=['waiting','finished'].includes(s.phase);box.hidden=!waiting||!s.bookSelection;
 if(box.hidden)return;box.replaceChildren(node('h2','一起搭配本局藥材書'),node('p','每種顏色獨立選一面，票數最多者採用；平票由房主在候選面中決定。可逐色選擇，也可隨機配好自己的選擇；測試 AI 不投票。'));
 box.append(button('隨機挑選','refresh',()=>act('book-random')));
 const grid=node('div');grid.className='book-grid';
 for(const row of s.bookSelection){
  const card=coloredCard(row.color,row.name),own=row.votes.find(v=>v.id===s.me),current=row.candidates.find(c=>c.set===(row.selected??own?.set??row.candidates[0].set));
  card.append(node('p',row.tied?'平票，等房主決定':'本局採用'+current.faceName),node('p',row.counts.map(v=>(row.candidates.find(c=>c.set===v.set)?.faceName||'第 '+v.set+' 面')+'：'+v.count+' 票').join(' · ')));
  if(row.candidates.length>1&&own){const label=node('label','你的選擇 '),select=node('select');select.setAttribute('aria-label',row.name+'藥材書面');for(const c of row.candidates){const option=node('option',c.faceName);option.value=c.set;option.selected=c.set===own.set;select.append(option);}select.onchange=()=>act('book-vote',{color:row.color,set:Number(select.value)});label.append(select);card.append(label);}
  else card.append(node('p','固定藥材書面'));
  const desc=node('details'),summary=node('summary','比較各面效果');desc.append(summary);for(const c of row.candidates)desc.append(node('h4',c.faceName),node('p',c.effect),node('small',c.offers.map(o=>'數值 '+o.value+' · '+o.price+' 金幣').join(' · ')));card.append(node('p',current.effect),desc);
  if(row.tied&&s.me===s.host){const ties=node('div');ties.className='tie-controls';ties.append(node('strong','房主決定平票'));for(const set of row.leaders)ties.append(button('採用'+row.candidates.find(c=>c.set===set).faceName,'check',()=>act('book-tie',{color:row.color,set})));card.append(ties);}
  grid.append(card);
 }box.append(grid);
}
function renderBooks(s){
 $('#books').replaceChildren(...s.books.map(b=>{const card=coloredCard(b.color,b.name+' · '+b.faceName);card.append(node('p',b.effect));const offers=node('div');offers.className='book-offers';for(const o of b.offers){const row=node('div');row.append(art.token({color:b.color,value:o.value},{size:40,decorative:true}),node('span','數值 '+o.value+' · '+o.price+' 金幣'));offers.append(row);}card.append(offers);return card;}));
}
function renderAlchemy(s){
 const host=$('#alchemy');host.hidden=!s.options.alchemists;if(host.hidden)return;host.replaceChildren(node('h2','煉金術士 · 特效藥'));
 const a=s.mine?.alchemy;if(!a)return;
 if(s.phase==='patients'){const grid=node('div');grid.className='patient-grid';for(const p of s.patients){const card=node('article');card.className='patient-card';card.append(art.patientPortrait(p.id),node('h3',p.name),node('p',p.text));const details=node('details');details.append(node('summary','查看各格獎勵'));for(const r of p.track)if(r.position)details.append(node('p',r.position+'格 · '+r.text));card.append(details,button(a.patientId===p.id?'已選擇':'選擇治療','check',()=>act('patient',{patientId:p.id})));grid.append(card);}host.append(node('p','每場隨機三名；每人治療一名，可與其他人選同一名。'),grid);return;}
 const patient=s.patients.find(p=>p.id===a.patientId);if(!patient)return;
 const info=node('div');info.className='alchemy-summary';info.append(art.patientPortrait(patient.id),node('div'));info.lastChild.append(node('h3',patient.name),node('p',patient.text),node('p','目前特效藥：'+a.essence+'格 · '+a.rewardText));host.append(info,art.essenceFlask(a.essence));
 if(a.calculation){const c=a.calculation;host.append(node('p','本輪計算：彩色種類 '+c.colors+' ＋ 白色恰好7 '+c.exactSeven+' ＋ 鄰座爆炸 '+c.explosions+' ＋ 愚人草 '+c.locoweed+' ＋ 占卜 '+c.fortune+' ＝ 最多 '+a.max+'格（上限10）'));}
 if(s.stage==='essence'&&!a.confirmed){host.append(node('p',s.round===9?'最後一輪：只領所選格數的分數，不領病患、骰子或鼠尾巴獎勵。':'選擇已到達格位並確認。較低格有時更適合你的策略。'));const grid=node('div');grid.className='essence-choices';for(let n=0;n<=a.max;n++)grid.append(button('確認 '+n+'格 · '+(s.round===9?n+'分':patient.track[n].text),'check',()=>act('essence',{position:n})));host.append(grid);}
 else{const details=node('details');details.append(node('summary','各格獎勵'));for(const r of patient.track)details.append(node('p',r.position+'格 · '+r.text));host.append(details);}
 if(a.pool?.length){const row=node('div');row.className='alchemy-pool';row.append(node('strong','只有你看得到的預抽藥材'));for(const c of a.pool)row.append(chip(c));host.append(row);}
}
const diceLabels=['1 分','1 分','2 分','1 顆紅寶石','液滴前進 1 格','南瓜 1'];
function bonusControls(box,s,m){
 box.append(node('h3','獎勵骰'),node('p',m.bonusEligible?'你的大釜在符合資格的玩家中進度最遠，可以擲骰。':'本輪無獎勵骰資格；進度相同的最遠玩家都能擲骰。'));
 const dice=node('div');dice.className='bonus-dice';for(const face of m.bonusDice||[]){const card=node('div');const icon=node('span');icon.innerHTML=window.GameUI.icon('dice');card.append(icon,node('strong',diceLabels[face]));dice.append(card);}box.append(dice);
 if(m.bonusEligible&&!m.bonusRolled)box.append(button('擲獎勵骰','dice',()=>act('roll-bonus')));
 else box.append(button('獎勵骰完成，查看藥材結算','check',()=>act('bonus-ready')));
}
function effectControls(box,s,m){
 box.append(node('h3','確認藥材結算'),node('p','先處理黑色、綠色、紫色效果，再領取格位獎勵；以下已套用，不會因確認重複領取。'));
 for(const color of ['black','green','purple']){const card=coloredCard(color,names[color]);for(const entry of m.effectSummary||[])if(entry.color===color)card.append(node('p',entry.text));box.append(card);}
 for(const entry of m.effectSummary||[])if(!['black','green','purple'].includes(entry.color))box.append(node('p',entry.text));
 box.append(button('確認藥材效果','check',()=>act('confirm-effects')));
}
function render(s){
 if(disposed||s.type!=='quacks'||state&&s.version<state.version)return;
 const live=sounds?.update(s);fx.update(s,live);for(const e of s.rollEvents||[])if(!seenRolls.has(e.id)){seenRolls.add(e.id);if(live)sounds?.play('dice-roll','quacks:'+e.id);}
 state=s;if(window.GameShell)window.GameShell.update(s);else window.RoomWaiting?.update(s);if(s.version===lastVersion)return;lastVersion=s.version;
 $('#game').hidden=false;$('#roomTag').textContent='房號 '+code;$('#connection').textContent='';
 $('#phase').textContent='郎中闖江湖 · '+({waiting:'等待開局',patients:'選擇病患',fortune:'第 '+s.round+' 回合 · 抽占卜牌',brewing:'第 '+s.round+' 回合 · '+(s.stage==='drawing'?'第 '+s.step+' 次同步抽藥':s.stage==='reserves'?'決定暫存藥材':'效果選擇'),settlement:'第 '+s.round+' 回合 · '+({witches:'結算前女巫',essence:'特效藥階段',bonus:'獎勵骰',effects:'藥材效果選擇','effects-confirm':'確認藥材效果',rewards:'領取格位獎勵',shopping:'購物與補瓶'})[s.stage],between:'本輪結算完成',finished:s.interrupted?'有人離席，本場中止':'九回合完成'})[s.phase];
 if(s.winner)$('#phase').append(document.createTextNode(' · 獲勝：'+s.winner.names.join('、')+'（'+s.winner.score+' 分）'));
 scoreboard.update(s,live);renderAlchemy(s);renderFortune(s,live);renderBookVoting(s);renderTableDice(s);
 $('#players').replaceChildren(...s.recipes.map(p=>{
  const a=node('article');a.className='player-card'+(p.id===s.me?' is-me':'')+(p.exploded?' exploded':'');
  if(p.explosionId&&!seenExplosion.has(p.explosionId)){seenExplosion.add(p.explosionId);if(previousState&&live){a.classList.add('burst');sounds?.play('explosion','quacks:'+p.explosionId);}}
  a.append(node('strong',p.name+(p.id===s.me?'（你）':'')),node('p',p.potName),node('p',p.score+' 分'),renderResources(s,p),node('p',p.exploded?'大釜爆炸':p.stopped?'已停止':p.chosen?'已選擇，等其他人':'準備選擇'));
  if(p.alchemy){const patient=s.patients.find(x=>x.id===p.alchemy.patientId);a.append(node('p',patient?patient.name+' · 特效藥 '+p.alchemy.essence+'格':'尚未選擇病患'));}
  if(p.hidden)a.append(node('p','大釜進度隱藏中'));
  else if(s.mine){a.append(node('p','第 '+p.position+' 格 · 白色炸彈 '+p.white+'／'+p.threshold));const row=node('div');row.className='chip-row';for(const c of p.pot.slice(-8))row.append(chip(c));a.append(row);}
  return a;
 }));
 window.RoomWaiting?.setRosterAction(null);botControl=null;$('#controls').replaceChildren();$('#witches').replaceChildren();const box=$('#controls'),m=s.mine,me=s.recipes.find(p=>p.id===s.me);
 if(['waiting','finished'].includes(s.phase)){
  drawPot(s);
  if(s.me===s.host){
   box.append(button('開始一場','play',()=>mutate('start',{}),s.players.length<2||s.bookSelection?.some(b=>b.tied)));
   botControl=button('加入測試 AI','users',()=>mutate('bot',{}),s.players.length>=(s.options.witches?5:4));if(!window.RoomWaiting?.setRosterAction(botControl))box.append(botControl);
   const field=node('fieldset'),legend=node('legend','開局設定');field.append(legend);
   const witches=node('input'),alchemists=node('input'),hidden=node('input');witches.type=alchemists.type=hidden.type='checkbox';witches.checked=s.options.witches;alchemists.checked=s.options.alchemists;hidden.checked=s.options.hiddenProgress;
   const a=node('label'),b=node('label');a.append(witches,document.createTextNode(' 加入草藥女巫擴充'));b.append(hidden,document.createTextNode(' 隱藏他人大釜進度'));const c=node('label');c.append(alchemists,document.createTextNode(' 加入煉金術士擴充'));field.append(a,c,b);
   const settings=node('details');settings.className='room-settings-panel';settings.append(node('summary','房間設定'),field,button('保存設定','save',()=>mutate('settings',{witches:witches.checked,alchemists:alchemists.checked,hiddenProgress:hidden.checked,...(!witches.checked&&s.options.bookSet>4?{bookSet:1}:{})})));box.append(settings);
  }else box.append(node('p','等待房主開局。'));
 }else if(m){
  drawPot(s);
  if(s.interrupted)box.append(node('p','本場已中止，回大廳另開新房。'));
  else if(m.pending){box.append(node('h3',m.pending.title));for(const o of m.pending.options)box.append(button(o.label,'check',()=>act('choice',{choiceId:m.pending.id,optionId:o.id}),o.disabled));}
  else if(m.waitingEffect)box.append(node('p','等待其他人完成藥材／占卜卡效果。'));
  else if(s.phase==='patients')box.append(node('p',m.alchemy?.patientId?'已選病患，等待其他人。':'在特效藥面板選一位病患，同場可以選相同病患。'));
  else if(s.phase==='fortune')box.append(s.me===s.roundStarterId?button('抽一張占卜牌','gift',()=>act('draw-fortune')):node('p','等 '+s.players.find(p=>p.id===s.roundStarterId)?.name+' 抽占卜牌。'));
  else if(s.phase==='brewing'){
   if(s.stage==='drawing'){
    if(m.canDraw){const draw=button('要拼！繼續抽！','play',()=>act('draw',{step:s.step})),stop=button('我不抽了QQ','close',()=>act('stop',{step:s.step}));draw.classList.add('draw-action');stop.classList.add('stop-action');box.append(draw,stop);}
    else box.append(node('p',me.stopped?'你已停止；等其他人完成。':'已選擇，等所有繼續抽藥者。'));
    if(m.canDraw)for(const c of m.alchemy?.drawablePool||[])box.append(button('改放預抽 '+names[c.color]+' '+c.value,'play',()=>act('draw',{step:s.step,chipId:c.id})));
    if(m.canPotion)box.append(button('使用藥水瓶：收回最後白色炸彈','help',()=>act('potion')));
   }
   for(const c of m.reserve){box.append(button('投入暫存 '+names[c.color]+' '+c.value,'play',()=>act('reserve',{chipId:c.id}),me.chosen||(s.options.books?.red??s.options.bookSet)===2&&!me.stopped));if(!c.must)box.append(button('暫存 '+names[c.color]+' '+c.value+' 放回藥袋','close',()=>act('reserve-return',{chipId:c.id}),me.chosen));}
   for(const c of m.alchemy?.pool||[])if(s.stage==='reserves'&&c.color==='red'&&(s.options.books?.red??s.options.bookSet)===2)box.append(button('投入預抽 '+names.red+' '+c.value,'play',()=>act('alchemy-pool',{chipId:c.id})));
   for(const c of m.alchemy?.returnable||[])box.append(button('收回 '+names[c.color]+' '+c.value+'（花'+c.value+'格特效藥）','close',()=>act('alchemy-return',{chipId:c.id})));
   if(s.stage==='reserves')box.append(button('暫存決定完成，其餘保留','check',()=>act('reserve-done'),m.reserve.some(c=>c.must)));
  }else if(s.phase==='settlement'){
   if(s.stage==='essence'){if(m.alchemy?.diceRemaining)box.append(button('擲特效藥骰（剩'+m.alchemy.diceRemaining+'次）','dice',()=>act('essence-roll')));else box.append(node('p',m.alchemy?.confirmed?'特效藥已確認，等待其他人與額外效果。':'到特效藥面板確認格位，可選已達到的較低格。'));}
   else if(m.ready)box.append(node('p','你已完成，等待其他人。'));
   else if(s.stage==='witches'){box.append(node('p','所有大釜已公開；可先使用適用女巫，然後開始結算。'),button('準備結算','check',()=>act('settle-ready')));}
   else if(s.stage==='bonus')bonusControls(box,s,m);
   else if(s.stage==='effects-confirm')effectControls(box,s,m);
   else if(s.stage==='rewards'){
    box.append(node('p',me.exploded?'爆炸後請選得分或購物；保護效果適用者仍可兩者兼得。':'可同時得分與購物。'));
    box.append(button(me.exploded?'我要勝利分數':'領取本輪獎勵','check',()=>act('reward',{mode:'score'})));
    if(me.exploded)box.append(button('我要買藥材','gift',()=>act('reward',{mode:'buy'})));
   }else if(s.stage==='shopping'){
    box.append(node('p','購物預算 '+m.budget+' 金幣 · 本輪買入 '+m.bought.length+'／2 片'));
    if(s.round===9)box.append(node('p','第九輪不再買藥材；完成結算時，剩餘可用預算每 5 金幣轉 1 分。'));
    else{
     const grid=node('div');grid.className='purchase-grid';
     for(const b of s.books)for(const o of b.offers)grid.append(purchaseOffer(s,b,o,'buy',!m.canBuy||m.budget<o.price||m.bought.length>=2||m.bought.some(c=>c.color===b.color)));
     box.append(grid);
     if(m.extraBudget>0&&m.extraBought.length<2){box.append(node('h3','幽靈氣息獨立預算：'+m.extraBudget));for(const b of s.books)for(const o of b.offers)if(o.price<=m.extraBudget&&!m.extraBought.some(c=>c.color===b.color))box.append(purchaseOffer(s,b,o,'extra-buy',false));}
     box.append(button('補滿藥水瓶（'+m.discount+' 顆紅寶石）','help',()=>act('ruby',{mode:'refill'}),m.potion||me.rubies<m.discount),button('液滴前進 1 格（'+m.discount+' 顆紅寶石）','next',()=>act('ruby',{mode:'droplet'}),me.rubies<m.discount));
    }
    box.append(button('完成本輪結算','check',()=>act('shop-ready')));
   }
  }else if(s.phase==='between')box.append(s.me===s.host?button('開始下一回合','next',()=>act('next')):node('p','等房主開始下一回合。'));
  if(m.canGoodNeighbor)box.append(button('好鄰居：白色炸彈3進袋，其他人各拿2紅寶石','gift',()=>act('fortune-neighbor')));
  if(s.visitingWitch){const visit=node('div');visit.className='witch-row';visit.append(node('strong','免費來訪女巫 · '+s.visitingWitch.name),node('p',s.visitingWitch.text),button('免費使用來訪女巫','help',()=>act('free-witch'),!m.canVisit));$('#witches').append(visit);}
  for(const [color,w]of Object.entries(s.witches)){const a=node('div');a.className='witch-row';a.append(art.resource(color,{size:44,decorative:true}),node('strong',w.name+' · '+({gold:'金',copper:'銅',silver:'銀'})[color]+'幣'+(m.coins[color]?'尚未使用':'已使用')),node('p',w.text),button('使用'+w.name,'help',()=>act('witch',{color}),!m.witchAvailable[color]));$('#witches').append(a);}
 }
 renderBooks(s);
 $('#results').replaceChildren(...s.results.map(r=>{const a=node('article');a.append(node('h3','第 '+r.round+' 回合 · '+r.fortune.name));for(const p of r.players)a.append(node('p',p.name+' · '+(p.exploded?'爆炸':'安全')+' · 普通抽藥 '+p.draws+' 片 · 累計 '+p.score+' 分'));return a;}));
 previousState=s;lock();
}
async function refresh(){if(disposed||reading)return;reading=true;try{render(await api('state'));}catch(e){if(!disposed&&e.name!=='AbortError'){sounds?.disconnect();fx.clear();$('#connection').textContent='連線中斷：'+e.message;}}finally{reading=false;}}
async function start(){disposed=false;scope=new AbortController();try{await RoomReconnect.restore(code,'quacks','#connection',{signal:scope.signal});if(disposed)return;await refresh();timer=setInterval(()=>{if(!document.hidden)refresh();},1200);}catch(e){if(e.name!=='AbortError')$('#feedback').textContent=e.message;}}
$('#retry').onclick=()=>retry&&mutate(retry.route,retry.data);
$('#leave').onclick=async()=>{if(busy||!confirm('離席會中止本場，確定離開？'))return;await mutate('leave',{});if(!retry&&!$('#feedback').textContent){RoomReconnect.forget(code);location.replace('/?game=quacks');}};
document.addEventListener('keydown',event=>{if(event.key==='Escape')hideTooltip();});window.addEventListener('scroll',hideTooltip,true);

$('#bagButton').onclick=()=>{bagViewerId=viewedPotId;renderBag(state);$('#bagDialog').showModal();};
$('#peekBag').onclick=()=>act('peek-bag');$('#closeBag').onclick=closeBag;$('#bagDialog').addEventListener('cancel',event=>{event.preventDefault();closeBag();});
$('#customizePot').onclick=()=>{const p=state.recipes.find(p=>p.id===state.me);$('#potNameInput').value=p.potName;renderPotCustomization(state);$('#potCustomize').showModal();};
$('#closeCustomize').onclick=()=>$('#potCustomize').close();
$('#potNameForm').onsubmit=event=>{event.preventDefault();act('name-pot',{name:$('#potNameInput').value});};
const updateSound=()=>{$('#soundToggle').textContent=AudioSettings.get().effects.enabled?'遊戲音效已開啟':'開啟遊戲音效';$('#soundToggle').setAttribute('aria-pressed',String(AudioSettings.get().effects.enabled));};
$('#soundToggle').onclick=()=>AudioSettings.set('effects',{enabled:!AudioSettings.get().effects.enabled},{gesture:true});AudioSettings.subscribe(updateSound);

if(!code){$('#guide').open=true;$('#connection').textContent='從大廳建立房間開始。';return;}
window.addEventListener('pagehide',()=>{disposed=true;clearInterval(timer);scope?.abort();sounds?.reset();fx.clear();});window.addEventListener('pageshow',e=>{if(e.persisted){lastVersion=-1;start();}});start();
})();
