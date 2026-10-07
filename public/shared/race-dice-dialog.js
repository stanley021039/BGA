/* Public dice checks are server-authoritative. Cosmetic rolling never reads result.faces. */
((root)=>{
 const STYLE=`
 .race-dice-dialog{box-sizing:border-box;width:min(60rem,calc(100vw - 32px));max-width:calc(100vw - 32px);max-height:calc(100dvh - 32px);padding:0;border:1px solid #9e8759;border-radius:16px;background:#17231a;color:#ece3ce;font-family:var(--ui-font-family,system-ui,sans-serif);font-size:1rem;line-height:1.5;overflow:auto;box-shadow:0 24px 80px #0008}
 .race-dice-dialog[open]{display:flex;flex-direction:column}.race-dice-dialog::backdrop{background:#07110bcc;backdrop-filter:blur(3px)}
 .race-dice-dialog *{box-sizing:border-box}.race-dice-header,.race-dice-footer{flex:none;padding:16px 24px;background:#17231a}.race-dice-header{border-bottom:1px solid #667252}.race-dice-header h2{margin:0;font-size:1.25rem;line-height:1.4;color:#ffda98}.race-dice-condition{margin:8px 0 0;font-size:1rem;white-space:pre-wrap;overflow-wrap:anywhere}
 .race-dice-body{flex:1 1 auto;min-height:0;padding:16px 24px;overflow:auto;overscroll-behavior:contain}.race-dice-participants{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px}.race-dice-participant,.race-dice-general{min-width:0;padding:12px;border:1px solid #677259;border-radius:10px;background:#233020}.race-dice-participant{border-top:4px solid var(--race-dice-color,#bda16a)}.race-dice-participant h3,.race-dice-general h3{margin:0;font-size:1rem;font-weight:700;overflow-wrap:anywhere}.race-dice-participant-label{margin:4px 0 8px;font-size:1rem;overflow-wrap:anywhere}.race-dice-participant-label:empty{display:none}
 .race-dice-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:8px}.race-dice-general{margin-top:16px}.race-dice-general .race-dice-grid{grid-template-columns:repeat(auto-fit,minmax(min(9rem,100%),1fr))}.race-dice-tile{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;min-width:0;min-height:88px;margin:0;padding:8px;border:1px solid #75805c;border-radius:8px;background:#35432f;color:#f3ead2;text-align:center}.race-dice-face{display:grid;place-items:center;min-width:56px;min-height:56px;max-width:100%;font-size:2rem;font-weight:700;line-height:1.2;overflow-wrap:anywhere}.race-dice-face .race-die-icon{display:block;width:56px;height:56px}.race-dice-face[data-symbol=true]{padding:8px;border:2px solid #273c31;border-radius:10px;background:#fffaf0;color:#172b21;font-size:1rem}.race-dice-caption{font-size:1rem;line-height:1.4;overflow-wrap:anywhere}.race-dice-value-label{font-size:1rem;line-height:1.3}
 .race-dice-dialog[data-stage=rolling] .race-dice-face{animation:race-dice-tumble var(--race-dice-duration,1000ms) ease-out both;animation-delay:var(--race-dice-delay,0ms)}.race-dice-result{margin:16px 0 0;font-size:1rem;white-space:pre-wrap;overflow-wrap:anywhere}.race-dice-result:empty{display:none}.race-dice-footer{display:flex;flex-wrap:wrap;align-items:center;gap:12px;border-top:1px solid #667252}.race-dice-status{flex:1 1 14rem;margin:0;font-size:1rem}.race-dice-actions{display:flex;flex-wrap:wrap;gap:8px}.race-dice-action{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:44px;padding:8px 16px;border:1px solid #b29c65;border-radius:8px;background:#ffda98;color:#17231a;font:inherit;cursor:pointer}.race-dice-action[data-dice-action=rerollDice]{background:#293725;color:#ece3ce}.race-dice-action:disabled{cursor:default;opacity:.65}.race-dice-action:focus-visible,.race-dice-dialog h2:focus-visible{outline:3px solid #f4bf58;outline-offset:3px}.race-dice-action svg{width:24px;height:24px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.race-dice-action [aria-hidden=true]{display:inline-flex}.race-dice-error{flex-basis:100%;min-height:1.5em;margin:0;font-size:1rem;color:#ffd0be}.race-dice-actions [hidden]{display:none}
 .race-dice-dialog[data-kind=round] .race-dice-value-label{display:none}.race-dice-dialog[data-kind=round] .race-dice-general{display:flex;align-items:center;flex-wrap:wrap;gap:16px;margin-top:12px;padding:8px 12px}.race-dice-dialog[data-kind=round] .race-dice-general .race-dice-grid{display:flex;flex-wrap:wrap;gap:8px;margin-top:0}.race-dice-dialog[data-kind=round] .race-dice-general .race-dice-tile{min-width:56px;min-height:56px;padding:8px}.race-dice-dialog[data-kind=round] .race-dice-general .race-dice-face{min-height:32px}.race-dice-dialog[data-kind=round] .race-dice-general .race-dice-caption,.race-dice-dialog[data-kind=round] .race-dice-error:empty{display:none}
 .race-dice-dialog:not([data-kind=round]){width:min(44rem,calc(100vw - 32px))}.race-dice-participants[data-count="1"]{grid-template-columns:1fr}.race-dice-participants[data-count="2"]{grid-template-columns:repeat(2,minmax(0,1fr))}.race-dice-dialog[data-stage=result] .race-dice-face[data-symbol=true]+.race-dice-value-label{display:none}
 @keyframes race-dice-tumble{0%{transform:rotate(-18deg) translateY(-3px)}20%{transform:rotate(20deg) translateY(2px)}40%{transform:rotate(-14deg) translateY(-2px)}65%{transform:rotate(10deg)}85%{transform:rotate(-5deg)}100%{transform:none}}
 @media(max-width:800px){.race-dice-participants{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:480px){.race-dice-dialog{width:calc(100vw - 16px);max-width:calc(100vw - 16px);max-height:calc(100dvh - 16px);border-radius:10px}.race-dice-header,.race-dice-footer,.race-dice-body{padding:12px 16px}.race-dice-participants{grid-template-columns:1fr;gap:12px}.race-dice-actions{width:100%}.race-dice-action{flex:1 1 auto}}
 .motion-reduced .race-dice-dialog[data-stage=rolling] .race-dice-face,.race-dice-dialog[data-motion=false] .race-dice-face{animation:none}
 @media(prefers-reduced-motion:reduce){.race-dice-dialog[data-stage=rolling] .race-dice-face{animation:none}.race-dice-dialog::backdrop{backdrop-filter:none}}
 `;
 // Fixed geometry keeps the face and pips legible regardless of the installed font.
 const pipPositions=[[[32,32]],[[17,17],[47,47]],[[17,17],[32,32],[47,47]],[[17,17],[47,17],[17,47],[47,47]],[[17,17],[47,17],[32,32],[17,47],[47,47]],[[17,17],[47,17],[17,32],[47,32],[17,47],[47,47]]];
 function faceMarkup(value){
  if(!Number.isInteger(value)||value<1||value>6)return '';
  return '<svg class="race-die-icon" viewBox="0 0 64 64" aria-hidden="true" focusable="false"><rect x="3" y="3" width="58" height="58" rx="10" fill="#fffaf0" stroke="#273c31" stroke-width="2"/>'+pipPositions[value-1].map(([x,y])=>'<circle cx="'+x+'" cy="'+y+'" r="5" fill="#172b21"/>').join('')+'</svg>';
 }
 let sequence=0;
 function mount({onAction,onRolling}={}){
  const document=root.document;if(!document)throw Error('RaceDiceDialog needs a document');
  if(!document.getElementById('race-dice-dialog-style')){const style=document.createElement('style');style.id='race-dice-dialog-style';style.textContent=STYLE;document.head.append(style);}
  function node(tag,className,parent,text){const el=document.createElement(tag);if(className)el.className=className;if(text!==undefined)el.textContent=String(text);parent?.append(el);return el;}
  const number=++sequence,dialog=node('dialog','race-dice-dialog',document.body),header=node('header','race-dice-header',dialog),title=node('h2','',header),condition=node('p','race-dice-condition',header),body=node('div','race-dice-body',dialog),participants=node('div','race-dice-participants',body),general=node('section','race-dice-general',body),generalTitle=node('h3','',general,'本次骰子'),generalDice=node('div','race-dice-grid',general),result=node('p','race-dice-result',body),footer=node('footer','race-dice-footer',dialog),status=node('p','race-dice-status',footer),actions=node('div','race-dice-actions',footer),error=node('p','race-dice-error',footer);
  title.id='race-dice-title-'+number;title.tabIndex=-1;condition.id='race-dice-condition-'+number;dialog.setAttribute('aria-labelledby',title.id);dialog.setAttribute('aria-describedby',condition.id);dialog.setAttribute('aria-modal','true');status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.setAttribute('aria-atomic','true');error.setAttribute('role','alert');
  const icons={rollDice:'<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 8h.01M16 8h.01M12 12h.01M8 16h.01M16 16h.01"/>',rerollDice:'<path d="M3 4v6h6M3 10a9 9 0 1 1 1 8"/>',acceptDice:'<path d="m5 12 4 4L19 6"/>'};
  const buttons={};for(const [action,label]of [['rollDice','擲骰'],['rerollDice','重擲兩顆'],['acceptDice','確認，繼續']]){const button=node('button','race-dice-action',actions);button.type='button';button.dataset.diceAction=action;const icon=node('span','',button);icon.setAttribute('aria-hidden','true');icon.innerHTML='<svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">'+icons[action]+'</svg>';node('span','',button,label);button.addEventListener('click',()=>act(action));buttons[action]=button;}
  let state=null,check=null,checkId=null,cycle=null,pending=null,requestNumber=0,destroyed=false,returnFocus=null,timer=null,animationTimer=null,tiles=[],cards=new Map(),layoutKey='',lastStage='',displayDeadline=0;
  const now=()=>Date.now(),reduced=()=>!!root.matchMedia?.('(prefers-reduced-motion: reduce)').matches||root.MotionPolicy?.get().enabled===false||!!document.hidden||cycle?.animate===false;
  function write(el,text){const value=String(text??'');if(el.textContent!==value)el.textContent=value;}
  function clearTimers(){root.clearTimeout(timer);root.clearTimeout(animationTimer);timer=null;animationTimer=null;}
  function ownerName(){return check?.participants?.find(p=>p.id===check.owner)?.name||state?.players?.find(p=>p.id===check.owner)?.name||'負責玩家';}
  function isOwner(){return check?.owner!=null&&state?.me===check.owner;}
  function fingerprint(c){return String(c.status)+'|'+String(c.startedAt??'')+'|'+String(c.owner??'');}
  function cycleKey(c){return String(c.id)+'|'+String(c.startedAt??'');}
  function serverDeadline(c){const local=now();return Number.isFinite(c.readyAt)?Number.isFinite(c.serverNow)?local+Math.max(0,c.readyAt-c.serverNow):Math.max(local,c.readyAt):local;}
  function participantKey(participant){return typeof participant.car==='string'&&participant.car?participant.car:participant.car?.id??participant.id;}
  function carLabel(car){if(!car||typeof car!=='object')return '';return car.label||car.name||(['輕型車','中型車','重型車'][car.size]??'');}
  function updateParticipants(){
   for(const participant of check.participants||[]){const card=cards.get(participantKey(participant));if(!card)continue;card.name.textContent=participant.name||'車隊';card.label.textContent=[participant.label,carLabel(participant.car)].filter((label,index,all)=>label&&all.indexOf(label)===index).join(' · ');const color=/^#[\da-f]{3,8}$/i.test(participant.color||'')?participant.color:'#bda16a';card.el.style.setProperty('--race-dice-color',color);}
  }
  function buildBoard(){
   participants.replaceChildren();participants.dataset.count=String((check.participants||[]).length);generalDice.replaceChildren();cards=new Map();tiles=[];
   for(const participant of check.participants||[]){const el=node('section','race-dice-participant',participants),name=node('h3','',el),label=node('p','race-dice-participant-label',el),grid=node('div','race-dice-grid',el);cards.set(participantKey(participant),{el,name,label,grid});}
   for(const [index,die]of (check.dice||[]).entries()){const parent=cards.get(die.participant)?.grid||generalDice,el=node('figure','race-dice-tile',parent),face=node('span','race-dice-face',el),valueLabel=node('span','race-dice-value-label',el),label=node('figcaption','race-dice-caption',el);face.setAttribute('aria-hidden','true');valueLabel.setAttribute('aria-hidden','true');label.textContent=die.label||'骰子 '+(index+1);tiles.push({el,face,valueLabel,label});}
   for(const card of cards.values())card.grid.hidden=!card.grid.children.length;
   participants.hidden=!cards.size;general.hidden=!generalDice.children.length;generalTitle.textContent=check.kind==='round'?'共同公路骰':'本次判定骰';updateParticipants();
  }
  function paintFace(tile,value,mode,index){
   const die=check.dice[index],numeric=typeof value==='number'&&Number.isInteger(value)&&value>=1&&value<=6,display=value==='out'?'熄滅':value==='eliminate'?'淘汰':String(value??'?'),caption=mode==='result'?(numeric?value+' 點':display):mode==='rolling'?'擲骰中':'尚未擲骰';
   if(numeric)tile.face.innerHTML=faceMarkup(value);else tile.face.textContent=display;tile.face.dataset.symbol=String(!numeric);tile.valueLabel.textContent=caption;tile.el.setAttribute('aria-label',(die.label||'骰子 '+(index+1))+'，'+caption);
  }
  function stage(){
   if(check.status==='awaiting')return 'awaiting';
   if(cycle?.observed&&now()<displayDeadline)return 'rolling';
   const complete=check.status==='result'&&Array.isArray(check.result?.faces)&&check.result.faces.length===(check.dice||[]).length;
   return complete?'result':'waiting';
  }
  function cosmeticTick(){
   root.clearTimeout(animationTimer);animationTimer=null;if(!check||stage()!=='rolling'||reduced())return;
   const tick=Math.floor((now()-cycle.seenAt)/100);
   tiles.forEach((tile,index)=>{const faces=check.dice[index].faces||[],face=faces.length?faces[(tick+index)%faces.length]:'?';paintFace(tile,face,'rolling',index);});
   animationTimer=root.setTimeout(cosmeticTick,100);
  }
  function render(){
   if(!check||destroyed)return;root.clearTimeout(timer);timer=null;const currentStage=stage(),changed=currentStage!==lastStage;
   dialog.dataset.stage=currentStage;dialog.dataset.motion=String(!reduced());dialog.dataset.kind=check.kind||'';write(title,check.title||'同步擲骰');write(condition,check.condition||'依本次骰子結果結算。');updateParticipants();
   if(changed&&currentStage==='rolling'){const elapsed=Math.max(0,now()-cycle.seenAt);dialog.style.setProperty('--race-dice-duration',Math.max(1000,displayDeadline-cycle.seenAt)+'ms');dialog.style.setProperty('--race-dice-delay',-elapsed+'ms');}
   if(currentStage==='result'){root.clearTimeout(animationTimer);animationTimer=null;tiles.forEach((tile,index)=>paintFace(tile,check.result.faces[index],'result',index));write(result,check.result.text||'擲骰完成。');}
   else{write(result,'');if(currentStage!=='rolling'||reduced())tiles.forEach((tile,index)=>paintFace(tile,'?',currentStage==='awaiting'?'awaiting':'rolling',index));if(currentStage==='rolling'&&animationTimer===null)cosmeticTick();}
   const owned=isOwner();buttons.rollDice.hidden=!(owned&&currentStage==='awaiting');buttons.acceptDice.hidden=!(owned&&currentStage==='result');buttons.rerollDice.hidden=!(owned&&currentStage==='result'&&check.rerollAllowed&&check.kind==='collision');
   for(const button of Object.values(buttons)){button.disabled=button.hidden||!owned||!!pending||typeof onAction!=='function';if(pending&&!button.hidden)button.setAttribute('aria-busy','true');else button.removeAttribute('aria-busy');}
   let message;
   if(pending)message='操作已送出，等待同步…';
   else if(currentStage==='rolling')message='所有玩家同步觀看擲骰…';
   else if(currentStage==='waiting')message='等待伺服器同步完整結果…';
   else if(currentStage==='awaiting')message=owned?'請擲骰，其他玩家也會看到本次判定。':'等待 '+ownerName()+' 擲骰。';
   else message=owned?'確認結果後繼續遊戲。':'等待 '+ownerName()+' 確認結果。';
   write(status,message);
   if(Object.values(buttons).includes(document.activeElement)&&document.activeElement.hidden)title.focus({preventScroll:true});
   lastStage=currentStage;if(cycle?.observed&&now()<displayDeadline)timer=root.setTimeout(render,Math.max(1,displayDeadline-now()));
  }
  function open(){if(!dialog.open){dialog.showModal();title.focus({preventScroll:true});}}
  function show(nextState,{live=true,deferred=false,soundLive=live,soundEpoch}={}){
   if(destroyed)return;const next=nextState?.diceCheck;if(next?.id==null||!['awaiting','rolling','result'].includes(next.status)){reset();return;}
   const different=next.id!==checkId;state=nextState;check=next;
   if(different){clearTimers();checkId=next.id;cycle=null;pending=null;layoutKey='';lastStage='';displayDeadline=0;error.textContent='';if(!dialog.open)returnFocus=document.activeElement;}
   else if(pending&&pending.key!==fingerprint(next)){pending=null;error.textContent='';}
   const key=cycleKey(next);if(next.status==='rolling'&&cycle?.key!==key){clearTimers();cycle={key,observed:true,seenAt:now(),animate:live&&!document.hidden,soundLive,soundEpoch};displayDeadline=Math.max(serverDeadline(next),cycle.seenAt+1000);lastStage='';pending=null;error.textContent='';}
   // Movement may keep the map visible until a check has already resolved on
   // the server. Show one local cosmetic cycle when it is first presented;
   // later presence polls keep its deadline and never initiate another roll.
   else if(different&&next.status==='result'&&deferred&&live&&!document.hidden){cycle={key,observed:true,deferred:true,seenAt:now(),animate:!reduced(),soundLive,soundEpoch};displayDeadline=cycle.seenAt+1000;}
   else if(cycle?.observed&&!cycle.deferred&&cycle.key===key&&Number.isFinite(next.serverNow)&&Number.isFinite(next.readyAt))displayDeadline=Math.max(cycle.seenAt+1000,serverDeadline(next));
   const nextLayout=JSON.stringify([(next.participants||[]).map(participantKey),(next.dice||[]).map(d=>[d.participant,d.label])]);if(layoutKey!==nextLayout){layoutKey=nextLayout;buildBoard();}
   render();open();
   // Report only after the dialog is visible; cosmetic ticks and redraws never replay sound.
   if(stage()==='rolling'&&!cycle.soundNotified){cycle.soundNotified=true;onRolling?.({checkId:check.id,cycleKey:cycle.key,live:cycle.soundLive,epoch:cycle.soundEpoch});}
  }
  async function act(action){
   if(!check||destroyed||pending||!isOwner()||typeof onAction!=='function')return;
   const currentStage=stage();if(action==='rollDice'?currentStage!=='awaiting':currentStage!=='result')return;if(action==='rerollDice'&&!(check.kind==='collision'&&check.rerollAllowed))return;
   const request=++requestNumber,id=check.id,key=fingerprint(check);pending={request,id,key};error.textContent='';render();
   try{await onAction(action,{check:id});}
   catch(failure){if(!destroyed&&pending?.request===request&&check?.id===id&&fingerprint(check)===key){pending=null;error.textContent=failure?.message||'操作未完成，請再試一次。';render();}}
  }
  function reset(){clearTimers();state=null;check=null;checkId=null;cycle=null;pending=null;layoutKey='';lastStage='';displayDeadline=0;error.textContent='';result.textContent='';if(dialog.open)dialog.close();if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true});returnFocus=null;}
  function destroy(){if(destroyed)return;reset();destroyed=true;unsubscribe?.();document.removeEventListener?.('visibilitychange',visibility);dialog.remove();}
  dialog.addEventListener('cancel',event=>event.preventDefault());dialog.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();}});dialog.addEventListener('close',()=>{if(check&&!destroyed)open();});
  const preference=()=>{if(check){if(cycle&&(document.hidden||!root.MotionPolicy?.allowsMotion()))cycle.animate=false;root.clearTimeout(animationTimer);animationTimer=null;render();}},visibility=()=>{if(document.hidden)preference();};
  const unsubscribe=root.MotionPolicy?.subscribe(preference);document.addEventListener?.('visibilitychange',visibility);
  return{show,reset,destroy};
 }
 root.RaceDiceDialog={mount,faceMarkup};
})(typeof window==='object'?window:globalThis);
