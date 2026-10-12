(()=>{
 'use strict';
 const games={
  poker:['德州撲克','好牌已備，等你入座。','2–6 人一起玩。跟注、加注，或把這一手全部押上。'],
  majority:['同頻俱樂部','朋友到齊，默契就位。','3–12 人一起玩。輪流挑題，跟最多朋友想到一起就得分。'],
  gift:['送禮達人','禮物擺好，等你開桌。','3–8 人一起玩。選禮物、標喜好，再一起揭曉朋友的心願。'],
  draw:['你畫我猜','畫筆已備，等你開畫。','2–8 人一起玩。輪流畫圖，其他朋友一起猜出答案。'],
  telephone:['傳情畫意','故事已備，等你傳遞。','3–8 人一起玩。文字與圖畫接力，最後一起翻開傳遞簿。'],
  trpg:['霧港跑團','冒險已備，等你出發。','1–6 人一起玩。選擇角色，與朋友一起完成六幕冒險。'],
  musicquiz:['猜歌挑戰','旋律已備，等你聽題。','1–8 人一起玩。聽六秒旋律開頭，猜歌名後一起揭曉。'],
  minimal:['極簡猜圖','線條已備，等你作畫。','3–6 人一起玩。用直線與圓作畫，由少到多一起猜圖。'],
  bluff:['瞎掰王','角色已備，等你開場。','3–9 人一起玩。輪流解釋與質問，找出唯一的老實人。']
 };
 let hero,stageHome;
 function update(s){
  if(window.RaceLesson)return;
  document.body.dataset.roomPhase=s.phase;if(s.type==='thunder')return;const type=s.type||'poker';const game=games[type];if(!game)return;
  document.body.dataset.roomPhase=s.phase;
  const stage=document.querySelector('#stage'),sidebar=document.querySelector('#gameSidebar,.draw-layout>aside');
  if(stage&&sidebar){if(!stageHome){stageHome=document.createComment('play-stage');stage.before(stageHome);}if(s.phase==='waiting'){if(stage.parentElement!==sidebar)sidebar.prepend(stage);}else if(stage.parentElement!==stageHome.parentElement)stageHome.after(stage);}
  if(!hero){
   const host=document.querySelector('.play-layout>main,.gift-layout>main,.draw-layout>main,#game .play-area,#game .task-layout,#game .adventure-layout');
   if(!host)return;
   hero=document.createElement('section');hero.className='room-waiting-template';hero.setAttribute('aria-label','組隊房間介紹');
   const art=document.createElement('div');art.className='room-waiting-art';const image=document.createElement('img');image.src='/assets/playful/game-'+type+'.svg';image.alt=game[0]+'遊戲插畫';art.append(image);
   const info=document.createElement('div');info.className='room-waiting-info';const kicker=document.createElement('div');kicker.className='kicker';kicker.textContent='朋友集結中';const title=document.createElement('h2');title.textContent=game[1];const copy=document.createElement('p');copy.textContent=game[2];const hint=document.createElement('p');hint.className='room-waiting-hint';hint.setAttribute('role','status');info.append(kicker,title,copy,hint);hero.append(art,info);host.prepend(hero);
  }
  hero.hidden=s.phase!=='waiting';
  const host=s.host===true||s.host===s.me;
  hero.querySelector('.room-waiting-hint').textContent=host?'邀請朋友入座，設定好就能開始。':'等待房主開始遊戲。';
 }
 // Settings use their existing API handlers; a single change commits a valid selection.
 function bindSettings({container,read,save,canSave,isBusy,onError}){
  let pending=null,running=false,timer;
  async function flush(){
   clearTimeout(timer);if(running)return;
   if(!canSave()){pending=null;return;}
   if(!pending)return;
   if(isBusy()){timer=setTimeout(flush,100);return;}
   const data=pending;pending=null;running=true;
   try{await save(data);}catch(e){onError(e.message);}
   finally{running=false;if(pending)void flush();}
  }
  document.addEventListener('change',e=>{
   if(!e.target.closest(container)||!canSave())return;
   try{pending=read();clearTimeout(timer);timer=setTimeout(flush,0);}catch(e){pending=null;onError(e.message);}
  });
  window.addEventListener('pagehide',()=>{clearTimeout(timer);pending=null;});
  return {flush};
 }
 window.RoomWaiting={update,bindSettings};
})();
