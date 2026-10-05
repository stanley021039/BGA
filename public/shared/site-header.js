(()=>{
 const header=document.querySelector('[data-site-header]');if(!header)return;
 const account=header.querySelector('.site-account'),button=header.querySelector('#site-account-button'),menu=header.querySelector('#site-account-menu');
 function close(){menu.hidden=true;button.setAttribute('aria-expanded','false');for(const item of header.querySelectorAll('details'))item.open=false;}
 button.onclick=()=>{const open=menu.hidden;close();menu.hidden=!open;button.setAttribute('aria-expanded',String(open));};
 window.UIPopover?.bind(button,menu,{align:'end',onClose:close});
 for(const details of header.querySelectorAll('details'))window.UIPopover?.bindDetails(details,details.querySelector('.site-submenu'));
 document.addEventListener('click',e=>{if(!header.contains(e.target))close();});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&(header.contains(document.activeElement)||!menu.hidden)){const target=document.activeElement.closest('details')?.querySelector(':scope > summary')||button;close();target.focus();}});
 header.addEventListener('focusout',e=>{if(e.relatedTarget&&!header.contains(e.relatedTarget))close();});
 function refreshAvatar(){header.querySelector('#site-avatar').src='/api/profile/avatar?v='+Date.now();}
 window.addEventListener('profile-updated',refreshAvatar);
 fetch('/api/auth/me').then(async r=>{if(!r.ok)return;const me=await r.json();button.title=me.username;button.setAttribute('aria-label',me.username+' 的帳號選單');header.querySelector('#site-account-id').textContent=me.username;if(me.role==='admin'){const link=document.createElement('a');link.id='site-admin';link.href='/admin';link.textContent='管理';menu.insertBefore(link,header.querySelector('#site-logout'));}account.hidden=false;header.querySelector('.site-links').hidden=false;refreshAvatar();}).catch(()=>{});
 header.querySelector('#site-logout').onclick=async()=>{
  const logout=header.querySelector('#site-logout');logout.disabled=true;
  try{const r=await fetch('/api/auth/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});if(!r.ok)throw Error('登出失敗，請再試一次');try{for(const key of Object.keys(localStorage))if(/^ah-(session|thunder|majority|gift|draw)(:|$)/.test(key))localStorage.removeItem(key);}catch{}location.href='/login';}
  catch(error){header.querySelector('#site-header-error').textContent=error.message;logout.disabled=false;}
 };
})();
