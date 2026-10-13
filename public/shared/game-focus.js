(()=>{
'use strict';
const selector=document.body.dataset.gameFocus;
if(!selector)return;
const toggle=document.createElement('button');toggle.type='button';toggle.id='gameFocusToggle';toggle.className='game-focus-toggle';toggle.title='專注全螢幕';toggle.setAttribute('aria-pressed','false');document.body.append(toggle);
let active=false,ownFullscreen=false,scroll,previous;
const excluded=new Set(),containers=new Set();
function restore(){for(const n of excluded)n.classList.remove('game-focus-excluded');excluded.clear();for(const n of containers)n.removeAttribute('data-game-focus-container');containers.clear();}
function isolate(){restore();const root=document.querySelector(selector);if(!active||!root)return;root.setAttribute('data-game-focus-root','');let n=root;while(n&&n!==document.body){if(n!==root){n.setAttribute('data-game-focus-container','');containers.add(n);}for(const sibling of n.parentElement.children)if(sibling!==n&&sibling!==toggle&&!sibling.hasAttribute?.('data-game-focus-overlay')&&sibling.getAttribute?.('role')!=='tooltip'&&!['SCRIPT','STYLE','LINK','DIALOG'].includes(sibling.tagName)){sibling.classList.add('game-focus-excluded');excluded.add(sibling);}n=n.parentElement;}document.body.classList.add('game-focus-active');}
function label(){const label=active?'退出專注全螢幕':'專注全螢幕';toggle.textContent=label;window.GameUI?.decorateButton(toggle,active?'close':'expand',{iconOnly:true,label});toggle.title=label;toggle.setAttribute('aria-label',label);toggle.setAttribute('aria-pressed',String(active));}
function clear(){toggle.dataset.focusState='exited';active=false;ownFullscreen=false;restore();document.body.classList.remove('game-focus-active');label();if(scroll)window.scrollTo(scroll.x,scroll.y);if(previous?.isConnected)previous.focus({preventScroll:true});}
async function exit(){const shouldExit=ownFullscreen&&document.fullscreenElement===document.documentElement;clear();if(shouldExit)try{await document.exitFullscreen();}catch{}}
toggle.onclick=async event=>{event?.preventDefault?.();event?.stopPropagation?.();toggle.dataset.focusState='clicked';if(active)return exit();const root=document.querySelector(selector);if(!root||(root.hidden&&!root.getClientRects?.().length)){toggle.dataset.focusState='no-game';return;}previous=document.activeElement;scroll={x:window.scrollX,y:window.scrollY};active=true;toggle.dataset.focusState='active';isolate();label();toggle.focus();window.scrollTo(0,0);if(!document.fullscreenElement&&document.documentElement.requestFullscreen)try{await document.documentElement.requestFullscreen();if(active)ownFullscreen=true;else if(document.fullscreenElement===document.documentElement)await document.exitFullscreen();}catch{}};
document.addEventListener('fullscreenchange',()=>{if(active&&ownFullscreen&&!document.fullscreenElement)clear();});
document.addEventListener('keydown',e=>{if(active&&e.key==='Escape'){e.preventDefault();exit();}});
new MutationObserver(()=>{if(active)isolate();}).observe(document.body,{childList:true,subtree:true});
window.addEventListener('pagehide',()=>{if(active)exit();});
label();window.GameFocus={exit,isActive:()=>active};
})();