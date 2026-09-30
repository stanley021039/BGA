const $=selector=>document.querySelector(selector);
const params=new URLSearchParams(location.search);
const resetToken=params.get('reset');
const forms={login:$('#loginForm'),register:$('#registerForm'),reset:$('#resetForm')};
function mode(value){
 for(const [name,form] of Object.entries(forms))form.hidden=name!==value;
 for(const tab of document.querySelectorAll('[data-mode]'))tab.setAttribute('aria-selected',String(tab.dataset.mode===value));
 $('.auth-tabs').hidden=value==='reset';
 const copy={login:['歡迎回來','登入帳號，今晚繼續開桌。'],register:['加入這一桌','有邀請碼嗎？建立帳號就能和朋友一起玩。'],reset:['設定新密碼','為你的帳號換一把新鑰匙。']};
 $('#authTitle').textContent=copy[value][0];$('#authIntro').textContent=copy[value][1];
 $('#message').textContent='';
}
for(const tab of document.querySelectorAll('[data-mode]'))tab.onclick=()=>mode(tab.dataset.mode);
if(params.get('invite'))forms.register.elements.invite.value=params.get('invite');
mode(resetToken?'reset':params.get('invite')?'register':'login');
async function send(route,payload){const res=await fetch('/api/auth/'+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const data=await res.json();if(!res.ok)throw Error(data.error);return data;}
for(const [name,form] of Object.entries(forms))form.onsubmit=async event=>{event.preventDefault();const button=form.querySelector('button');button.disabled=true;try{const values=Object.fromEntries(new FormData(form));if(name==='reset')values.token=resetToken;await send(name,values);if(name==='reset'){history.replaceState(null,'','/login');mode('login');$('#message').textContent='密碼已更新，請重新登入。';}else location.replace('/');}catch(error){$('#message').textContent=error.message;}finally{button.disabled=false;}};
