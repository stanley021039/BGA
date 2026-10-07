'use strict';
const list=document.querySelector('#achievementList');
fetch('/api/achievements').then(async response=>{
 const data=await response.json();
 if(!response.ok)throw Error(data.error||'無法載入成就');
 const summary=document.querySelector('#achievementSummary');
 if(summary)summary.textContent='已收藏 '+data.achievements.filter(item=>item.unlockedAt).length+' / '+data.achievements.length+' 枚';
 list.replaceChildren();
 for(const achievement of data.achievements){
  const card=document.createElement('article');card.className='achievement-card';card.classList.toggle('unlocked',!!achievement.unlockedAt);
  const mark=document.createElement('span');mark.className='achievement-mark';mark.textContent='✦';mark.setAttribute('aria-hidden','true');
  const body=document.createElement('div'),title=document.createElement('h3'),description=document.createElement('p'),status=document.createElement('span');
  title.textContent=achievement.title;description.textContent=achievement.description;status.className='achievement-status';
  status.textContent=achievement.unlockedAt?`已解鎖 · ${new Intl.DateTimeFormat('zh-TW',{dateStyle:'medium'}).format(new Date(achievement.unlockedAt))}`:'尚未解鎖';
  body.append(title,description,status);card.append(mark,body);list.append(card);
 }
 if(!data.achievements.length)list.textContent='目前沒有可收集的成就。';
}).catch(error=>{list.textContent=error.message;});
