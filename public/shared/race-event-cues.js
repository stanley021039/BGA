'use strict';
window.RaceEventCues={mount(immersion){
 const panel=document.getElementById('raceEventPopup'),title=document.getElementById('raceEventTitle'),detail=document.getElementById('raceEventDetail'),symbol=document.getElementById('raceEventSymbol'),skip=document.getElementById('raceEventSkip');
 const priority={slam:10,eliminated:9,fire:8,damage:8,shot:7,hazard:6,trap:6,quake:6,glass:6,jump:5,fireDie:5,airstrike:5,road:4};
 const labels={slam:'車輛碰撞',eliminated:'車輛淘汰',fire:'車輛起火',damage:'車輛受損',shot:'射擊事件',hazard:'危險揭露',trap:'陷阱觸發',quake:'地震來襲',glass:'玻璃滑移',jump:'跳台飛躍',fireDie:'火焰效果',airstrike:'直升機抵達',road:'道路變化'};
 const hazardSymbols={mine:'✹',wreck:'▰',oil:'◉',glass:'◇',ramp:'↟',fire:'♨',pit:'⊗',quake:'≋',worm:'〰',mud:'≈',road:'↗'};
 const symbols={slam:'✦',eliminated:'×',fire:'♨',damage:'⚙',shot:'➤',hazard:'⚠',trap:'⊗',quake:'≋',glass:'◇',jump:'↟',fireDie:'♨',airstrike:'✣',road:'↗'};
 let timer=null,reposition=null,onSkip=null;
 function hide(){clearTimeout(timer);timer=null;reposition=null;onSkip=null;panel.hidden=true;}
 function skipCurrent(){if(panel.hidden)return;const notify=onSkip;hide();notify?.();}
 const labelFor=event=>event.kind==='shot'&&!event.hit?'射擊落空':labels[event.kind];
 function show(events,cars=[],opts={}){
  if(document.hidden)return hide();
  const readable=events.filter(item=>Object.hasOwn(priority,item.kind)).sort((a,b)=>a.id-b.id);
  const event=[...readable].sort((a,b)=>priority[b.kind]-priority[a.kind]||b.id-a.id)[0];
  if(!event)return;
  hide();
  panel.dataset.kind=event.kind;panel.dataset.motion=String(immersion.allowsMotion());
  panel.dataset.hit=event.hit===false?'miss':'hit';
  title.textContent=readable.length>1?'連鎖賽道事件':labelFor(event);
  detail.textContent=readable.length>1?readable.map(item=>labelFor(item)+(item.text?'：'+String(item.text):'')).join('\n'):String(event.text||'');
  detail.style.whiteSpace='pre-line';
  symbol.textContent=event.kind==='hazard'?(hazardSymbols[event.hazard]||symbols.hazard):symbols[event.kind];
  panel.hidden=false;
  onSkip=typeof opts.onSkip==='function'?opts.onSkip:null;
  const stage=panel.closest('.race-stage');
  const carId=event.car||event.target||event.top||event.bottom;
  const affected=cars.find(car=>car.id===carId);
  const xCell=Number.isInteger(event.x)?event.x:affected?.x,yCell=Number.isInteger(event.y)?event.y:affected?.y;
  const cellAt=(x,y)=>Number.isInteger(x)&&Number.isInteger(y)?document.querySelector(`#track [data-x="${x}"][data-y="${y}"]`):null;
  const findAnchor=()=>cellAt(event.x,event.y)||Array.from(document.querySelectorAll('#track [data-car]')).find(node=>node.dataset.car===carId)||cellAt(xCell,yCell)||document.querySelector('#track .active-car');
  reposition=()=>{
   const bounds=stage.getBoundingClientRect(),view=window.visualViewport;
   const left=view?.offsetLeft||0,top=view?.offsetTop||0,width=view?.width||window.innerWidth||document.documentElement?.clientWidth||bounds.left+bounds.width,height=view?.height||window.innerHeight||document.documentElement?.clientHeight||bounds.top+bounds.height;
   const minX=Math.max(bounds.left,left)+8,maxX=Math.min(bounds.left+bounds.width,left+width)-8,minY=Math.max(bounds.top,top)+8,maxY=Math.min(bounds.top+bounds.height,top+height)-8;
   if(maxX<=minX||maxY<=minY)return hide();
   panel.style.boxSizing='border-box';panel.style.maxWidth=(maxX-minX)+'px';panel.style.maxHeight=(maxY-minY)+'px';
   const anchor=findAnchor()?.getBoundingClientRect(),x=anchor?anchor.left+anchor.width/2:bounds.left+bounds.width/2,y=anchor?anchor.top+anchor.height/2:bounds.top+bounds.height/2;
   let preferredY=y-panel.offsetHeight/2;
   if(anchor&&anchor.top-panel.offsetHeight-8>=minY)preferredY=anchor.top-panel.offsetHeight-8;
   else if(anchor&&anchor.top+anchor.height+8+panel.offsetHeight<=maxY)preferredY=anchor.top+anchor.height+8;
   const offsetX=bounds.left+(stage.clientLeft||0),offsetY=bounds.top+(stage.clientTop||0);
   panel.style.left=(Math.max(minX,Math.min(maxX-panel.offsetWidth,x-panel.offsetWidth/2))-offsetX)+'px';
   panel.style.top=(Math.max(minY,Math.min(maxY-panel.offsetHeight,preferredY))-offsetY)+'px';panel.style.right='auto';
  };
  reposition();
  if(!panel.hidden)timer=setTimeout(hide,Number.isFinite(opts.duration)?Math.max(0,opts.duration):3200);
 }
 window.MotionPolicy?.subscribe(()=>{if(!immersion.allowsMotion())panel.dataset.motion='false';});
 skip.addEventListener('click',skipCurrent);
 document.addEventListener('keydown',event=>{if(event.key==='Escape')skipCurrent();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)hide();});
 window.addEventListener?.('resize',()=>reposition?.());
 document.addEventListener('scroll',()=>reposition?.(),true);
 window.visualViewport?.addEventListener('resize',()=>reposition?.());
 window.visualViewport?.addEventListener('scroll',()=>reposition?.());
 return {show,hide};
}};
