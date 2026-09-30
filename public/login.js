const $=selector=>document.querySelector(selector);
const params=new URLSearchParams(location.search);
const resetToken=params.get('reset');
const forms={login:$('#loginForm'),register:$('#registerForm'),reset:$('#resetForm')};
function mode(value){for(const [name,form] of Object.entries(forms))form.hidden=name!==value;for(const tab of document.querySelectorAll('[data-mode]'))tab.setAttribute('aria-selected',String(tab.dataset.mode===value));$('#message').textContent='';}
for(const tab of document.querySelectorAll('[data-mode]'))tab.onclick=()=>mode(tab.dataset.mode);
if(params.get('invite'))forms.register.elements.invite.value=params.get('invite');
mode(resetToken?'reset':params.get('invite')?'register':'login');
async function send(route,payload){const res=await fetch('/api/auth/'+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const data=await res.json();if(!res.ok)throw Error(data.error);return data;}
for(const [name,form] of Object.entries(forms))form.onsubmit=async event=>{event.preventDefault();const button=form.querySelector('button');button.disabled=true;try{const values=Object.fromEntries(new FormData(form));if(name==='reset')values.token=resetToken;await send(name,values);if(name==='reset'){history.replaceState(null,'','/login');mode('login');$('#message').textContent='密碼已更新，請重新登入。';}else location.replace('/');}catch(error){$('#message').textContent=error.message;}finally{button.disabled=false;}};
