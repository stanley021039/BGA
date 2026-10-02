'use strict';
window.RaceEventCues={mount(immersion){
 const panel=document.getElementById('raceEventPopup'),title=document.getElementById('raceEventTitle'),detail=document.getElementById('raceEventDetail'),symbol=document.getElementById('raceEventSymbol'),skip=document.getElementById('raceEventSkip');
 const priority={slam:10,eliminated:9,fire:8,damage:8,shot:7,hazard:6,trap:6,quake:6,jump:5,fireDie:5,airstrike:5,road:4};
 const labels={slam:'車輛碰撞',eliminated:'車輛淘汰',fire:'車輛起火',damage:'車輛受損',shot:'射擊事件',hazard:'危險揭露',trap:'陷阱觸發',quake:'地震來襲',jump:'跳台飛躍',fireDie:'火焰效果',airstrike:'直升機抵達',road:'道路變化'};
 const hazardSymbols={mine:'✹',wreck:'▰',oil:'◉',glass:'◇',ramp:'↟',fire:'♨',pit:'⊗',quake:'≋',worm:'〰',mud:'≈',road:'↗'};
 const symbols={slam:'✦',eliminated:'×',fire:'♨',damage:'⚙',shot:'➤',hazard:'⚠',trap:'⊗',quake:'≋',jump:'↟',fireDie:'♨',airstrike:'✣',road:'↗'};
 let timer=null;
 function hide(){clearTimeout(timer);timer=null;panel.hidden=true;}
 function show(events){
  if(!immersion.allowsMotion()||document.hidden)return hide();
  const event=events.filter(item=>Object.hasOwn(priority,item.kind)).sort((a,b)=>priority[b.kind]-priority[a.kind]||b.id-a.id)[0];
  if(!event)return;
  hide();
  panel.dataset.kind=event.kind;
  panel.dataset.hit=event.hit===false?'miss':'hit';
  title.textContent=event.kind==='shot'&&!event.hit?'射擊落空':labels[event.kind];
  detail.textContent=String(event.text||'');
  symbol.textContent=event.kind==='hazard'?(hazardSymbols[event.hazard]||symbols.hazard):symbols[event.kind];
  panel.hidden=false;
  timer=setTimeout(hide,2200);
 }
 skip.addEventListener('click',hide);
 document.addEventListener('keydown',event=>{if(event.key==='Escape')hide();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)hide();});
 return {show,hide};
}};
