'use strict';
const $=selector=>document.querySelector(selector);
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
async function load(){
 const response=await fetch('/api/draw/words'),data=await response.json();if(!response.ok)throw Error(data.error||'載入失敗');
 $('#wordCount').textContent=data.builtin.length+' 個內建題目 · '+data.custom.length+' 個好友投稿';
 $('#wordList').innerHTML=data.custom.length?data.custom.map(word=>`<article><strong>${esc(word.title)}</strong><span>${esc(word.category)} · ${esc(word.authorName)}${word.aliases.length?' · 別名：'+esc(word.aliases.join('、')):''}</span></article>`).join(''):'<p>還沒有好友投稿。第一題由你開始！</p>';
}
$('#wordForm').onsubmit=async event=>{
 event.preventDefault();const form=event.target,button=form.querySelector('button'),aliases=form.elements.aliases.value.split(/[，,]/u).map(value=>value.trim()).filter(Boolean);
 button.disabled=true;
 try{const response=await fetch('/api/draw/words',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:form.elements.title.value,aliases,difficulty:form.elements.difficulty.value})});
  const result=await response.json();if(!response.ok)throw Error(result.error||'投稿失敗');form.reset();$('#wordStatus').textContent='已加入「'+result.title+'」';await load();
 }catch(error){$('#wordStatus').textContent=error.message;}finally{button.disabled=false;}
};
load().catch(error=>$('#wordStatus').textContent=error.message);
