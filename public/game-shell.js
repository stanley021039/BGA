(()=>{
 const panel=document.createElement('aside');
 panel.className='shared-game-ui';
 panel.hidden=true;
 panel.innerHTML='<div class="shared-head"><span>AFTERHOURS / ROOM</span><button id="shared-toggle" type="button" aria-expanded="false">展開互動</button><a href="/" aria-label="返回遊戲大廳">離開畫面 ↗</a></div><div id="shared-turn" class="shared-turn" role="status" aria-live="polite">等待開局</div><h2>這一桌的角色</h2><div id="shared-players" class="shared-players"></div><h2>我的表情</h2><div id="shared-expressions" class="shared-expressions"></div><h2>桌邊留言</h2><div id="shared-messages" class="shared-messages" aria-live="polite"></div><form id="shared-chat"><input name="message" maxlength="160" placeholder="說點什麼…" aria-label="桌邊留言" required><button type="submit">傳送</button></form><p id="shared-error" role="status"></p>';
 document.body.append(panel);
 const q=selector=>panel.querySelector(selector);
 let state,loaded=false,myExpressions={};
 function turnOf(s){
  if(['waiting','finished','showdown'].includes(s.phase))return s.phase==='waiting'?'等待房主開始':s.phase==='finished'?'本局結束':'本手結算中';
  if(s.type==='majority'){
   if(s.phase==='answering')return s.answeredIds?.includes(s.me)?'等待其他人作答':'輪到你作答！';
   if(s.phase==='review')return s.host?'輪到你確認答案！':'等待房主確認答案';
   const presenter=s.players.find(player=>player.id===s.presenterId);
   return s.presenterId===s.me?'輪到你出題！':`輪到 ${presenter?.name||'出題者'} 出題`;
  }
  const id=s.type==='thunder'?s.actor:s.players[s.turn]?.id;
  const actor=s.players.find(player=>player.id===id);
  return id===s.me?'輪到你操作！':`輪到 ${actor?.name||'其他玩家'} 操作`;
 }
 function element(tag,className,text){const node=document.createElement(tag);node.className=className;node.textContent=text;return node;}
 function update(s){
  if(window.RaceLesson)return;
  state=s;panel.hidden=false;document.body.classList.add('has-game-shell');
  const current=s.type==='majority'?s.presenterId:s.type==='thunder'?s.actor:s.players[s.turn]?.id;
  const turn=q('#shared-turn');turn.textContent=turnOf(s);turn.classList.toggle('mine',turn.textContent.includes('輪到你'));
  const players=q('#shared-players');players.replaceChildren();
  for(const player of s.players){
   if(player.kicked)continue;
   const row=element('div','shared-player','');row.classList.toggle('active',player.id===current);
   if(player.avatar){const img=document.createElement('img');img.src=player.avatar;img.alt='';row.append(img);}
   row.append(element('span','',player.name+(player.id===s.me?' · 你':'')));
   if(player.id===current)row.append(element('b','','◀ 操作中'));
   players.append(row);
  }
  const messages=q('#shared-messages'),prior=messages.lastElementChild?.dataset.id;
  messages.replaceChildren();
  for(const item of s.social||[]){
   const row=element('div','shared-message','');row.dataset.id=item.id;
   row.append(element('strong','',item.name));
   if(item.kind==='message')row.append(element('span','',item.message));
   else{const img=document.createElement('img');img.src=item.image;img.alt=(item.label||item.expression)+' 表情';row.append(img);}
   messages.append(row);
  }
  if(messages.lastElementChild?.dataset.id!==prior)messages.scrollTop=messages.scrollHeight;
  if(!loaded){loaded=true;loadExpressions();}
 }
 async function loadExpressions(){
  try{const [me,options]=await Promise.all([fetch('/api/auth/me').then(r=>r.json()),fetch('/api/profile/options').then(r=>r.json())]);
   const character=options.characters.find(item=>item.id===(me.appearance||options.defaults).characterId)||options.characters[0];
   myExpressions=character.expressions;
   const holder=q('#shared-expressions');holder.replaceChildren();
   for(const [key,url] of Object.entries(myExpressions)){
    const label=character.labels?.[key]||options.expressionLabels[key]||key;
    const button=document.createElement('button');button.type='button';button.title=label;
    const img=document.createElement('img');img.src=url;img.alt=label;button.append(img);
    button.onclick=()=>send({kind:'expression',expression:key});holder.append(button);
   }
  }catch(error){q('#shared-error').textContent=error.message;}
 }
 async function send(payload){
  if(!state)return;
  try{const response=await fetch('/api/social',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:state.code,...payload})});const result=await response.json();if(!response.ok)throw Error(result.error);q('#shared-error').textContent='';update(result);}
  catch(error){q('#shared-error').textContent=error.message;}
 }
 q('#shared-chat').onsubmit=event=>{event.preventDefault();const input=q('#shared-chat input');const message=input.value.trim();if(!message)return;input.value='';send({kind:'message',message});};
 q('#shared-toggle').onclick=()=>{const expanded=panel.classList.toggle('expanded');q('#shared-toggle').setAttribute('aria-expanded',String(expanded));q('#shared-toggle').textContent=expanded?'收合互動':'展開互動';};
 window.GameShell={update};
})();
