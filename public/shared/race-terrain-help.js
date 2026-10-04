/* Legend help is public rule text; it never reads a room or hazard token. */
((root)=>{
 const rules=Object.freeze({
  R:{name:'公路',effect:'耗 1 移動。非滑行、本次全程公路且未停車，可取得公路骰加速資格。'},
  O:{name:'荒地',effect:'耗 1 移動。荒地不算公路。'},
  M:{name:'泥地',effect:'耗 2 移動。'},
  X:{name:'岩壁',effect:'耗 1 移動；進入立即淘汰，不能用損傷槽抵擋。'},
  '?':{name:'未知危險',effect:'進入才翻開危險標記；實際消耗與效果屆時揭露。'},
  G:{name:'毒液',effect:'耗 1 移動，並立即停止這次移動。'},
  V:{name:'玻璃',effect:'耗 1 移動，沿進入方向再滑 1 格；接續結算落點效果。'},
  J:{name:'跳台',effect:'耗 1 移動。限從正後方進入，擲跳躍骰向前跳並結束移動；其他方向進入會淘汰。'},
  F:{name:'火焰',effect:'耗 1 移動；可操作車輛著火，之後移動前擲火焰骰。'},
  S:{name:'鹽灘',effect:'耗 1 移動。非滑行且未停車時，可取得公路骰加速資格。'}
 });
 for(const rule of Object.values(rules))Object.freeze(rule);
 function helpFor(code){return typeof code==='string'&&Object.hasOwn(rules,code)?rules[code]:rules['?'];}
 function position(anchor,size,viewport){
  const padding=8,gap=8,left=viewport.left||0,top=viewport.top||0,right=left+viewport.width,bottom=top+viewport.height;
  const width=Math.min(size.width,Math.max(0,viewport.width-2*padding)),height=Math.min(size.height,Math.max(0,viewport.height-2*padding));
  return {left:Math.max(left+padding,Math.min(anchor.left,right-width-padding)),top:Math.max(top+padding,Math.min(anchor.bottom+gap+height<=bottom-padding?anchor.bottom+gap:anchor.top-gap-height,bottom-height-padding))};
 }
 if(typeof module==='object'&&module.exports)module.exports={helpFor,position};
 if(!root.document)return;
 const document=root.document,legend=document.querySelector('.terrain-legend');if(!legend)return;
 const tip=document.createElement('div'),name=document.createElement('strong'),effect=document.createElement('p');
 tip.id='raceTerrainLegendTooltip';tip.className='terrain-help-tooltip';tip.setAttribute('role','tooltip');tip.hidden=true;tip.append(name,effect);document.body.append(tip);
 let anchor=null,dismissed=null,hoverTimer=null,leaveTimer=null;
 const control=target=>target?.closest?.('[data-race-terrain]');
 function clearTimers(){root.clearTimeout(hoverTimer);root.clearTimeout(leaveTimer);hoverTimer=null;leaveTimer=null;}
 function hide(){clearTimers();if(anchor){const ids=(anchor.getAttribute('aria-describedby')||'').split(/\s+/).filter(id=>id&&id!==tip.id);if(ids.length)anchor.setAttribute('aria-describedby',ids.join(' '));else anchor.removeAttribute('aria-describedby');}anchor=null;tip.hidden=true;}
 function withinTip(event){if(tip.hidden||!Number.isFinite(event.clientX)||!Number.isFinite(event.clientY))return false;const r=tip.getBoundingClientRect();return event.clientX>=r.left&&event.clientX<=r.right&&event.clientY>=r.top&&event.clientY<=r.bottom;}
 function show(button){
  if(!button?.isConnected||!legend.contains(button))return;hide();anchor=button;const help=helpFor(button.dataset.raceTerrain);name.textContent=help.name;effect.textContent=help.effect;
  root.hideTrackHover?.();tip.hidden=false;
  const view=root.visualViewport,viewport={left:view?.offsetLeft||0,top:view?.offsetTop||0,width:view?.width||root.innerWidth,height:view?.height||root.innerHeight};
  tip.style.maxWidth=Math.max(0,viewport.width-16)+'px';tip.style.maxHeight=Math.max(0,viewport.height-16)+'px';
  const p=position(button.getBoundingClientRect(),{width:tip.offsetWidth,height:tip.offsetHeight},viewport);tip.style.left=p.left+'px';tip.style.top=p.top+'px';
  const ids=new Set((button.getAttribute('aria-describedby')||'').split(/\s+/).filter(Boolean));ids.add(tip.id);button.setAttribute('aria-describedby',[...ids].join(' '));
 }
 function leave(){root.clearTimeout(leaveTimer);leaveTimer=root.setTimeout(hide,180);}
 legend.addEventListener('pointerover',event=>{
  if(event.pointerType==='touch'||event.buttons)return;const button=control(event.target);if(!button||button===dismissed||button===anchor||!legend.contains(button))return;
  hide();anchor=button;hoverTimer=root.setTimeout(()=>{if(anchor===button)show(button);},400);
 });
 legend.addEventListener('pointerout',event=>{const button=control(event.target);if(button?.contains(event.relatedTarget))return;if(button===dismissed)dismissed=null;if(anchor===button&&!withinTip(event))leave();});
 legend.addEventListener('focusin',event=>{const button=control(event.target);if(button&&button!==dismissed)show(button);});
 legend.addEventListener('focusout',event=>{const button=control(event.target);if(!button?.contains(event.relatedTarget)){dismissed=null;hide();}});
 legend.addEventListener('click',event=>{const button=control(event.target);if(button){dismissed=null;show(button);}});
 document.addEventListener('pointermove',event=>{if(!anchor)return;if(anchor.contains(event.target)||withinTip(event))root.clearTimeout(leaveTimer);else leave();});
 document.addEventListener('pointerdown',event=>{if(anchor&&!anchor.contains(event.target))hide();});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'){dismissed=anchor;hide();}});
 document.addEventListener('scroll',hide,true);root.addEventListener('resize',hide);root.addEventListener('blur',hide);
})(typeof window==='object'?window:globalThis);
