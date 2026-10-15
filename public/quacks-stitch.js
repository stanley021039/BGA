/* The Stitch frames are a visual reference; this adapter never invents game state. */
(()=>{
 'use strict';
 const $=s=>document.querySelector(s),art=window.QuacksArt,ui=window.GameUI;
 const el=(t,c='',value)=>{const n=document.createElement(t);n.className=c;if(value!==undefined)n.textContent=value;return n;};
 const cue=window.GameSounds.create();let state=null,previous=null,bookColor=null,viewed=null,mediaReady=false,stageKey='',stageScroll=0,stageFocus=null;
 const flying=new Set(),reactions=new Map(),alchemyHome=document.createComment('quacks-alchemy-home');$('#alchemy').before(alchemyHome);
 function icon(id,name,label){const b=$(id);if(b)ui.decorateButton(b,name,{iconOnly:true,label});}
 const dialogTriggers=new WeakMap();
 const rosterTools=$('.q-roster-tools');$('#qMobileMenuContent').append(...rosterTools.children);rosterTools.remove();$('.quacks-achievement-link').classList.add('ui-button');
 const nativeControls=$('#controls'),controlsHome=document.createComment('quacks-controls-home');nativeControls.before(controlsHome);
 const extraTool=el('button','','額外煮藥選擇');extraTool.type='button';extraTool.hidden=true;extraTool.onclick=()=>open($('#qExtraDialog'),extraTool);$('#qMobileMenuContent').append(extraTool);const extraBadge=el('span','q-extra-badge');extraBadge.hidden=true;extraBadge.setAttribute('aria-hidden','true');$('#qMobileMenu>summary').append(extraBadge);
 function returnFocus(trigger){if(trigger?.dataset.roomNativeAction==='start')trigger=$('.ui-room-session-actions>[data-room-action=start]')||trigger;if(trigger?.closest('#qMobileMenu')&&!$('#qMobileMenu').open)trigger=$('#qMobileMenu>summary');trigger?.focus();}
 function open(dialog,trigger){if(!dialog)return;dialogTriggers.set(dialog,trigger||document.activeElement);if(!dialog.open)dialog.showModal();dialog.querySelector('[data-q-close],button,input,select')?.focus();}
 function close(dialog){dialog.close();returnFocus(dialogTriggers.get(dialog));}
 for(const b of document.querySelectorAll('[data-q-close]')){ui.decorateButton(b,'close',{iconOnly:true,label:'關閉視窗'});b.onclick=()=>close(b.closest('dialog'));}
 for(const d of document.querySelectorAll('.quacks-dialog'))d.addEventListener('close',()=>{dismissTooltip();returnFocus(dialogTriggers.get(d));});
 icon('#qBook','book','藥材寶典');icon('#qRecords','queue','回合結算紀錄');icon('#qScore','crown','環形記分板');icon('#qGuide','help','玩法與版本範圍');icon('#leave','leave','離開房間');icon('#customizePot','edit','大釜命名與換色');
 icon('#managePlayers','settings','房間管理');if($('#managePlayers'))$('#qMobileMenuContent').append($('#managePlayers'));
 $('#qBook').onclick=()=>openBook(null,$('#qBook'));$('#qRecords').onclick=()=>open($('#recordsDialog'),$('#qRecords'));$('#qScore').onclick=()=>open($('#scoreDialog'),$('#qScore'));$('#qGuide').onclick=()=>open($('#guideDialog'),$('#qGuide'));$('#qFortune').onclick=()=>open($('#fortuneDialog'),$('#qFortune'));
 const supplies=el('div','q-pot-supplies');supplies.setAttribute('aria-label','藥水瓶與藥袋');supplies.append($('#qPotionSlot'),$('#bagButton'));$('#qPotStage').append(supplies);
 const phaseSteps=['配書','占卜','抽藥','結算','購物','下回合'],phaseRail=el('nav','q-phase-rail');phaseRail.setAttribute('aria-label','本局遊戲階段');for(const label of phaseSteps){const step=el('span','q-phase-step',label);phaseRail.append(step);}$('.q-header').after(phaseRail);
 function placeInviteInbox(){const badge=$('#room-invitations-button'),heading=$('.ui-room-roster-heading');if(badge&&heading&&badge.parentElement!==heading)heading.append(badge);}
 window.addEventListener('room-invitations-ready',()=>{if(state)window.RoomInvites?.updateRoom(state);placeInviteInbox();});
 const alchemyTool=el('button','','煉金術士與特效藥');alchemyTool.type='button';ui.decorateButton(alchemyTool,'ingredient',{label:'煉金術士與特效藥'});alchemyTool.onclick=()=>open($('#alchemyDialog'),alchemyTool);$('#qMobileMenuContent').append(alchemyTool);
 $('#qBrandIcon').innerHTML='<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M11 4h10M13 4v9L6 24q-1 4 3 4h14q4 0 3-4l-7-11V4" fill="none" stroke="#765b16" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 20h12l3 5H7Z" fill="#765b16" opacity=".5"/><circle cx="16" cy="18" r="1.5" fill="#765b16"/></svg>';
 const mobile=matchMedia('(max-width:1140px)'),mobileTools=['#qRecords','#qGuide','#soundToggle','#qMotion'],toolHomes=new Map();
 ui.decorateButton($('#qScore'),'crown',{label:'環形記分板'});
 for(const id of mobileTools){const n=$(id),mark=document.createComment('quacks-tool-home');n.before(mark);toolHomes.set(n,mark);}
 const account=$('.site-account'),accountHome=document.createComment('quacks-account-home');account.before(accountHome);toolHomes.set(account,accountHome);
 function arrangeTools(){for(const [n,home]of toolHomes){if(mobile.matches)$('#qMobileMenuContent').append(n);else home.after(n);}if(!mobile.matches)$('#qMobileMenu').open=false;}
 mobile.addEventListener('change',arrangeTools);arrangeTools();
 document.addEventListener('click',event=>{if(!$('#qMobileMenu').contains(event.target))$('#qMobileMenu').open=false;});
 $('.q-header').addEventListener('focusout',event=>{if(event.relatedTarget&&!$('.q-header').contains(event.relatedTarget))$('#qMobileMenu').open=false;});
 const witchDetails=el('button','', '草藥女巫說明');witchDetails.type='button';ui.decorateButton(witchDetails,'help',{label:'草藥女巫說明'});$('#qMobileMenuContent').append(witchDetails);
 const focus=el('button','', '專注全螢幕');focus.type='button';ui.decorateButton(focus,'expand',{label:'專注全螢幕'});focus.onclick=()=>$('#gameFocusToggle')?.click();$('#qMobileMenuContent').append(focus);
 witchDetails.onclick=()=>{
  if(!state)return;const content=el('div'),dialog=ui.createDialog({title:'本局草藥女巫',className:'quacks-dialog',content:[content]}),done=el('button','','關閉');done.type='button';done.onclick=()=>{dialog.close();dialog.remove();};content.append(done);
  if(!Object.keys(state.witches).length)content.append(el('p','','本局使用基本版，沒有加入草藥女巫。'));
  for(const [color,w]of Object.entries(state.witches)){const card=el('article','q-witch-detail');card.append(art.resource(color,{size:42}),el('h3','',w.name),el('p','',w.text));const native=$('#witches [data-witch-color="'+color+'"]>button'),use=el('button','','使用'+w.name);use.type='button';use.disabled=!native||native.disabled;use.onclick=()=>{dialog.close();dialog.remove();native.onclick();};ui.decorateButton(use,'check',{label:'使用'+w.name});card.append(use);content.append(card);}
  document.body.append(dialog);open(dialog,witchDetails);
 };
 function dismissTooltip(anchor){if(anchor?.nodeType===1&&anchor.getAttribute('aria-describedby')!=='potTooltip')return;const tip=$('#potTooltip');if(tip.matches(':popover-open'))tip.hidePopover();tip.hidden=true;for(const n of document.querySelectorAll('[aria-describedby=potTooltip]'))n.removeAttribute('aria-describedby');}
 function inspect(details,anchor){
  dismissTooltip();anchor.setAttribute('aria-describedby','potTooltip');const tip=$('#potTooltip');tip.replaceChildren(el('strong','',details.title),el('p','',details.effect),el('small','',details.caption||''));tip.hidden=false;tip.dataset.ingredient=details.color||'empty';tip.showPopover?.();
  const r=anchor.getBoundingClientRect(),t=tip.getBoundingClientRect();tip.style.left=Math.max(8,Math.min(innerWidth-t.width-8,r.left+r.width/2-t.width/2))+'px';tip.style.top=Math.max(8,Math.min(innerHeight-t.height-8,r.bottom+8))+'px';
 }
 function hint(n,details){n.addEventListener('pointerenter',()=>inspect(details,n));n.addEventListener('focus',()=>inspect(details,n));n.addEventListener('pointerleave',e=>{if(e.pointerType!=='touch')dismissTooltip(n);});n.addEventListener('focusout',e=>{if(!n.contains(e.relatedTarget))dismissTooltip(n);});}
 document.addEventListener('pointerdown',e=>{if(!e.target.closest('[aria-describedby=potTooltip],#potTooltip'))dismissTooltip();});
 function arrangeNativeControls(s){if(s.phase==='waiting'){if(nativeControls.parentElement!==$('#qWaitingControls'))$('#qWaitingControls').append(nativeControls);}else if(nativeControls.parentElement!==controlsHome.parentElement)controlsHome.after(nativeControls);}
 function waitingRoom(s){
  arrangeNativeControls(s);$('#qWaitingControls').hidden=s.phase!=='waiting';if(s.phase!=='waiting')return;
  const center=$('.tpl-waiting-center');if(!center)return;placeInviteInbox();
  $('.ui-room-roster-add:has([data-room-common-action="invite"])')?.style.setProperty('display','block','important');
  $('.ui-room-session-actions>.st-waiting-invite')?.style.setProperty('display','none','important');
  ui.Template.patterns.waitingScene(center,s,{owner:s.me===s.host,hostId:s.host,capacity:s.options.witches?5:4,title:'郎中闖江湖',english:'Quacks',limit:'2–'+(s.options.witches?5:4)+' 人一起煮藥',art:'/assets/playful/game-quacks.svg',fallbackArt:'/assets/playful/game-quacks.svg',kicker:'朋友集結中，藥袋已備，等房主開釜。',description:'九回合同步抽藥，逐色共選本局藥材效果。可加入草藥女巫與煉金術士，煮出你的傳奇。',readyCopy:'藥袋與大釜已備妥',readiness:s.bookSelection?.some(r=>r.tied)?'藥材書仍有平票，請房主開啟寶典裁決。':null,facts:[['同步煮藥','全員一起抽'],['對局回合','9 回合累計'],['本局藥材','逐色共選效果']],onCopy:()=>navigator.clipboard.writeText(location.origin+'/quacks/'+s.code),onChat:()=>center.querySelector('.tpl-waiting-footer button')?.click(),onHelp:()=>$('#qGuide').click(),onLeave:()=>$('.ui-room-session-actions>[data-room-action=leave]')?.click(),onInvite:()=>window.RoomInvites?.open(center)});
  const source=$('#qWaitingControls .room-settings-panel')||$('.ui-room-settings-slot');if(source&&!source.querySelector('.q-waiting-books')){const books=el('button','q-waiting-books','搭配本局藥材書');books.type='button';ui.decorateButton(books,'book',{label:'搭配本局藥材書'});books.onclick=()=>openBook(null,books);source.append(books);}
 }
 function renderBookTabs(){
  if(!state)return;
  const rows=['waiting','finished'].includes(state.phase)?state.bookSelection||[]:state.books||[];
  if(!rows.some(r=>r.color===bookColor))bookColor=rows[0]?.color;
  const tabs=$('#qBookTabs'),scroll=tabs.scrollLeft;
  tabs.replaceChildren(...rows.map(row=>{const b=el('button','',row.name);b.type='button';b.setAttribute('role','tab');b.setAttribute('aria-selected',String(row.color===bookColor));b.setAttribute('aria-controls','qBookContent');b.id='qBookTab-'+row.color;b.tabIndex=row.color===bookColor?0:-1;b.prepend(art.token({color:row.color,value:1},{size:26,decorative:true}));b.onclick=()=>{bookColor=row.color;renderBookTabs();$('#'+b.id)?.focus();};b.onkeydown=e=>{if(!['ArrowRight','ArrowLeft','Home','End'].includes(e.key))return;e.preventDefault();const i=rows.findIndex(r=>r.color===row.color),next=e.key==='Home'?0:e.key==='End'?rows.length-1:(i+(e.key==='ArrowRight'?1:rows.length-1))%rows.length;bookColor=rows[next].color;renderBookTabs();$('#qBookTab-'+bookColor)?.focus();};return b;}));tabs.scrollLeft=scroll;
  $('#books').hidden=['waiting','finished'].includes(state.phase)&&!!state.bookSelection;
  for(const card of document.querySelectorAll('#books>.book-card,#bookVoting .book-card'))card.hidden=card.dataset.ingredient!==bookColor;
  $('#qBookContent').setAttribute('aria-labelledby','qBookTab-'+bookColor);
 }
 function openBook(color,trigger){if(color)bookColor=color;renderBookTabs();open($('#bookDialog'),trigger);}
 function socialUpdate(s,live){
  for(const player of s.players){const image=$('#players [data-player-id="'+player.id+'"] .q-avatar img');if(image&&player.avatar&&image.getAttribute('src')!==player.avatar)image.src=player.avatar;}
  const now=s.serverNow||Date.now(),fresh=[...(s.expressions||[]),...(s.social||[]).filter(e=>e.kind==='expression'||e.kind==='emoji')].filter(e=>now-e.at<5000);
  for(const item of fresh){const card=$('#players [data-player-id="'+item.playerId+'"]');if(reactions.get(item.playerId)===item.id)continue;reactions.set(item.playerId,item.id);if(!live||!card)continue;const bubble=el('span','q-avatar-reaction',item.emoji||item.label||'表情');bubble.setAttribute('aria-label',item.name+'：'+bubble.textContent);card.querySelector('.q-avatar')?.append(bubble);window.MotionPolicy.animate(bubble,[{transform:'scale(.6) translateY(5px)',opacity:0},{transform:'scale(1.15) translateY(-4px)',opacity:1},{transform:'scale(1)',opacity:1}],{duration:350,easing:'ease-out'});setTimeout(()=>bubble.remove(),4000);}
 }
 function paintRoster(s){
  $('#qRosterCount').textContent=s.players.length+'/'+(s.options.witches?5:4)+' 人 · R'+(s.round||0)+'/9';
  for(const [i,card]of [...$('#players').children].entries()){
   const p=s.recipes[i],player=s.players.find(x=>x.id===p.id)||p;card.dataset.playerId=p.id;
   const strong=card.querySelector(':scope>strong'),paras=[...card.querySelectorAll(':scope>p')],resources=card.querySelector('.resource-row'),chips=card.querySelector('.chip-row');
   const avatar=el('div','q-avatar'),image=el('img'),fallback=player.bot?'/assets/characters/sunny-neutral.png':'/assets/characters/traveler-neutral.png';image.src=player.avatar||fallback;image.alt='';image.onerror=()=>{if(image.getAttribute('src')!==fallback)image.src=fallback;};avatar.append(image);
   strong.className='q-player-title';const potName=el('small','',p.potName);strong.append(potName);
   const score=el('div','q-player-score');score.append(document.createTextNode(String(p.score)),el('small','','分'));
   const waiting=['waiting','finished'].includes(s.phase),status=waiting?'已入座':p.exploded?'已爆炸':p.stopped?'已停止':p.chosen?'已選擇':'準備抽藥';
   const risk=el('div','q-player-risk');risk.dataset.danger=String(!p.hidden&&(p.white||0)>=p.threshold-1);risk.dataset.exploded=String(!!p.exploded);risk.style.setProperty('--risk',Math.min(100,(p.white||0)/p.threshold*100)+'%');risk.append(el('span','',p.hidden?'大釜進度隱藏中':'白彈 '+(p.white||0)+' / '+p.threshold),el('span','',status+(p.hidden||waiting?'':' · '+(p.position||0)+'格')));
   const metric=el('div','resource-pill');metric.append(art.resource('droplet',{size:17,decorative:true}),el('span','',(p.droplet||0)+'格'));metric.setAttribute('aria-label','永久液滴第 '+(p.droplet||0)+' 格');resources.append(metric);
   const coins=resources.querySelector('.witch-coins'),tray=el('div','q-player-tray');if(chips)tray.append(chips);if(coins)tray.append(coins);
   card.replaceChildren(avatar,strong,score,resources,risk,tray);card.tabIndex=0;
   hint(card,{title:p.name+' · '+(p.potName||'大釜'),effect:'累計 '+p.score+' 分 · 藥袋 '+p.bagCount+' 片 · 紅寶石 '+p.rubies+' 顆 · 鼠尾巴 '+(p.rat||0)+' 條。'+(p.hidden?'大釜會在爆炸或結算時公開。':'目前在第 '+p.position+' 格；白色炸彈 '+p.white+' / '+p.threshold+'。'),caption:s.options.witches?'金、銅、銀女巫幣可各使用一次。':'九回合累計分數。'});
  }
 }
 function potChrome(s){
  const selected=[...$('#potTabs').children].find(b=>b.getAttribute('aria-pressed')==='true'),index=[...$('#potTabs').children].indexOf(selected),p=s.recipes[index]||s.recipes.find(p=>p.id===s.me);viewed=p.id;
  const markers=art.markerPositions(p),metrics=$('#qPotMetrics');metrics.replaceChildren();
  for(const [kind,value,label]of [['droplet',markers.droplet,'液滴'],['rat',markers.start,'起點'],['progress',p.position||0,'當前']]){const span=el('span',kind==='progress'?'q-metric-progress':'');span.append(art.resource(kind,{size:14,decorative:true}),document.createTextNode(label+' '+value));metrics.append(span);}
  const recent=$('#qRecent');recent.replaceChildren(el('span','','本輪投入：'));
  for(const c of p.pot?.slice(-8)||[]){const b=el('button');b.type='button';b.setAttribute('aria-label',art.names[c.color]+' '+c.value+' · 查看效果');b.append(art.token(c,{size:26,decorative:true}));const tile=s.board[c.position],details=art.info(s,p,tile,c);hint(b,details);b.onclick=()=>inspect(details,b);recent.append(b);}
  if(!p.pot?.length)recent.append(el('span','q-empty','還沒投入藥材'));
  $('#potTabs').setAttribute('aria-label','切換大釜，目前查看 '+p.name);
  $('#qPotStage').classList.toggle('q-danger',!p.exploded&&p.white>=p.threshold-1);$('#qPotStage').classList.toggle('q-exploded',!!p.exploded);
 }
 function groupMarket(s){
  for(const grid of $('#qStageContent').querySelectorAll('.purchase-grid')){
   const offers=[...grid.children];grid.replaceChildren();
   for(const b of s.books){const nodes=offers.filter(n=>n.querySelector('button')?.dataset.purchaseColor===b.color);if(!nodes.length)continue;
    const card=el('section','q-market-color'),head=el('header'),info=el('button','q-market-effect');card.dataset.ingredient=b.color;card.setAttribute('aria-label',b.name+'採購');info.type='button';ui.decorateButton(info,'book',{iconOnly:true,label:'查閱'+b.name+'藥材書'});info.onclick=()=>openBook(b.color,info);head.append(art.token({color:b.color,value:1},{size:34,decorative:true}),info);hint(head,{title:b.name,effect:b.effect,caption:b.faceName||'本局採用第 '+b.set+' 面',color:b.color});const row=el('div','q-market-offers');
    for(const n of nodes){const buy=n.querySelector('button'),value=Number(buy.dataset.purchaseValue),offer=b.offers.find(o=>o.value===value),price=el('span','q-offer-price'),status=el('span','q-purchase-state');price.innerHTML=ui.symbol('coins');price.append(el('strong','',String(offer.price)));status.setAttribute('aria-hidden','true');if(buy.dataset.selected==='true')status.innerHTML=ui.symbol('check');buy.replaceChildren(art.token({color:b.color,value},{size:52,decorative:true}),price,status);row.append(n);}
    card.append(head,row);grid.append(card);
   }
  }
 }
 function actions(s){
  if(s.phase==='waiting'){$('#qStageOverlay').hidden=true;return;}
  const me=s.recipes.find(p=>p.id===s.me),m=s.mine,waiting=['waiting','finished'].includes(s.phase);
  $('#qRiskCaption').replaceChildren(document.createTextNode('白色炸彈 '),el('strong','',(me.white||0)+' / '+me.threshold),el('small','','（超過 '+me.threshold+' 爆炸）'));
  const potion=[...$('#controls').children].find(n=>n.tagName==='BUTTON'&&(n.getAttribute('aria-label')||n.textContent).startsWith('使用藥水瓶'));
  if(potion){potion.setAttribute('aria-label','使用藥水瓶：收回最後白色炸彈');if(potion.querySelector('.ui-button-label'))potion.querySelector('.ui-button-label').textContent='收回白彈';$('#qPotionSlot').append(potion);}
  else{const bottle=el('div','q-potion-display');bottle.setAttribute('aria-label',m?.potion?'藥水瓶已裝滿，目前不能使用':'藥水瓶是空瓶');bottle.append(art.resource('potion',{size:42,decorative:true}),el('span','',m?.potion?'滿瓶':'空瓶'));$('#qPotionSlot').append(bottle);}
  for(const row of [...$('#witches').children]){
   const color=row.dataset.witchColor,w=s.witches[color],button=row.querySelector('button');if(!w||!button)continue;
   if(!button.querySelector('.quacks-resource'))button.prepend(art.resource(color,{size:23,decorative:true}));button.querySelector('.ui-icon')?.remove();if(button.querySelector('.ui-button-label'))button.querySelector('.ui-button-label').textContent=({gold:'金',copper:'銅',silver:'銀'})[color];button.setAttribute('aria-label','使用'+w.name);button.title=w.name;button.classList.toggle('used',!m?.coins[color]);row.tabIndex=0;row.setAttribute('aria-label',w.name+'：'+w.text+(m?.coins[color]?' · 女巫幣可用':' · 已使用'));
   hint(row,{title:w.name,effect:w.text,caption:button.disabled?'目前不能使用這位女巫。':'點選女巫幣使用。',color});
   const inspectButton=el('button','q-witch-info');inspectButton.type='button';inspectButton.setAttribute('aria-label','查看'+w.name+'效果');inspectButton.onclick=()=>inspect({title:w.name,effect:w.text},row);row.append(inspectButton);
  }
  const complex=waiting||s.phase!=='brewing'||s.stage!=='drawing'||!!m?.pending||!!m?.waitingEffect||!!m?.reserve.length;
  const overlay=$('#qStageOverlay');overlay.hidden=!complex;
  if(!complex){const extras=[...$('#controls').children].filter(n=>n.matches('button,.alchemy-return-choices')&&!n.matches('.draw-action,.stop-action'));for(const n of extras)$('#qExtraContent').append(n);if(extraTool.hidden===!!extras.length)extraTool.hidden=!extras.length;if(extraBadge.hidden===!!extras.length)extraBadge.hidden=!extras.length;extraBadge.textContent=String(extras.length);if(extras.length)ui.decorateButton(extraTool,'ingredient',{label:'額外煮藥選擇（'+extras.length+'）'});else if($('#qExtraDialog').open)$('#qExtraDialog').close();return;}
  if(!extraTool.hidden)extraTool.hidden=true;if(!extraBadge.hidden)extraBadge.hidden=true;if($('#qExtraDialog').open)$('#qExtraDialog').close();
  const content=$('#qStageContent'),heading=$('#qStageTitle');heading.textContent=waiting?(s.phase==='finished'?'本場結果':'藥袋已備，等你開釜。'):({patients:'選擇治療病患',fortune:'本輪占卜',between:'本輪結算完成',settlement:({witches:'結算前女巫',essence:'特效藥階段',bonus:'獎勵骰',effects:'藥材效果', 'effects-confirm':'藥材結算',rewards:'領取本輪獎勵',shopping:'藥材市集'})[s.stage],brewing:m?.pending?.title||'暫存藥材'})[s.phase]||'你的操作';
  $('#qStageStep').textContent=s.round?'第 '+s.round+' / 9 回合':(s.options.witches?'草藥女巫 · 最多 5 人':'基本版 · 最多 4 人');
  if(waiting){
   const hero=el('div','q-waiting-hero'),img=el('img');img.src='/assets/playful/game-quacks.svg';img.alt='郎中與藥釜插畫';hero.append(img,el('h3','',s.phase==='finished'?(s.winner?'獲勝：'+s.winner.names.join('、'):'本場已結束'):'朋友集結，煮出你的傳奇。'),el('p','',s.phase==='finished'?(s.interrupted?'有人離席，本場中止；可回顧本局紀錄。':'九回合累計已完成，可以查看紀錄或開始新局。'):'九回合同步抽藥，調製你的藥袋。每種顏色由真人共選本局藥材效果，全桌同步採用。'));
   const book=el('button','',s.bookSelection?.some(r=>r.tied)?'有藥材書平票 · 開啟寶典裁決':'搭配本局藥材書');book.type='button';book.onclick=()=>openBook(null,book);ui.decorateButton(book,'book');hero.append(book);content.append(hero);
  }
  if(s.phase==='patients'||s.stage==='essence')content.append($('#alchemy'));
  const keep=/^(還要爽爽|下一回合|開始一場|加入測試 AI|抽一張占卜牌|準備結算|擲獎勵骰|獎勵骰完成|確認藥材效果|我要勝利分數|領取本輪獎勵|我要買藥材|完成本輪結算|開始下一回合|暫存決定完成|要拼|我不抽)/;
  for(const n of [...$('#controls').children]){if(n.tagName==='BUTTON'&&keep.test(n.getAttribute('aria-label')||n.textContent))continue;content.append(n);}
  if(waiting&&!content.querySelector('.room-settings-panel')&&s.me!==s.host)content.append(el('p','',s.options.witches?'本局加入草藥女巫擴充；'+(s.options.hiddenProgress?'其他人大釜進度隱藏。':'大釜進度公開。'):'本局使用基本版；'+(s.options.hiddenProgress?'其他人大釜進度隱藏。':'大釜進度公開。')));
  if(s.stage==='shopping'){
   const budget=[...content.children].find(n=>n.tagName==='P'&&n.textContent.startsWith('購物預算'));if(budget){budget.classList.add('q-budget');const coins=el('span','q-budget-coins'),bought=el('span','q-budget-bought');coins.innerHTML=ui.symbol('coins');coins.append(el('strong','',String(m.budget)));bought.append(art.resource('bag',{size:32,decorative:true}),el('strong','',m.bought.length+' / 2'));budget.replaceChildren(coins,bought);budget.tabIndex=0;hint(budget,{title:'本輪採購預算 · '+m.budget+' 金幣',effect:'本輪已買入 '+m.bought.length+' / 2 片；最多兩種不同顏色，剩餘預算不帶到下輪。',caption:'已購藥材卡片有勾選標記，可再次點選取消與退款。',color:'budget'});}
   const purchased=el('div','q-purchased');purchased.setAttribute('aria-label','已收入藥袋的藥材');purchased.append(art.resource('bag',{size:28,decorative:true}));for(const c of m.bought)purchased.append(art.token(c,{size:34}));budget?.after(purchased);
   groupMarket(s);
  }
  if(!$('#controls').children.length)$('#controls').append(el('p','',m?.ready?'你已完成，等待其他人。':s.me===s.host?'請完成中央的選擇。':'等待其他人操作。'));
 }
 function motion(n,frames,opts,remove=true){const a=window.MotionPolicy.animate(n,frames,opts);if(a){if(new URLSearchParams(location.search).has('ui-verify'))console.debug('[quacks-motion] '+n.className+' '+opts.duration+'ms');flying.add(n);a.finished.catch(()=>{}).finally(()=>{flying.delete(n);if(remove)n.remove();});}else if(remove)n.remove();return a;}
 function flight(child,from,to,{duration=650}={}){
  const stage=$('#qPotStage'),r=stage.getBoundingClientRect(),n=el('div','q-flight');n.append(child);stage.append(n);const x1=from.x-r.left-22,y1=from.y-r.top-22,x2=to.x-r.left-22,y2=to.y-r.top-22;
  return motion(n,[{transform:'translate('+x1+'px,'+y1+'px) rotate(-15deg) scale(.9)',opacity:.7},{transform:'translate('+((x1+x2)/2)+'px,'+(Math.min(y1,y2)-60)+'px) rotate(20deg) scale(1.2)',opacity:1,offset:.45},{transform:'translate('+x2+'px,'+y2+'px) rotate(0) scale(.6)',opacity:1}],{duration,easing:'cubic-bezier(.2,.7,.35,1)'});
 }
 const center=n=>{const r=n?.getBoundingClientRect();return r?{x:r.left+r.width/2,y:r.top+r.height/2}:null;};
 function potPoint(position){return center($('#cauldron .pot-space[data-position="'+position+'"]'));}
 function ripple(point){if(!point)return;const stage=$('#qPotStage'),r=stage.getBoundingClientRect();for(let i=0;i<2;i++){const n=el('div','q-ripple');n.style.left=point.x-r.left-12+'px';n.style.top=point.y-r.top-7+'px';stage.append(n);motion(n,[{transform:'scale(.2)',opacity:.8},{transform:'scale(4)',opacity:0}],{duration:750,delay:i*90,easing:'ease-out'});}}
 function sound(name,key,live){return cue.play(name,key,{live});}
 function liveEffects(s,live){
  const p=s.recipes.find(x=>x.id===s.me),old=previous?.recipes.find(x=>x.id===s.me),same=previous?.roundId===s.roundId;

  if(!live||!old||!same){previous=s;return;}
  const potVisible=viewed===s.me&&!$('#qStageOverlay').hidden?false:viewed===s.me;
  const added=p.pot.filter(c=>!old.pot.some(x=>x.id===c.id&&x.position===c.position));
  if(added.length){
   if(potVisible&&window.MotionPolicy.allowsMotion())for(const c of added.slice(-3)){const from=center($('#bagButton')),to=potPoint(c.position);if(from&&to){const a=flight(art.token(c,{size:44,decorative:true}),from,to);a?.finished.then(()=>{if(viewed===s.me)ripple(to);}).catch(()=>{});}}
  }
  if(p.white>=p.threshold-1&&old.white<p.threshold-1&&!p.exploded)sound('quacks-danger','danger:'+s.roundId+':'+p.white,live);
  if(p.explosionId&&p.explosionId!==old.explosionId&&viewed===s.me&&window.MotionPolicy.allowsMotion()){
   const stage=$('#qPotStage'),r=stage.getBoundingClientRect(),at=potPoint(p.position)||center(stage);for(let i=0;i<10;i++){const n=el('div','q-puff');n.style.left=at.x-r.left-27+'px';n.style.top=at.y-r.top-27+'px';stage.append(n);const angle=i*Math.PI*2/10;motion(n,[{transform:'translate(0,0) scale(.2)',opacity:.9},{transform:'translate('+Math.cos(angle)*110+'px,'+(Math.sin(angle)*85-25)+'px) scale(2.6)',opacity:0}],{duration:950,delay:i*12,easing:'ease-out'});}motion($('#cauldron'),[{transform:'translateX(0)'},{transform:'translateX(-5px)'},{transform:'translateX(5px)'},{transform:'translateX(-3px)'},{transform:'translateX(0)'}],{duration:390},false);
  }
  const own=s.mine,prior=previous.mine;
  if(prior?.potion&&!own?.potion){if(potVisible){const removed=old.pot.find(c=>!p.pot.some(x=>x.id===c.id));if(removed){const from=potPoint(removed.position),to=center($('#qPotionSlot'));if(from&&to)flight(art.token(removed,{size:44,decorative:true}),from,to);}}}
  if(own?.bought.length>prior?.bought.length||own?.extraBought.length>prior?.extraBought.length){sound('quacks-buy','buy:'+s.roundId+':'+s.version+':'+own.bought.length+':'+own.extraBought.length,live);const bought=own.bought.at(-1)||own.extraBought.at(-1),from=center($('.q-purchased')||$('.q-budget')),to=center($('#bagButton'));if(bought&&from&&to)flight(art.token(bought,{size:44,decorative:true}),from,{x:to.x,y:$('#qPotStage').getBoundingClientRect().top+18});}
  if(p.rubies>old.rubies){sound('quacks-ruby','ruby:'+s.roundId+':'+s.version,live);const from=center($('#qPotStage')),to=center($('#bagButton'));if(from&&to)flight(art.resource('ruby',{size:44,decorative:true}),from,{x:to.x,y:$('#qPotStage').getBoundingClientRect().top+18});}
  for(const color of ['gold','copper','silver'])if(old.coins?.[color]&&!p.coins?.[color]){sound('quacks-witch','witch:'+s.roundId+':'+color,live);const ring=el('div','q-witch-ring');$('#qPotStage').append(ring);motion(ring,[{transform:'rotate(-25deg) scale(.7)',opacity:0},{transform:'rotate(0) scale(1)',opacity:1},{transform:'rotate(35deg) scale(1.2)',opacity:0}],{duration:1100});}
  for(const player of s.recipes){const before=previous.recipes.find(x=>x.id===player.id);if(before&&player.score>before.score){const card=$('#players [data-player-id="'+player.id+'"]');if(card){const n=el('span','q-score-pop','+'+(player.score-before.score));card.append(n);motion(n,[{transform:'translateY(8px)',opacity:0},{transform:'translateY(-4px)',opacity:1},{transform:'translateY(-24px)',opacity:0}],{duration:950});}}}
  previous=s;
 }
 function quickChoices(quick,finished){quick.replaceChildren();for(const [label,value]of finished?[['GG','GG'],['🔁','再來一局'],['😂','😂']]:[['😂','😂'],['🤔','🤔'],['👏','👏']]){const b=el('button','',label),emoji=/^(😂|🤔|👏)$/.test(value);b.type='button';b.title=value;b.setAttribute('aria-label',(emoji?'送出 ':'填入 ')+value+(emoji?' 表情':' 到聊天室'));b.onclick=()=>emoji?window.GameShell?.sendEmoji(value):window.SharedChat?.compose(value);quick.append(b);}}
 function social(){
  if(mediaReady)return;const tools=$('.q-chat-panel .chat-room-tools');if(!tools)return;mediaReady=true;
  const quick=el('div','q-chat-quick');quick.setAttribute('aria-label','常用句與快速表情');
  tools.prepend(quick);quickChoices(quick,state?.phase==='finished');quick.dataset.finished=String(state?.phase==='finished');
  const off=window.MotionPolicy.subscribe(p=>{$('#qMotion').setAttribute('aria-pressed',String(p.enabled));});window.addEventListener('pagehide',off,{once:true});
 }
 icon('#qMotion','play','切換遊戲動畫');$('#qMotion').onclick=()=>window.MotionPolicy.set({enabled:!window.MotionPolicy.get().enabled});
 $('#soundToggle').onclick=()=>window.AudioSettings.set('effects',{enabled:!window.AudioSettings.get().effects.enabled},{gesture:true});
 const soundSubscription=window.AudioSettings.subscribe(prefs=>{const b=$('#soundToggle'),enabled=String(prefs.effects.enabled);if(b.dataset.effectsEnabled!==enabled){b.dataset.effectsEnabled=enabled;ui.decorateButton(b,prefs.effects.enabled?'sound':'muted',{iconOnly:true,label:prefs.effects.enabled?'關閉遊戲音效':'開啟遊戲音效'});}});window.addEventListener('pagehide',soundSubscription,{once:true});
 window.SharedChat.mountIn($('#qSocial'),{inline:true});
 const removeEffects=()=>{for(const n of flying){n.getAnimations?.().forEach(a=>a.cancel());if(n.matches('.q-flight,.q-puff,.q-ripple,.q-witch-ring,.q-score-pop'))n.remove();}flying.clear();cue.stop();};
 window.MotionPolicy.subscribe(()=>{if(!window.MotionPolicy.allowsMotion())for(const n of [...flying]){n.getAnimations?.().forEach(a=>a.cancel());if(n.classList.contains('q-flight')||n.classList.contains('q-puff')||n.classList.contains('q-ripple')||n.classList.contains('q-witch-ring')||n.classList.contains('q-score-pop'))n.remove();flying.delete(n);}});
 window.addEventListener('pagehide',()=>{removeEffects();cue.reset();});
 window.QuacksStitch={
  baseline(s){return cue.update(s);},disconnect(){cue.disconnect();removeEffects();previous=null;},
  beforeRender(s){const next=s.roundId+':'+s.phase+':'+s.stage,active=document.activeElement;stageScroll=next===stageKey?$('#qStageContent').scrollTop:0;stageFocus=next===stageKey&&active?.closest('#qStageContent')?active.getAttribute('aria-label')||active.textContent:null;stageKey=next;state=s;arrangeNativeControls(s);alchemyHome.after($('#alchemy'));$('#qStageContent').replaceChildren();$('#qPotionSlot').replaceChildren();$('#qExtraContent').replaceChildren();},
  update(s,live){state=s;cue.update(s);waitingRoom(s);paintRoster(s);potChrome(s);actions(s);renderBookTabs();social();phaseRail.hidden=s.phase==='waiting';const phaseIndex=s.phase==='fortune'?1:s.phase==='brewing'?2:s.phase==='settlement'&&s.stage==='shopping'?4:s.phase==='settlement'?3:s.phase==='between'||s.phase==='finished'?5:0;for(const [index,step]of [...phaseRail.children].entries()){step.classList.toggle('active',index===phaseIndex);step.setAttribute('aria-current',index===phaseIndex?'step':'false');}$('#qStageContent').scrollTop=stageScroll;if(stageFocus){const target=[...$('#qStageContent').querySelectorAll('button,select,input')].find(n=>(n.getAttribute('aria-label')||n.textContent)===stageFocus&&!n.disabled);(target||$('#qStageContent')).focus({preventScroll:true});stageFocus=null;}
   $('#qFortune').textContent=s.fortune?'占卜 · '+s.fortune.name:'占卜 · 等待揭曉';$('#qFortune').setAttribute('aria-label',s.fortune?'查看占卜牌 '+s.fortune.name:'查看占卜規則');
   $('#qChatNotice').textContent=s.phase==='waiting'?'朋友集結中，先聊聊這局的配方。':s.phase==='patients'?'先選擇本局要治療的病患。':s.phase==='finished'?'本局完成，聊聊你的神奇藥釜。':'第 '+s.round+' 回合 · '+(s.phase==='brewing'?'等待全桌同步抽藥':'依序結算本輪效果');
   $('#qChatCount').textContent=s.players.length+' 人';
   const quick=$('.q-chat-quick'),finished=String(s.phase==='finished');if(quick&&quick.dataset.finished!==finished){quick.dataset.finished=finished;quickChoices(quick,s.phase==='finished');}
   ui.decorateButton($('#soundToggle'),window.AudioSettings.get().effects.enabled?'sound':'muted',{iconOnly:true,label:window.AudioSettings.get().effects.enabled?'關閉遊戲音效':'開啟遊戲音效'});
   liveEffects(s,live);
  },potUpdated(s){state=s;potChrome(s);},socialUpdate,openBook,syncBookTabs:renderBookTabs,waitingRoom,inspectTooltip:inspect,dismissTooltip,
 };
})();
