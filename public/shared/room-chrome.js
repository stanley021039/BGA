/* Shared room identity. Game adapters supply their label and retain their native actions. */
(()=>{
 'use strict';
 const ui=window.GameUI,homes=new Map(),compact=matchMedia('(max-width:700px)');
 let pending=false;
 function arrange(){
  pending=false;const root=document.querySelector('.ui-room-header');if(!root)return;
  const menu=root.querySelector('#qMobileMenuContent,.st-site-more .site-links');if(!menu)return;
  if(compact.matches){
   for(const control of root.querySelectorAll('.site-settings-button,.site-theme-button,#room-invitations-button,#qBook')){
    if(!homes.has(control)){const home=document.createComment('room-header-tool-home');control.before(home);homes.set(control,home);}
    if(control.parentElement!==menu)menu.append(control);
   }
  }else for(const [control,home]of homes)if(home.parentNode&&control.parentElement!==home.parentNode)home.after(control);
 }
 function schedule(){if(!pending){pending=true;requestAnimationFrame(arrange);}}
 compact.addEventListener('change',schedule);for(const name of ['site-header-ready','room-invitations-ready'])window.addEventListener(name,schedule);
 function header({subtitle,icon='brush'}={}){
  const root=document.querySelector('[data-site-header]');
  if(!root)return null;
  root.classList.add('ui-room-header');schedule();
  let identity=root.querySelector('.st-brand');
  if(identity)return identity;
  const title=root.querySelector('.site-title');
  if(!title)return null;
  identity=document.createElement('div');identity.className='st-brand';
  const mark=document.createElement('span');mark.className='st-brand-mark';mark.setAttribute('aria-hidden','true');mark.innerHTML=ui.symbol(icon);
  const copy=document.createElement('div');copy.className='st-brand-copy';
  const label=document.createElement('small');label.className='st-brand-subtitle';label.textContent=subtitle||'桌遊交誼廳';
  title.textContent='302捉猶團';copy.append(title,label);identity.append(mark,copy);root.prepend(identity);
  return identity;
 }
 window.RoomChrome={header};
})();
