(()=>{
'use strict';
const $=s=>document.querySelector(s),code=location.pathname.match(/^\/quacks\/([a-f0-9]{6})\/?$/i)?.[1]?.toUpperCase(),names={white:'白色炸彈',orange:'南瓜',blue:'烏鴉頭骨',red:'毒蘑菇',yellow:'曼德拉草',green:'花園蜘蛛',black:'非洲骷髏天蛾',purple:'幽靈氣息',locoweed:'愚人草'},colors={white:'#d9f1ef',orange:'#d87e20',blue:'#3280b5',red:'#bf4348',yellow:'#d7b936',green:'#40906a',black:'#273b49',purple:'#995ec1',locoweed:'#dd719e'};
let state,scope,timer,busy=false,reading=false,disposed=false,retry=null,lastVersion=-1,previousState=null,botControl=null;
const sounds=window.GameSounds?.create(),seenExplosion=new Set(),node=(t,text)=>{const n=document.createElement(t);if(text!==undefined)n.textContent=text;return n;};
function button(label,icon,fn,blocked=false){const b=node('button',label);b.type='button';b.dataset.blocked=String(blocked);b.onclick=fn;window.GameUI?.decorateButton(b,icon,{iconOnly:!['check','play','close'].includes(icon)});return b;}
function lock(){if(botControl)botControl.disabled=busy||botControl.dataset.blocked==='true';for(const b of document.querySelectorAll('#controls button,#controls input,#controls select,#qStageContent button,#qStageContent input,#qStageContent select,#qPotionSlot button,#qExtraContent button,#qExtraContent input,#qExtraContent select,#qWaitingControls [data-room-read-only=false] button,#qWaitingControls [data-room-read-only=false] input,#qWaitingControls [data-room-read-only=false] select'))b.disabled=busy||b.dataset.blocked==='true';for(const b of document.querySelectorAll('#witches button,#bookVoting button,#bookVoting select,#potTabs button,#alchemy button'))b.disabled=busy||b.dataset.blocked==='true';$('#bagButton').disabled=busy;$('#peekBag').disabled=busy||!state?.mine?.peekAvailable;for(const slot of document.querySelectorAll('#alchemy [data-quacks-action]'))slot.setAttribute('aria-disabled',String(busy||slot.dataset.blocked==='true'));for(const b of $('#potColors').querySelectorAll('button'))b.disabled=busy||b.dataset.blocked==='true';$('#savePotName').disabled=busy;$('#leave').disabled=busy;$('#retry').disabled=busy;}
async function api(route,data){return RoomApi.request(route,data,{code,room:'quacks',session:true,signal:scope.signal});}
async function mutate(route,data){if(busy||disposed)return;busy=true;retry=null;$('#retry').hidden=true;$('#feedback').textContent='';lock();try{const s=await api(route,data);if(!disposed)render(s);return true;}catch(e){if(!disposed&&e.name!=='AbortError'){$('#feedback').textContent=e.message;if(!e.status){retry={route,data};$('#retry').hidden=false;}}return false;}finally{busy=false;if(!disposed){lock();refresh();}}}
const act=(action,extra={})=>mutate('action',{action,roundId:state.roundId,requestId:crypto.randomUUID(),...extra});
const settingsAuto=window.GameShell.autoSaveSettings({canSave:()=>state?.me===state?.host&&['waiting','finished'].includes(state?.phase),isBusy:()=>busy,read:()=>Object.fromEntries(['witches','alchemists','hiddenProgress'].map(k=>[k,document.querySelector('[data-quacks-setting="'+k+'"]').checked])),save:async data=>{bookSetupReady=false;if(!await mutate('settings',{...data,...(!data.witches&&state.options.bookSet>4?{bookSet:1}:{})}))throw Error($('#feedback').textContent||'設定更新失敗');}});


const art=window.QuacksArt,scoreboard=window.QuacksFx.createScoreboard($('#scoreboard')),zoomScoreboard=window.QuacksFx.createScoreboard($('#scoreZoomBoard'),$('#scoreZoomLegend')),fx=window.QuacksFx.create($('#quacksFx')),explosionFx=window.QuacksFx.createExplosion($('#quacksExplosion')),audioFx=window.QuacksFx.createAudio(sounds);const seenRolls=new Set();

let bookSetupReady=false;
let viewedPotId=null,potKey='',lastReveal=null,tooltipOwner=null;
function hint(anchor,details){
 anchor.quacksInsight=details;if(anchor.dataset.quacksHint)return anchor;anchor.dataset.quacksHint='true';
 anchor.tabIndex=anchor.tabIndex<0?0:anchor.tabIndex;anchor.classList.add('quacks-inspect');
 const data=()=>typeof anchor.quacksInsight==='function'?anchor.quacksInsight():anchor.quacksInsight;
 anchor.setAttribute('aria-label',data().title);
 const show=e=>{e?.stopPropagation();inspectPot(data(),e,anchor);};
 anchor.addEventListener('pointerenter',show);anchor.addEventListener('focus',show);anchor.addEventListener('click',show);
 anchor.addEventListener('pointerleave',e=>{if(e.pointerType!=='touch')hideTooltip(anchor);});
 anchor.addEventListener('focusout',e=>{if(!anchor.contains(e.relatedTarget))hideTooltip(anchor);});
 return anchor;
}
function ingredientHint(anchor,c,book){
 return hint(anchor,()=>({title:names[c.color]+' · '+c.value,effect:book?.effect||art.lookup(state,c.color)?.effect||(c.color==='white'?'白色炸彈數值總和超過本輪門檻時爆炸。':'按數值前進。'),caption:book?.faceName||'',color:c.color}));
}
function rewardTrack(patient,value,selection=null,calculation=null){
 const flask=art.essenceFlask(value);flask.setAttribute('role','group');
 const rules='大釜每種彩色藥材＋1；白色炸彈合計恰好7再＋1；左右鄰座每人爆炸＋1（兩人局不重複算）；愚人草第7面每片＋1；特定占卜牌再加成。每輪重新累積，最多10格。';
 const c=calculation;const sum=c?c.colors+c.exactSeven+c.explosions+c.locoweed+c.fortune:null;hint(flask.querySelector('.essence-vessel'),{title:'特效藥如何累積',effect:rules,caption:c?'本回合彩色 '+c.colors+'＋白色恰好7 '+c.exactSeven+'＋鄰座爆炸 '+c.explosions+'＋愚人草 '+c.locoweed+'＋占卜牌 '+c.fortune+'＝'+sum+'，最多 '+Math.min(10,sum)+' 格':'回合結算時依大釜計算；推進後仍由你確認領獎。',color:'alchemy'});
 for(const slot of flask.querySelectorAll('[data-essence]')){
  const n=Number(slot.dataset.essence),effect=selection?.final?n+' 分（最後一回合不領取其他病患獎勵）':patient.track[n].text;
  hint(slot,{title:patient.name+' · 第 '+n+' 格',effect,caption:selection?(n<=selection.max?'點選此格確認本輪獎勵。':'尚未達到此格。'):'',color:'alchemy'});
  if(selection){slot.setAttribute('role','button');slot.dataset.quacksAction='essence';slot.dataset.blocked=String(n>selection.max);slot.classList.toggle('essence-selectable',n<=selection.max);
   const choose=()=>{if(!busy&&n<=selection.max)act('essence',{position:n});};
   slot.addEventListener('click',choose);slot.addEventListener('keydown',e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();choose();}});
  }
 }
 return flask;
}

function chip(c){const n=node('span');n.className='chip';n.append(art.token(c,{size:42,decorative:true}));return ingredientHint(n,c);}
function coloredCard(color,heading){const a=node('article');a.className='book-card';a.dataset.ingredient=color;a.style.setProperty('--ingredient',art.palette[color][0]);const h=node('div');h.className='book-heading';h.append(art.token({color,value:1},{size:58,decorative:true}),node('h3',heading));a.append(h);ingredientHint(h.querySelector('.ingredient-token'),{color,value:1});return a;}
function hideTooltip(anchor){
 if(window.QuacksStitch?.dismissTooltip)return window.QuacksStitch.dismissTooltip(anchor);
 const tip=$('#potTooltip');tooltipOwner?.removeAttribute('aria-describedby');tooltipOwner=null;
 if(tip.matches(':popover-open'))tip.hidePopover();tip.hidden=true;
}

function inspectPot(details,event,anchor){
 if(window.QuacksStitch?.inspectTooltip)return window.QuacksStitch.inspectTooltip(details,anchor);
 anchor.quacksDisplayedInsight=details;const tip=$('#potTooltip');hideTooltip();tip.replaceChildren(node('strong',details.title),node('p',details.effect),node('small',details.caption));tip.dataset.ingredient=details.color;tip.hidden=false;tooltipOwner=anchor;anchor.setAttribute('aria-describedby','potTooltip');if(typeof tip.showPopover==='function')tip.showPopover();
 const rect=anchor.getBoundingClientRect(),width=tip.getBoundingClientRect().width,height=tip.getBoundingClientRect().height;
 const left=Math.max(8,Math.min(innerWidth-width-8,rect.left+rect.width/2-width/2)),top=Math.max(8,Math.min(innerHeight-height-8,rect.bottom+10));
 tip.style.left=left+'px';tip.style.top=top+'px';
}
function drawPot(s){
 const p=art.selectRecipe(s,viewedPotId);viewedPotId=p.id;$('#potHeading').textContent=p.potName||p.name+'的好運釜';const markers=art.markerPositions(p);$('#customizePot').hidden=p.id!==s.me;$('#potMarkerSummary').replaceChildren(...[['droplet',markers.droplet,'永久水滴起點'],['rat',markers.start,'本輪老鼠石起點']].map(([kind,value,label])=>{const item=node('span');item.className='resource-pill';item.append(art.resource(kind,{size:28,decorative:true}),node('strong',String(value)));hint(item,{title:label+' · 第 '+value+' 格',effect:kind==='droplet'?'永久保留的起點。':'本回合鼠尾巴加成後的起點。',caption:'金色圈表示目前進度第 '+p.position+' 格。',color:kind});return item;}));
 $('#potTabs').replaceChildren(...s.recipes.map(q=>{const b=button(q.name+(q.id===s.me?'（你）':q.hidden?' · 未公開':''),'users',()=>{viewedPotId=q.id;drawPot(state);},!art.canInspect(s,q));window.GameUI?.decorateButton(b,'users',{iconOnly:true});b.style.setProperty('--pot-tab-color',s.potColors?.[q.potColor]?.liquid[1]||'#547663');b.setAttribute('aria-pressed',q.id===p.id?'true':'false');b.classList.toggle('selected',q.id===p.id);return b;}));
 const key=JSON.stringify([p.id,p.potName,p.potColor,p.position,p.startPosition,p.droplet,p.rat,p.pot,p.exploded,p.stopped,s.books,s.options.books]);
 if(key!==potKey){potKey=key;hideTooltip();const svg=art.cauldron(s,p,inspectPot,hideTooltip);svg.addEventListener('pointerleave',e=>{if(e.pointerType!=='touch')hideTooltip();});svg.addEventListener('focusout',event=>{if(!svg.contains(event.relatedTarget))hideTooltip();});$('#cauldron').replaceChildren(svg);}
 window.QuacksStitch?.potUpdated(s);renderPotBadge(s,p);renderBag(s);renderPotCustomization(s);if(state&&!['waiting','finished'].includes(state.phase))arrangePotActions(state);
}

let bagViewerId=null;
function renderBag(s){
 const selected=art.selectRecipe(s,viewedPotId),bagButton=$('#bagButton');
 bagButton.replaceChildren(art.resource('bag',{size:48,decorative:true}),node('strong',String(selected.bagCount??0)));bagButton.setAttribute('aria-label',(selected.id===s.me?'我的':selected.name+'的')+'藥袋，剩餘 '+(selected.bagCount??0)+' 片');bagButton.dataset.uiHint='';bagButton.disabled=busy;
 const p=s.recipes.find(p=>p.id===bagViewerId)||selected,own=p.id===s.me,m=own?s.mine:null;
 $('#bagDialogTitle').textContent=own?'我的藥袋與暫存藥材':p.name+'的藥袋';
 $('#bagTotal').textContent='袋中剩餘 '+(p.bagCount??0)+' 片'+(own&&m?' · 藥水瓶'+(m.potion?'已裝滿':'空瓶'):'');
 $('#peekBag').hidden=!own;$('#peekBag').disabled=busy||!m?.peekAvailable;$('#peekBag').textContent=m?.peekUsed?'本回合查看機會已使用':'查看真正內容（每回合一次）';
 const content=$('#bag'),peek=m?.bagPeek;
 if(peek){const counts=new Map();for(const c of peek.chips){const key=c.color+':'+c.value;if(!counts.has(key))counts.set(key,{...c,count:0});counts.get(key).count++;}
 const grid=node('div');grid.className='bag-grid';for(const c of counts.values()){const item=node('div');item.className='bag-item';item.append(art.token(c,{size:50,decorative:true}),node('strong','× '+c.count));ingredientHint(item,c);grid.append(item);}
 content.replaceChildren(node('p','第 '+peek.round+' 回合查看當下的內容；關閉後本回合不能再查看。'),grid);
 }else content.replaceChildren(node('p',own?'平常只顯示總數，每人每回合可查看一次自己的內容。':'其他人的藥袋只公開總數。'));
 $('#reserve').replaceChildren(...(m?.reserve||[]).map(c=>{const p=node('p');p.className='reserve-item';p.append(chip(c),document.createTextNode(c.must?'本輪必須投入':'暫存'));return p;}));
 if(own&&m&&!m.reserve.length)$('#reserve').append(node('p','目前沒有暫存藥材。'));
}
async function closeBag(){if(busy)return;if(state?.mine?.bagPeek&&bagViewerId===state.me){await act('close-bag');if(state.mine.bagPeek)return;}$('#bagDialog').close();bagViewerId=null;}
function renderResources(s,p){
 const row=node('div');row.className='resource-row';
 for(const [kind,value,label]of [['bag',p.bagCount??0,'藥袋'],['ruby',p.rubies??0,'紅寶石'],['rat',p.rat??0,'老鼠尾巴']]){
  const item=node('span');item.className='resource-pill';item.append(art.resource(kind,{size:27,decorative:true}),node('strong',String(value)));
  hint(item,{title:label+' '+value,effect:kind==='bag'?'藥袋剩餘總數；內容僅本人每回合查看一次。':kind==='rat'?'本回合老鼠尾巴加成。':'可補滿藥水瓶或推進永久水滴。',caption:'',color:kind});row.append(item);
 }
 if(s.options.witches&&p.coins){const coins=node('div');coins.className='witch-coins';for(const color of ['gold','copper','silver']){
  const coin=node('span');coin.className='coin-status'+(p.coins[color]?'':' used');coin.append(art.resource(color,{size:27,decorative:true}));
  hint(coin,{title:({gold:'金',copper:'銅',silver:'銀'})[color]+'女巫幣'+(p.coins[color]?'尚未使用':'已使用'),effect:s.witches[color]?.text||'',caption:s.witches[color]?.name||'',color});coins.append(coin);
 }row.append(coins);}return row;
}
function renderPotBadge(s,p){
 const badge=$('#potBadge');badge.replaceChildren(node('strong',p.name+(p.id===s.me?'（你）':'')),renderResources(s,p));
 const score=node('span');score.className='pot-score';score.innerHTML=window.GameUI.symbol('star');score.append(node('strong',String(p.score)));score.setAttribute('aria-label',p.score+' 分');score.dataset.uiHint='';badge.append(score);
 const status=p.exploded?'大釜爆炸':p.stopped?'已停止':p.chosen?'等待其他人':null;if(status)badge.append(node('small',status));
 if(p.alchemy){const patient=s.patients.find(x=>x.id===p.alchemy.patientId);if(patient){const pill=node('span');pill.className='patient-pill';pill.append(art.patientPortrait(patient.id),node('strong',String(p.alchemy.essence)));hint(pill,{title:patient.name+' · 特效藥 '+p.alchemy.essence+' 格',effect:patient.text,caption:'',color:'alchemy'});badge.append(pill);}}
 if(p.hidden)badge.append(node('small','進度未公開'));
 else{const bomb=node('span');bomb.className='resource-pill';bomb.append(art.token({color:'white',value:1},{size:27,decorative:true}),node('strong',p.white+' / '+p.threshold));hint(bomb,{title:'白色炸彈 '+p.white+' / '+p.threshold,effect:'數值合計超過門檻時爆炸。',caption:'目前第 '+p.position+' 格',color:'white'});badge.append(bomb);}
 badge.classList.toggle('exploded',p.exploded);
}

function renderPotCustomization(s){
 const own=s.recipes.find(p=>p.id===s.me),grid=$('#potColors');grid.replaceChildren();
 for(const [color,theme]of Object.entries(s.potColors||{})){const taken=s.recipes.find(p=>p.id!==s.me&&p.potColor===color),b=button(theme.name+(taken?' · '+taken.name+'使用中':''),'check',()=>act('color-pot',{color}),!!taken);b.className+=' pot-swatch';b.style.setProperty('--swatch',theme.liquid[1]);b.setAttribute('aria-pressed',String(own.potColor===color));grid.append(b);}
 $('#potOwner').textContent=(viewedPotId===s.me?'你的大釜':s.recipes.find(p=>p.id===viewedPotId)?.name+'的大釜');
}
function purchaseOffer(s,b,o,action,blocked){
 const wrap=node('div');wrap.className='purchase-offer';
 const extra=action==='extra-buy',selected=(extra?s.mine.extraBought:s.mine.bought).find(c=>c.color===b.color&&c.value===o.value);const buy=button((selected?'取消購買 ':extra?'額外購買 ':'購買 ')+b.name+' '+o.value+'，'+o.price+' 金幣','ingredient',()=>selected?act('unbuy',{color:b.color,value:o.value,extra}):act(action,{color:b.color,value:o.value}),selected?!selected.canUndo:blocked);buy.setAttribute('aria-pressed',String(!!selected));buy.dataset.selected=String(!!selected);buy.dataset.purchaseColor=b.color;buy.dataset.purchaseValue=String(o.value);
 buy.classList.add('ingredient-purchase');buy.prepend(art.token({color:b.color,value:o.value},{size:42,decorative:true}));
 const price=node('span');price.className='purchase-price';price.innerHTML=window.GameUI.symbol('coins');price.append(node('strong',String(o.price)));buy.append(price);
 hint(wrap,{title:b.name+' · '+o.value,effect:b.effect,caption:b.faceName+' · '+o.price+' 金幣'+(selected?(selected.canUndo?' · 再點一次取消，退還預算':' · 已用於後續效果，無法取消'):''),color:b.color});
 wrap.append(buy);return wrap;
}

function renderTableDice(s){
 const box=$('#tableDice');box.hidden=!(s.rollEvents?.length);if(box.hidden)return;box.replaceChildren(node('h3','本回合擲骰結果 · 全桌公開'));const rows=node('div');rows.className='table-dice-grid';
 for(const e of s.rollEvents||[]){const item=node('article');item.dataset.rollId=e.id;item.dataset.playerId=e.playerId;item.dataset.potColor=e.potColor||s.recipes.find(p=>p.id===e.playerId)?.potColor;item.append(QuacksFx.die(e.face,42,s.potColors?.[e.potColor||s.recipes.find(p=>p.id===e.playerId)?.potColor]?.liquid),node('strong',e.name));hint(item,{title:e.name+' · '+QuacksFx.labels[e.face],effect:e.source,caption:'本輪公開擲骰結果',color:'dice'});rows.append(item);}box.append(rows);
}
function renderFortune(s,live){
 const f=$('#fortune'),isDrawing=s.phase==='fortune',starter=s.players.find(p=>p.id===s.roundStarterId),key=JSON.stringify([isDrawing,s.fortune?.id,s.fortuneRevealId,s.roundStarterId]);
 if(f.dataset.renderKey===key)return;f.dataset.renderKey=key;
 f.dataset.timing=s.fortune?.timing||'unknown';f.classList.toggle('face-down',isDrawing);f.setAttribute('aria-label',isDrawing?'尚未翻開的占卜牌':'本輪占卜牌');
 if(isDrawing)f.replaceChildren(node('span','✦ 占卜牌 ✦'),node('h3',starter?.name+'抽牌'),node('p','由本回合的起始玩家親自抽取一張，之後輪流。'));
 else f.replaceChildren(node('h3',s.fortune?.name||'九回合的命運，等你揭曉'),node('p',s.fortune?.text||'每輪抽一張占卜牌，所有人同步抽藥。'));
 f.classList.remove('card-reveal');
 lastReveal=s.fortuneRevealId;
}
const bookPages=new Map();let bookVotingKey='',bookHelpOpen=false;
function renderBookVoting(s){
 const box=$('#bookVoting'),waiting=['waiting','finished'].includes(s.phase);box.hidden=!waiting||!s.bookSelection||(s.me===s.host&&!bookSetupReady);
 if(box.hidden){bookVotingKey='';return;}
 const key=JSON.stringify([s.phase,s.me,s.host,s.bookSelection,[...bookPages],bookHelpOpen]);if(key===bookVotingKey)return;bookVotingKey=key;
 const focused=document.activeElement?.dataset?.bookControl;
 const heading=node('div');heading.className='book-voting-heading';
 const explanation='每種顏色選一面，全桌同步採用最後一次選擇。左右翻面只查看效果，按「選擇」才會更換本局藥材書；也可隨機搭配。';
 const help=button(explanation,'notice',()=>{bookHelpOpen=!bookHelpOpen;renderBookVoting(state);});window.GameUI?.decorateButton(help,'notice',{iconOnly:true,label:explanation});help.dataset.bookControl='help';help.setAttribute('aria-expanded',String(bookHelpOpen));help.setAttribute('aria-controls','bookVotingHelp');
 const subtitle=node('p',explanation);subtitle.id='bookVotingHelp';subtitle.className='book-voting-help';subtitle.hidden=!bookHelpOpen;
 const random=button('隨機挑選','refresh',()=>act('book-random'));window.GameUI?.decorateButton(random,'refresh',{iconOnly:true,label:'隨機挑選藥材書'});random.dataset.bookControl='random';
 heading.append(node('h2','本局藥材書選擇'),help,random);box.replaceChildren(heading,subtitle);
 if(s.me===s.host){const settings=button('調整房間設定','settings',()=>{bookSetupReady=false;lastVersion=-1;render(state);requestAnimationFrame(()=>document.querySelector('.ui-room-settings-card')?.scrollIntoView({block:'start',behavior:'instant'}));});settings.dataset.bookControl='settings';heading.insertBefore(settings,random);}
 const grid=node('div');grid.className='book-grid';
 for(const row of s.bookSelection){
  const current=row.candidates.find(c=>c.set===bookPages.get(row.color))||row.candidates.find(c=>c.set===row.selected)||row.candidates[0];
  bookPages.set(row.color,current.set);
  const card=node('article');card.className='book-card book-vote-card';card.dataset.ingredient=row.color;card.style.setProperty('--ingredient',art.palette[row.color][0]);card.setAttribute('aria-label',row.name+'藥材書');
  const selected=row.selected===current.set,mark=node('span',selected?'已選':'已選第 '+row.selected+' 面');mark.className=selected?'book-selected-stamp':'book-selected-label';card.append(mark);
  const top=node('div');top.className='book-page-top';top.append(art.token({color:row.color,value:1},{size:76,decorative:true}),node('h3',row.name),node('small','第 '+current.set+' 面'));
  const prices=node('div');prices.className='book-page-prices';prices.setAttribute('aria-label',row.name+'第 '+current.set+' 面價格');
  for(const o of current.offers){const price=node('div');price.append(art.token({color:row.color,value:o.value},{size:48,decorative:true}),node('strong',o.price+' 金幣'));price.setAttribute('aria-label','數值 '+o.value+'，'+o.price+' 金幣');prices.append(price);}top.append(prices);
  const effect=node('div');effect.className='book-page-effect';
  // Overlay every face in one grid cell so the longest text reserves the height.
  for(const candidate of row.candidates){const copy=node('p',candidate.effect);copy.className='book-effect-copy';if(candidate.set!==current.set){copy.classList.add('book-effect-measure');copy.setAttribute('aria-hidden','true');}effect.append(copy);}
  const controls=node('div');controls.className='book-page-controls';
  function turn(delta){if(busy)return;const index=row.candidates.findIndex(c=>c.set===current.set);bookPages.set(row.color,row.candidates[(index+delta+row.candidates.length)%row.candidates.length].set);renderBookVoting(state);lock();}
  for(const [direction,delta]of [['previous',-1],['next',1]]){const b=button(row.name+(delta<0?'上一面':'下一面'),direction,()=>turn(delta),row.candidates.length===1);window.GameUI?.decorateButton(b,direction,{iconOnly:true});b.dataset.bookControl=row.color+'-'+direction;controls.append(b);}
  const faces=node('div');faces.className='q-book-faces';faces.setAttribute('role','group');faces.setAttribute('aria-label',row.name+'選擇要查看的書面');for(const candidate of row.candidates){const face=node('button','第 '+candidate.set+' 面');face.type='button';face.onclick=()=>{bookPages.set(row.color,candidate.set);renderBookVoting(state);};face.dataset.blocked=String(candidate.set===current.set);face.className='q-book-face';face.dataset.bookControl=row.color+'-face-'+candidate.set;face.setAttribute('aria-pressed',String(candidate.set===current.set));faces.append(face);}controls.insertBefore(faces,controls.lastChild);
  const choose=button('選擇','check',()=>act('book-select',{color:row.color,set:current.set}),selected||row.candidates.length===1);choose.dataset.bookControl=row.color+'-choose';choose.setAttribute('aria-label','選擇'+row.name+'第 '+current.set+' 面');choose.setAttribute('aria-pressed',String(selected));controls.insertBefore(choose,controls.lastChild);
  controls.addEventListener('keydown',event=>{if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();turn(event.key==='ArrowLeft'?-1:1);}});
  const who=s.players.find(p=>p.id===row.chosenBy),tally=node('small',row.candidates.length===1?'固定書面':'本局採用第 '+row.selected+' 面');tally.className='book-vote-result';
  const author=node('small',who?'由 '+who.name+' 選擇':'預設效果');author.className='book-vote-counts';
  const left=node('section'),right=node('section');left.className='q-book-page q-book-page-left';right.className='q-book-page q-book-page-right';left.append(mark,top);right.append(effect,controls,tally,author);card.replaceChildren(left,right);
  grid.append(card);
 }box.append(grid);window.QuacksStitch?.syncBookTabs?.();bookVotingKey=JSON.stringify([s.phase,s.me,s.host,s.bookSelection,[...bookPages],bookHelpOpen]);lock();if(focused)box.querySelector('[data-book-control="'+focused+'"]')?.focus({preventScroll:true});
}
function renderBooks(s){
 $('#books').replaceChildren(...s.books.map(b=>{const card=coloredCard(b.color,b.faceName);ingredientHint(card.querySelector('.ingredient-token'),{color:b.color,value:1},b);const offers=node('div');offers.className='book-offers';
  for(const o of b.offers){const row=node('div');row.append(art.token({color:b.color,value:o.value},{size:40,decorative:true}),node('strong',String(o.price)));ingredientHint(row,{color:b.color,value:o.value},b);offers.append(row);}card.append(offers);return card;
 }));
}

function renderAlchemy(s){
 const host=$('#alchemy');host.hidden=!s.options.alchemists;if(host.hidden)return;host.replaceChildren(node('h2','煉金術士 · 特效藥'));
 const a=s.mine?.alchemy;if(!a)return;
 if(s.phase==='patients'){const grid=node('div');grid.className='patient-grid';for(const p of s.patients){const card=node('article');card.className='patient-card';const portrait=art.patientPortrait(p.id);hint(portrait,{title:p.name,effect:p.text,caption:'',color:'alchemy'});card.append(portrait,node('h3',p.name));card.append(rewardTrack(p,0),button(a.patientId===p.id?'已選擇':'選擇治療','check',()=>act('patient',{patientId:p.id})));grid.append(card);}host.append(node('p','每場隨機三名；每人治療一名，可與其他人選同一名。'),grid);return;}
 const patient=s.patients.find(p=>p.id===a.patientId);if(!patient)return;
 const portrait=art.patientPortrait(patient.id);hint(portrait,{title:patient.name,effect:patient.text,caption:a.rewardText||'',color:'alchemy'});
 const info=node('div');info.className='alchemy-summary';info.append(portrait,node('h3',patient.name));
 const selecting=s.stage==='essence'&&!a.confirmed&&!s.mine.pending&&!s.mine.waitingEffect;
 host.append(info,rewardTrack(patient,selecting?a.max:a.essence,selecting?{max:a.max,final:s.round===9}:null,a.calculation));
 if(selecting)host.append(button('確認特效藥第 '+a.max+' 格','check',()=>act('essence',{position:a.max})));
 if(a.calculation){const c=a.calculation;hint(info,{title:patient.name,effect:patient.text,caption:'本輪特效藥 '+c.colors+'＋'+c.exactSeven+'＋'+c.explosions+'＋'+c.locoweed+'＋'+c.fortune+'＝最多 '+a.max+' 格',color:'alchemy'});}

 if(a.pool?.length){const row=node('div');row.className='alchemy-pool';row.append(node('strong','只有你看得到的預抽藥材'));for(const c of a.pool)row.append(chip(c));host.append(row);}
}
const diceLabels=['1 分','1 分','2 分','1 顆紅寶石','水滴前進 1 格','南瓜 1'];
function bonusControls(box,s,m){
 box.append(node('h3','獎勵骰'),node('p',m.bonusEligible?'你的大釜在符合資格的玩家中進度最遠，可以擲骰。':'本輪無獎勵骰資格；進度相同的最遠玩家都能擲骰。'));
 const dice=node('div');dice.className='bonus-dice';for(const face of m.bonusDice||[]){const card=node('div');const icon=node('span');icon.innerHTML=window.GameUI.icon('dice');card.append(icon,node('strong',diceLabels[face]));dice.append(card);}box.append(dice);
 if(m.bonusEligible&&!m.bonusRolled)box.append(button('擲獎勵骰','dice',()=>act('roll-bonus')));
 else box.append(button('獎勵骰完成，查看藥材結算','check',()=>act('bonus-ready')));
}
function effectControls(box,s,m){
 const row=node('div');row.className='settlement-effects';
 for(const color of ['black','green','purple']){const icon=node('span');icon.append(art.token({color,value:1},{size:48,decorative:true}));icon.dataset.effectColor=color;const records=(m.effectSummary||[]).filter(e=>e.color===color);icon.classList.toggle('effect-triggered',records.some(e=>e.triggered));const entries=records.map(e=>e.text);hint(icon,{title:names[color]+'結算效果',effect:entries.join('；')||'本回合沒有額外效果。',caption:art.lookup(s,color)?.effect||'',color});row.append(icon);}
 const total=node('span');total.innerHTML=window.GameUI.symbol('star');hint(total,{title:'藥材結算合計',effect:(m.effectSummary||[]).filter(e=>!['black','green','purple'].includes(e.color)).map(e=>e.text).join('；')||'已套用本輪藥材效果。',caption:'確認不會重複領取。',color:'summary'});row.append(total);
 box.append(row);const confirm=button('確認藥材效果','check',()=>act('confirm-effects'));window.GameUI.decorateButton(confirm,'check',{iconOnly:true});box.append(confirm);
}
const actionPanel=$('#controls').closest('.action-panel'),actionHome=document.createComment('quacks-action-home');actionPanel.before(actionHome);
function restorePotActions(){if(!actionPanel.classList.contains('pot-action-dock'))return;if(actionHome.parentNode)actionHome.after(actionPanel);actionPanel.classList.remove('pot-action-dock');actionPanel.hidden=false;}
function keepPotInView(){if(document.body.dataset.roomLayout==='custom')return;requestAnimationFrame(()=>{if(state?.phase==='brewing'&&viewedPotId===state.me){const pot=$('#cauldron'),r=pot.getBoundingClientRect();if(r.top<8||r.bottom>innerHeight-80)pot.scrollIntoView({block:'start',behavior:'instant'});}});}
function arrangePotActions(s){
 if(document.body.dataset.roomLayout==='custom')return;
 if(['waiting','finished'].includes(s.phase))return;
 const dock=document.body.dataset.quacksStage==='drawing'?$('.pot-footer'):$('.cauldron-panel');if(actionPanel.parentElement!==dock)dock.append(actionPanel);
 actionPanel.classList.add('pot-action-dock');actionPanel.hidden=viewedPotId!==s.me;
}
function render(s){
 if(disposed||s.type!=='quacks'||state&&s.version<state.version)return;
 const live=sounds?.update(s);window.QuacksStitch?.baseline(s);fx.update(s,live);explosionFx.update(s,live);const freshExplosions=s.recipes.filter(p=>p.explosionId&&!seenExplosion.has(p.explosionId));for(const p of freshExplosions)seenExplosion.add(p.explosionId);if(previousState&&live&&freshExplosions.length){fx.clear();sounds?.stop();sounds?.play('explosion','quacks:burst:'+freshExplosions.map(p=>p.explosionId).join(':'));}audioFx.update(s,live);for(const e of s.rollEvents||[])if(!seenRolls.has(e.id)){seenRolls.add(e.id);if(live)sounds?.play('dice-roll','quacks:'+e.id);}
 state=s;document.body.dataset.quacksStage=s.phase==='brewing'&&s.stage==='drawing'?'drawing':s.stage||s.phase;if(['waiting','finished'].includes(s.phase))restorePotActions();if(window.RoomHost)window.RoomHost.update(s,render);else if(window.GameShell)window.GameShell.update(s);else window.RoomWaiting?.update(s);window.QuacksStitch?.socialUpdate(s,live);if(s.version===lastVersion)return;lastVersion=s.version;window.QuacksStitch?.beforeRender(s);
 $('#game').hidden=false;$('#roomTag').textContent='房號 '+code;$('#connection').textContent='';
 $('#phase').textContent='郎中闖江湖 · '+({waiting:'等待開局',patients:'選擇病患',fortune:'第 '+s.round+' 回合 · 抽占卜牌',brewing:'第 '+s.round+' 回合 · '+(s.stage==='drawing'?'第 '+s.step+' 次同步抽藥':s.stage==='reserves'?'決定暫存藥材':'效果選擇'),settlement:'第 '+s.round+' 回合 · '+({witches:'結算前女巫',essence:'特效藥階段',bonus:'獎勵骰',effects:'藥材效果選擇','effects-confirm':'確認藥材效果',rewards:'領取格位獎勵',shopping:'購物與補瓶'})[s.stage],between:'本輪結算完成',finished:s.interrupted?'有人離席，本場中止':'九回合完成'})[s.phase];
 if(s.winner)$('#phase').append(document.createTextNode(' · 獲勝：'+s.winner.names.join('、')+'（'+s.winner.score+' 分）'));
 scoreboard.update(s,live);if($('#scoreZoom').open)zoomScoreboard.update(s,false);for(const lantern of document.querySelectorAll('#scoreboard [data-round],#scoreZoomBoard [data-round]')){const n=Number(lantern.getAttribute('data-round')),event=art.roundMilestones[n];hint(lantern,{title:'第 '+n+' 回合'+(event?' · '+event.name:''),effect:event?.text||'依本回合占卜牌進行煮藥。',caption:n===s.round?'目前回合':'',color:event?.color||'round'});}renderAlchemy(s);renderFortune(s,live);renderBookVoting(s);renderTableDice(s);
 for(const p of freshExplosions)if(previousState&&live&&p.id===viewedPotId){$('#cauldron').classList.remove('burst');void $('#cauldron').offsetWidth;$('#cauldron').classList.add('burst');}
 $('#players').replaceChildren(...s.recipes.map(p=>{const card=node('article');card.className='player-card'+(p.id===s.me?' is-me':'');card.append(node('strong',p.name+(p.id===s.me?'（你）':'')),node('p',p.potName),node('p',p.score+' 分'),renderResources(s,p));if(!p.hidden){const chips=node('div');chips.className='chip-row';for(const c of p.pot.slice(-8))chips.append(chip(c));card.append(chips);}return card;}));
 window.RoomWaiting?.setRosterAction(null);botControl=null;$('#controls').replaceChildren();$('#witches').replaceChildren();const box=$('#controls'),m=s.mine,me=s.recipes.find(p=>p.id===s.me);
 if(['waiting','finished'].includes(s.phase)){
  drawPot(s);
  if(s.me===s.host){
   const start=button('開始一場','play',async()=>{await settingsAuto.flush();if(!$('#feedback').textContent)await mutate('start',{});},!bookSetupReady||s.players.length<2||s.bookSelection?.some(b=>b.tied));window.RoomControls?.primaryAction(start);box.append(start);
   botControl=button('加入測試 AI','users',()=>mutate('bot',{}),s.players.length>=(s.options.witches?5:4));if(!window.RoomWaiting?.setRosterAction(botControl))box.append(botControl);
   const field=node('fieldset'),legend=node('legend','開局設定');field.append(legend);
   const witches=node('input'),alchemists=node('input'),hidden=node('input');witches.type=alchemists.type=hidden.type='checkbox';witches.dataset.quacksSetting='witches';alchemists.dataset.quacksSetting='alchemists';hidden.dataset.quacksSetting='hiddenProgress';witches.checked=s.options.witches;alchemists.checked=s.options.alchemists;hidden.checked=s.options.hiddenProgress;
   const a=node('label'),b=node('label');a.append(witches,document.createTextNode(' 加入草藥女巫擴充'));b.append(hidden,document.createTextNode(' 隱藏他人大釜進度'));const c=node('label');c.append(alchemists,document.createTextNode(' 加入煉金術士擴充'));for(const [label,kind,description]of [[a,'gold','每人三枚女巫幣，適用時可使用一次能力。'],[c,'droplet','三選一病患與特效藥燒瓶。'],[b,'bag','其他人的進度在爆炸或結算時才公開。']]){label.classList.add('quacks-setting-choice');for(const child of [...label.childNodes])if(child.nodeType===3&&child.textContent.trim()){const caption=node('span',child.textContent.trim());caption.className='q-setting-label';child.replaceWith(caption);}label.prepend(art.resource(kind,{size:32,decorative:true}));label.append(node('small',description));}field.className='quacks-settings-grid';field.append(a,c,b);
   const settings=node('details');settings.className='room-settings-panel';settings.append(node('summary','① 房間設定'),field);const feedback=node('p');feedback.id='roomSettingsFeedback';feedback.setAttribute('role','status');const prepare=button('設定完成，選藥材書','next',async()=>{await settingsAuto.flush();if($('#feedback').textContent)return;bookSetupReady=true;lastVersion=-1;render(state);window.QuacksStitch.openBook(null,prepare);});window.RoomControls?.primaryAction(prepare,{step:bookSetupReady?null:'prepare'});settings.append(feedback,prepare);box.append(settings);
  }else box.append(node('p','等待房主開局。'));
 }else if(m){
  drawPot(s);
  if(s.interrupted)box.append(node('p','本場已中止，回大廳另開新房。'));
  else if(m.pending){if(s.phase==='settlement'&&s.stage==='effects'){
 const color=['black','green','purple'].find(c=>m.pending.title.includes(names[c]))||'purple',summary=node('span');summary.append(art.token({color,value:1},{size:48,decorative:true}));hint(summary,{title:m.pending.title,effect:'選擇本輪藥材效果。',caption:'',color});box.append(summary);
 const row=node('div');row.className='effect-choices';for(const o of m.pending.options){const b=button(o.label,'check',()=>act('choice',{choiceId:m.pending.id,optionId:o.id}),o.disabled);window.GameUI.decorateButton(b,'check',{iconOnly:true});const ingredient=Object.keys(names).find(c=>o.label.includes(names[c])),kind=o.label.includes('水滴')?'droplet':o.label.includes('紅寶石')?'ruby':null;const sr=node('span',o.label);sr.className='ui-sr-only';if(ingredient){const value=Number(o.label.slice(o.label.indexOf(names[ingredient])+names[ingredient].length).match(/^\s*(\d+)/)?.[1]||1);b.replaceChildren(art.token({color:ingredient,value},{size:40,decorative:true}),sr);}else if(kind)b.replaceChildren(art.resource(kind,{size:40,decorative:true}),sr);else window.GameUI.decorateButton(b,/略過|不|放棄/.test(o.label)?'close':/分/.test(o.label)?'star':'next',{iconOnly:true});hint(b,{title:o.label,effect:m.pending.title,caption:o.disabled?'目前無法使用':'',color:ingredient||color});row.append(b);}box.append(row);
 }else{box.append(node('h3',m.pending.title));for(const o of m.pending.options)box.append(button(o.label,'check',()=>act('choice',{choiceId:m.pending.id,optionId:o.id}),o.disabled));}}
  else if(m.waitingEffect)box.append(node('p','等待其他人完成藥材／占卜卡效果。'));
  else if(s.phase==='patients')box.append(node('p',m.alchemy?.patientId?'已選病患，等待其他人。':'在特效藥面板選一位病患，同場可以選相同病患。'));
  else if(s.phase==='fortune')box.append(s.me===s.roundStarterId?button('抽一張占卜牌','cards',()=>act('draw-fortune')):node('p','等 '+s.players.find(p=>p.id===s.roundStarterId)?.name+' 抽占卜牌。'));
  else if(s.phase==='brewing'){
   if(s.stage==='drawing'){
    if(m.canDraw){const draw=button('還要爽爽：繼續抽藥','draw-bag',async()=>{await act('draw',{step:s.step});keepPotInView();}),stop=button('我不抽了QQ','close',()=>act('stop',{step:s.step}));draw.classList.add('draw-action');stop.classList.add('stop-action');for(const [b,icon,text]of [[draw,'draw-bag','還要爽爽：繼續抽藥'],[stop,'hand','我不抽了QQ']]){window.GameUI.decorateButton(b,icon,{iconOnly:true});b.classList.remove('ui-icon-button');b.classList.add('quacks-dock-button');const caption=node('span',icon==='draw-bag'?'還要爽爽':'我不抽了QQ');caption.className='q-action-caption';const portrait=node('img');portrait.src=icon==='draw-bag'?'/assets/quacks/draw-portrait-v1.png':'/assets/quacks/stop-portrait-v1.png';portrait.alt='';portrait.width=240;portrait.height=160;portrait.className='quacks-action-portrait';b.classList.add('portrait-action');b.replaceChildren(portrait,caption);hint(b,{title:text,effect:'對自己的大釜作出本次選擇；全員選好後同步抽藥。',caption:'',color:icon});}box.append(draw,stop);}
    else box.append(node('p',me.stopped?'你已停止；等其他人完成。':'已選擇，等所有繼續抽藥者。'));
    if(m.canDraw)for(const c of m.alchemy?.drawablePool||[])box.append(button('改放預抽 '+names[c.color]+' '+c.value,'play',()=>act('draw',{step:s.step,chipId:c.id})));
    if(m.canPotion){const potion=button('使用藥水瓶：收回最後白色炸彈','help',()=>act('potion'));potion.classList.remove('ui-icon-button');potion.classList.add('quacks-dock-button','potion-action');const label=node('span','使用藥水瓶：收回最後白色炸彈');label.className='ui-sr-only';potion.replaceChildren(art.resource('potion',{size:42,decorative:true}),label);hint(potion,{title:'使用藥水瓶',effect:'把最後一片尚未造成爆炸的白色炸彈放回自己的藥袋；藥水瓶用完會變空，購物時可用紅寶石補滿。',caption:'',color:'potion'});box.append(potion);}
   }
   for(const c of m.reserve){box.append(button('投入暫存 '+names[c.color]+' '+c.value,'play',()=>act('reserve',{chipId:c.id}),me.chosen||(s.options.books?.red??s.options.bookSet)===2&&!me.stopped));if(!c.must)box.append(button('暫存 '+names[c.color]+' '+c.value+' 放回藥袋','close',()=>act('reserve-return',{chipId:c.id}),me.chosen));}
   for(const c of m.alchemy?.pool||[])if(s.stage==='reserves'&&c.color==='red'&&(s.options.books?.red??s.options.bookSet)===2)box.append(button('投入預抽 '+names.red+' '+c.value,'play',()=>act('alchemy-pool',{chipId:c.id})));
   if(m.alchemy?.returnable?.length){const returns=node('div');returns.className='alchemy-return-choices';for(const c of m.alchemy.returnable){const label='收回 '+names[c.color]+' '+c.value+'（花'+c.value+'格特效藥）',b=button(label,'undo',()=>act('alchemy-return',{chipId:c.id}));window.GameUI.decorateButton(b,'undo',{iconOnly:true});b.classList.add('alchemy-return');b.dataset.returnChip=c.id;const sr=node('span',label);sr.className='ui-sr-only';const cost=node('span');cost.className='essence-cost';cost.append(art.resource('essence',{size:26,decorative:true}),node('strong',String(c.value)));b.replaceChildren(art.token(c,{size:40,decorative:true}),node('span'),cost,sr);b.children[1].innerHTML=window.GameUI.symbol('undo');hint(b,{title:'收回 '+names[c.color]+' '+c.value,effect:'消耗 '+c.value+' 格特效藥，將這片藥材放回藥袋；其他藥材格位不變。',caption:'',color:c.color});b.setAttribute('aria-label',label);returns.append(b);}box.append(returns);}

   if(s.stage==='reserves')box.append(button('暫存決定完成，其餘保留','check',()=>act('reserve-done'),m.reserve.some(c=>c.must)));
  }else if(s.phase==='settlement'){
   if(s.stage==='essence'){if(m.alchemy?.diceRemaining)box.append(button('擲特效藥骰（剩'+m.alchemy.diceRemaining+'次）','dice',()=>act('essence-roll')));else box.append(node('p',m.alchemy?.confirmed?'特效藥已確認，等待其他人與額外效果。':'到特效藥面板確認格位，可選已達到的較低格。'));}
   else if(m.ready)box.append(node('p','你已完成，等待其他人。'));
   else if(s.stage==='witches'){box.append(node('p','所有大釜已公開；可先使用適用女巫，然後開始結算。'),button('準備結算','check',()=>act('settle-ready')));}
   else if(s.stage==='bonus')bonusControls(box,s,m);
   else if(s.stage==='effects-confirm')effectControls(box,s,m);
   else if(s.stage==='rewards'){
    box.append(node('p',me.exploded?'爆炸後請選得分或購物；保護效果適用者仍可兩者兼得。':'可同時得分與購物。'));
    box.append(button(me.exploded?'我要勝利分數':'領取本輪獎勵','star',()=>act('reward',{mode:'score'})));
    if(me.exploded)box.append(button('我要買藥材','ingredient',()=>act('reward',{mode:'buy'})));
   }else if(s.stage==='shopping'){
    box.append(node('p','購物預算 '+m.budget+' 金幣 · 本輪買入 '+m.bought.length+'／2 片'));
    if(s.round===9)box.append(node('p','第九輪不再買藥材；完成結算時，剩餘可用預算每 5 金幣轉 1 分。'));
    else{
     const grid=node('div');grid.className='purchase-grid';grid.dataset.uiLayout='ingredient-market';
     for(const b of s.books)for(const o of b.offers)grid.append(purchaseOffer(s,b,o,'buy',!m.canBuy||m.budget<o.price||m.bought.length>=2||m.bought.some(c=>c.color===b.color)));
     box.append(grid);
     if(m.extraBudget>0||m.extraBought.length){box.append(node('h3','幽靈氣息獨立預算：'+m.extraBudget));const extraGrid=node('div');extraGrid.className='purchase-grid';for(const b of s.books)for(const o of b.offers)extraGrid.append(purchaseOffer(s,b,o,'extra-buy',o.price>m.extraBudget||m.extraBought.length>=2||m.extraBought.some(c=>c.color===b.color)));box.append(extraGrid);}
     const utilities=node('div');utilities.className='shop-utilities';for(const [mode,kind,label,blocked]of [['refill','potion','補滿藥水瓶',m.potion||me.rubies<m.discount],['droplet','droplet','水滴前進 1 格',me.rubies<m.discount]]){const b=button(label,'help',()=>act('ruby',{mode}),blocked);b.classList.add('quacks-resource-action');const sr=node('span',label);sr.className='ui-sr-only';b.replaceChildren(art.resource(kind,{size:38,decorative:true}),sr);hint(b,{title:label,effect:'支付 '+m.discount+' 顆紅寶石。',caption:kind==='potion'?'重新補滿已喝完的藥水瓶。':'永久水滴起點前進一格。',color:kind});utilities.append(b);}box.append(utilities);
    }
    box.append(button('完成本輪結算','check',()=>act('shop-ready')));
   }
  }else if(s.phase==='between')box.append(s.me===s.host?button('下一回合','next',()=>act('next')):node('p','等房主開始下一回合。'));
  if(m.canGoodNeighbor)box.append(button('好鄰居：白色炸彈3進袋，其他人各拿2紅寶石','ingredient',()=>act('fortune-neighbor')));
  if(s.visitingWitch){const visit=node('div');visit.className='witch-row';visit.append(node('strong','免費來訪女巫 · '+s.visitingWitch.name),node('p',s.visitingWitch.text),button('免費使用來訪女巫','help',()=>act('free-witch'),!m.canVisit));$('#witches').append(visit);}
  for(const [color,w]of Object.entries(s.witches)){
 const slot=node('div');slot.className='witch-slot';slot.dataset.witchColor=color;
 const use=button('使用'+w.name,'help',()=>act('witch',{color}),!m.witchAvailable[color]);window.GameUI.decorateButton(use,'help',{iconOnly:true});
 use.classList.remove('ui-icon-button');use.classList.add('quacks-dock-button','witch-action');if(!m.coins[color])use.classList.add('used');
 const caption=node('span','使用'+w.name);caption.className='ui-sr-only';use.replaceChildren(art.resource(color,{size:44,decorative:true}),caption);
 hint(slot,{title:w.name+(m.coins[color]?'':' · 已使用'),effect:w.text,caption:m.witchAvailable[color]?'可以使用':'目前不可使用',color});slot.append(use);$('#witches').append(slot);
 }
 }
 renderBooks(s);
 $('#results').replaceChildren(...s.results.map(r=>{const a=node('article');a.append(node('h3','第 '+r.round+' 回合 · '+r.fortune.name));for(const p of r.players)a.append(node('p',p.name+' · '+(p.exploded?'爆炸':'安全')+' · 普通抽藥 '+p.draws+' 片 · 累計 '+p.score+' 分'));return a;}));
 window.QuacksStitch.update(s,live);

 arrangePotActions(s);if(s.phase==='brewing'&&s.stage==='drawing'&&(previousState?.phase!=='brewing'||previousState?.stage!=='drawing'))keepPotInView();previousState=s;lock();
}
async function refresh(){if(disposed||reading)return;reading=true;try{render(await api('state'));}catch(e){if(!disposed&&e.name!=='AbortError'){sounds?.disconnect();fx.clear();explosionFx.clear();audioFx.clear();$('#connection').textContent='連線中斷：'+e.message;}}finally{reading=false;}}
async function start(){disposed=false;scope=new AbortController();try{await RoomReconnect.restore(code,'quacks','#connection',{signal:scope.signal});if(disposed)return;await refresh();timer=setInterval(()=>{if(!document.hidden)refresh();},1200);}catch(e){if(e.name!=='AbortError')$('#feedback').textContent=e.message;}}
const scorePanel=$('.score-panel');scorePanel.tabIndex=0;scorePanel.setAttribute('role','button');scorePanel.setAttribute('aria-label','放大記分板');function openScore(){if(!state||$('#scoreZoom').open)return;hideTooltip();zoomScoreboard.update(state,false);$('#scoreZoom').showModal();}scorePanel.addEventListener('click',e=>{e.stopPropagation();openScore();},true);scorePanel.addEventListener('keydown',e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();openScore();}});$('#closeScoreZoom').onclick=()=>$('#scoreZoom').close();$('#scoreZoom').addEventListener('close',()=>scorePanel.focus({preventScroll:true}));window.GameUI.decorateButton($('#closeScoreZoom'),'close',{iconOnly:true});
$('#retry').onclick=()=>retry&&mutate(retry.route,retry.data);
$('#leave').onclick=async()=>{if(busy||!confirm('離席會中止本場，確定離開？'))return;await mutate('leave',{});if(!retry&&!$('#feedback').textContent){RoomReconnect.forget(code);location.replace('/?game=quacks');}};
document.addEventListener('keydown',event=>{if(event.key==='Escape')hideTooltip();});document.addEventListener('pointerdown',event=>{if(tooltipOwner&&!tooltipOwner.contains(event.target))hideTooltip();},true);window.addEventListener('resize',hideTooltip);document.addEventListener('visibilitychange',()=>{if(document.hidden)hideTooltip();});window.addEventListener('scroll',()=>{const anchor=tooltipOwner;hideTooltip();if(anchor)requestAnimationFrame(()=>{if((!tooltipOwner||tooltipOwner===anchor)&&anchor.isConnected&&(anchor.matches(':hover')||anchor===document.activeElement))inspectPot(anchor.quacksDisplayedInsight,null,anchor);});},true);

$('#bagButton').onclick=()=>{bagViewerId=viewedPotId;renderBag(state);$('#bagDialog').showModal();};
$('#peekBag').onclick=()=>act('peek-bag');$('#closeBag').onclick=closeBag;$('#bagDialog').addEventListener('cancel',event=>{event.preventDefault();closeBag();});
$('#customizePot').onclick=()=>{const p=state.recipes.find(p=>p.id===state.me);$('#potNameInput').value=p.potName;renderPotCustomization(state);$('#potCustomize').showModal();};
$('#closeCustomize').onclick=()=>$('#potCustomize').close();
$('#potNameForm').onsubmit=event=>{event.preventDefault();act('name-pot',{name:$('#potNameInput').value});};


for(const [id,icon]of [['customizePot','settings'],['savePotName','save'],['closeCustomize','close'],['closeBag','close']])window.GameUI?.decorateButton($('#'+id),icon,{iconOnly:!['savePotName','closeCustomize'].includes(id)});
if(!code){$('#guide').open=true;$('#connection').textContent='從大廳建立房間開始。';return;}
window.addEventListener('pagehide',()=>{disposed=true;clearInterval(timer);scope?.abort();sounds?.reset();fx.clear();explosionFx.clear();audioFx.clear();});window.addEventListener('pageshow',e=>{if(e.persisted){lastVersion=-1;start();}});start();
})();
