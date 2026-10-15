(()=>{
'use strict';
window.QuacksAutoFortune={create({draw,isBusy=()=>false}){
 const host=document.createElement('div');host.id='quacksAutoFortune';host.className='quacks-auto-fortune';host.hidden=true;host.setAttribute('data-game-focus-overlay','');host.setAttribute('role','region');host.setAttribute('aria-label','抽取本輪占卜牌');
 const scene=document.createElement('div');scene.className='auto-fortune-scene';const gate=document.createElement('div');gate.className='auto-fortune-gate';const card=document.createElement('button');card.type='button';card.className='auto-fortune-draw';card.setAttribute('aria-label','抽一張占卜牌');const back=document.createElement('img');back.src='/assets/quacks/fortune-back.svg';back.alt='';back.className='auto-fortune-back';const caption=document.createElement('span');caption.textContent='點一下抽牌';card.append(back,caption);scene.append(gate,card);host.append(scene);document.body.append(host);
 let key=null,state=null,tried=false,generation=0;
 const hide=()=>{host.hidden=true;};
 function eligible(){return state?.phase==='fortune'&&state.me===state.roundStarterId&&!document.hidden;}
 function update(next){const nextKey=next.code+':'+next.roundId;if(nextKey!==key){generation++;hide();key=nextKey;tried=false;}state=next;if(!eligible()||tried){hide();return;}const opening=host.hidden;host.hidden=false;card.disabled=isBusy();if(opening)card.focus?.({preventScroll:true});}
 card.onclick=async()=>{if(tried||!eligible()||isBusy())return;tried=true;card.disabled=true;const token=generation;try{const ok=await draw('fortune-'+state.roundId);if(ok===false&&token===generation)tried=false;}catch{if(token===generation)tried=false;}finally{if(token===generation){if(eligible()&&!tried)update(state);else hide();}}};
 const hidden=()=>{if(document.hidden)hide();};document.addEventListener('visibilitychange',hidden);
 return {update,reset(){generation++;hide();key=null;state=null;tried=false;},destroy(){generation++;hide();document.removeEventListener('visibilitychange',hidden);host.remove();}};
}};
})();
