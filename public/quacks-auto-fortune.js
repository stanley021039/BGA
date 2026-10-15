(()=>{
'use strict';
window.QuacksAutoFortune={create({draw,isBusy=()=>false,delay=650}){
 const host=document.createElement('div');host.id='quacksAutoFortune';host.className='quacks-auto-fortune';host.hidden=true;host.setAttribute('data-game-focus-overlay','');host.setAttribute('role','status');host.setAttribute('aria-live','polite');host.setAttribute('aria-label','正在自動抽取占卜牌');
 const scene=document.createElement('div');scene.className='auto-fortune-scene';const gate=document.createElement('div');gate.className='auto-fortune-gate';const back=document.createElement('img');back.src='/assets/quacks/fortune-back.svg';back.alt='占卜牌背';back.className='auto-fortune-back';scene.append(gate,back);host.append(scene);document.body.append(host);
 let key=null,state=null,timer=null,tried=false,generation=0;
 const hide=()=>{host.hidden=true;};
 function cancel(){generation++;if(timer!==null)clearTimeout(timer);timer=null;hide();}
 function eligible(){return state?.phase==='fortune'&&state.me===state.roundStarterId&&!document.hidden;}
 function schedule(){if(tried||timer!==null||!eligible())return;host.hidden=false;const token=generation;timer=setTimeout(async()=>{timer=null;if(token!==generation||!eligible())return;if(isBusy()){schedule();return;}tried=true;try{await draw('fortune-'+state.roundId);}catch{}finally{if(token===generation)hide();}},delay);}
 function update(next){const nextKey=next.code+':'+next.roundId;if(nextKey!==key){cancel();key=nextKey;tried=false;}state=next;if(!eligible()){cancel();return;}schedule();}
 const hidden=()=>{if(document.hidden)cancel();};document.addEventListener('visibilitychange',hidden);
 return {update,reset(){cancel();key=null;state=null;tried=false;},destroy(){cancel();document.removeEventListener('visibilitychange',hidden);host.remove();}};
}};
})();
