(()=>{
 const header=document.querySelector('[data-site-header]');if(!header)return;
 const account=header.querySelector('.site-account'),button=header.querySelector('#site-account-button'),menu=header.querySelector('#site-account-menu');
 const settingsButton=document.createElement('button'),settings=document.createElement('section');
 settingsButton.id='site-settings-button';settingsButton.type='button';settingsButton.className='site-settings-button';settingsButton.title='設定';settingsButton.setAttribute('aria-label','設定');settingsButton.setAttribute('aria-expanded','false');settingsButton.setAttribute('aria-controls','site-settings');settingsButton.setAttribute('aria-haspopup','dialog');
 settingsButton.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.39 3.15L10.57 1.09L13.43 1.09L13.61 3.15L17.12 4.60L18.70 3.28L20.72 5.30L19.40 6.88L20.85 10.39L22.91 10.57L22.91 13.43L20.85 13.61L19.40 17.12L20.72 18.70L18.70 20.72L17.12 19.40L13.61 20.85L13.43 22.91L10.57 22.91L10.39 20.85L6.88 19.40L5.30 20.72L3.28 18.70L4.60 17.12L3.15 13.61L1.09 13.43L1.09 10.57L3.15 10.39L4.60 6.88L3.28 5.30L5.30 3.28L6.88 4.60Z"/><circle cx="12" cy="12" r="3"/></svg>';
 settings.id='site-settings';settings.className='site-settings';settings.hidden=true;settings.setAttribute('role','dialog');settings.setAttribute('aria-labelledby','site-settings-title');
 settings.innerHTML='<div class="site-settings-heading"><h2 id="site-settings-title">遊戲設定</h2><button type="button" id="site-settings-close" aria-label="關閉遊戲設定" title="關閉">×</button></div><p class="site-settings-note">全遊戲共用 · 只調整你的體驗</p>'+['music','effects'].map(kind=>{const label=kind==='music'?'背景音樂':'遊戲音效';return '<div class="site-audio-group"><label class="site-audio-switch"><span>'+label+'</span><input id="site-'+kind+'-enabled" type="checkbox" role="switch" aria-label="開啟'+label+'"></label><div class="site-audio-volume"><input id="site-'+kind+'-volume" type="range" min="0" max="100" step="1" aria-label="'+label+'音量"><output id="site-'+kind+'-value" for="site-'+kind+'-volume"></output></div></div>';}).join('')+'<button type="button" id="site-effects-preview" class="site-effects-preview">試聽音效</button><p id="site-audio-status" role="status"></p>';
 if(window.MotionPolicy){
  const group=document.createElement('div');group.className='site-audio-group';group.innerHTML='<label class="site-audio-switch"><span>遊戲動畫</span><input id="site-motion-enabled" type="checkbox" role="switch" aria-label="顯示遊戲動畫"></label><label class="site-audio-switch"><span>文字與 emoji 彈幕</span><input id="site-barrages-enabled" type="checkbox" role="switch" aria-label="顯示文字與 emoji 彈幕"></label><p id="site-motion-status" class="site-settings-note"></p>';settings.append(group);
  MotionPolicy.subscribe(prefs=>{settings.querySelector('#site-motion-enabled').checked=prefs.enabled;settings.querySelector('#site-barrages-enabled').checked=prefs.barrages;settings.querySelector('#site-motion-status').textContent=prefs.reduced?'系統已減少動態；結果保留，彈幕改為靜態。':'關閉動畫仍保留結果；彈幕可另外隱藏。';});
  settings.querySelector('#site-motion-enabled').onchange=event=>MotionPolicy.set({enabled:event.target.checked});settings.querySelector('#site-barrages-enabled').onchange=event=>MotionPolicy.set({barrages:event.target.checked});
 }
 const versionInfo=document.createElement('p');versionInfo.id='site-version';versionInfo.className='site-version';versionInfo.textContent='版本資訊';settings.append(versionInfo);
 let versionLoaded=false,versionLoading=false;
 async function loadVersion(){
  if(versionLoaded||versionLoading)return;versionLoading=true;versionInfo.textContent='版本載入中…';
  try{const response=await fetch('/api/version',{cache:'no-store'});if(!response.ok)throw Error('version unavailable');const data=await response.json();if(typeof data.version!=='string'||data.version.length>30||!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(data.version))throw Error('invalid version');versionInfo.textContent='版本 v'+data.version;versionLoaded=true;}
  catch{versionInfo.textContent='版本暫時無法取得';}finally{versionLoading=false;}
 }
 account.insertBefore(settingsButton,button);account.append(settings);
 function closeSettings(focus=false){settings.hidden=true;settingsButton.setAttribute('aria-expanded','false');if(focus)settingsButton.focus();}
 const audioPopover=window.UIPopover?.bind(settingsButton,settings,{align:'end',width:320,onClose:()=>closeSettings()});
 settingsButton.onclick=()=>{const open=settings.hidden;close();closeSettings();if(open){settings.hidden=false;settingsButton.setAttribute('aria-expanded','true');audioPopover?.sync();settings.querySelector('input').focus();loadVersion();}};
 settings.querySelector('#site-settings-close').onclick=()=>closeSettings(true);
 settings.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closeSettings(true);}});
 window.AudioSettings.subscribe(prefs=>{for(const kind of ['music','effects']){settings.querySelector('#site-'+kind+'-enabled').checked=prefs[kind].enabled;settings.querySelector('#site-'+kind+'-volume').value=Math.round(prefs[kind].volume*100);settings.querySelector('#site-'+kind+'-value').textContent=Math.round(prefs[kind].volume*100)+'%';}settings.querySelector('#site-effects-preview').disabled=!prefs.effects.enabled||!prefs.effects.volume;});
 for(const kind of ['music','effects']){settings.querySelector('#site-'+kind+'-enabled').onchange=event=>{window.AudioSettings.set(kind,{enabled:event.target.checked},{gesture:true});settings.querySelector('#site-audio-status').textContent='';};settings.querySelector('#site-'+kind+'-volume').oninput=event=>window.AudioSettings.set(kind,{volume:Number(event.target.value)/100},{gesture:true});}
 settings.querySelector('#site-effects-preview').onclick=()=>{settings.querySelector('#site-audio-status').textContent='';window.AudioSettings.playEffect('confirm',{onError:()=>{settings.querySelector('#site-audio-status').textContent='無法播放音效，請再試一次。';}});};
 function close(){menu.hidden=true;button.setAttribute('aria-expanded','false');for(const item of header.querySelectorAll('details'))item.open=false;}
 button.onclick=()=>{const open=menu.hidden;close();closeSettings();menu.hidden=!open;button.setAttribute('aria-expanded',String(open));};
 window.UIPopover?.bind(button,menu,{align:'end',onClose:close});
 for(const details of header.querySelectorAll('details'))window.UIPopover?.bindDetails(details,details.querySelector('.site-submenu'));
 document.addEventListener('click',e=>{if(!header.contains(e.target)){close();closeSettings();}});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&(header.contains(document.activeElement)||!menu.hidden)){const target=document.activeElement.closest('details')?.querySelector(':scope > summary')||button;close();target.focus();}});
 header.addEventListener('focusout',e=>{if(e.relatedTarget&&!header.contains(e.relatedTarget)){close();closeSettings();}});
 function refreshAvatar(){header.querySelector('#site-avatar').src='/api/profile/avatar?v='+Date.now();}
 let identityRequest=0;
 async function refreshIdentity(){
  const request=++identityRequest;
  try{const response=await fetch('/api/auth/me');if(!response.ok)return;const me=await response.json();if(request!==identityRequest)return;
   button.title=me.displayName+'（'+me.username+'）';button.setAttribute('aria-label',me.displayName+' 的帳號選單');header.querySelector('#site-account-id').textContent=me.displayName;
   const profileLink=menu.querySelector('a[href="/settings"]');if(profileLink)profileLink.textContent='帳號與形象設定';
   if(me.role==='admin'&&!header.querySelector('#site-admin')){const link=document.createElement('a');link.id='site-admin';link.href='/admin';link.textContent='管理';menu.insertBefore(link,header.querySelector('#site-logout'));}
   account.hidden=false;header.querySelector('.site-links').hidden=false;refreshAvatar();
  }catch{}
 }
 window.addEventListener('profile-updated',refreshIdentity);window.addEventListener('focus',refreshIdentity);
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refreshIdentity();});refreshIdentity();
 header.querySelector('#site-logout').onclick=async()=>{
  const logout=header.querySelector('#site-logout');logout.disabled=true;
  try{const r=await fetch('/api/auth/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});if(!r.ok)throw Error('登出失敗，請再試一次');try{for(const key of Object.keys(localStorage))if(/^ah-(session|thunder|majority|gift|draw)(:|$)/.test(key))localStorage.removeItem(key);}catch{}location.href='/login';}
  catch(error){header.querySelector('#site-header-error').textContent=error.message;logout.disabled=false;}
 };
})();
