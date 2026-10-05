'use strict';
const $=selector=>document.querySelector(selector);
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
let words=[],limit=60;
function render(){
 const query=$('#wordSearch').value.normalize('NFKC').trim().toLocaleLowerCase('zh-Hant'),topic=$('#wordTopicFilter').value,source=$('#wordSourceFilter').value;
 const found=words.filter(word=>(!topic||word.topic===topic)&&(source==='all'||(source==='custom')===!!word.custom)&&[word.title,...word.aliases].some(value=>value.normalize('NFKC').toLocaleLowerCase('zh-Hant').includes(query)));
 $('#wordResultCount').textContent=found.length+' 題符合條件';$('#wordMore').hidden=found.length<=limit;
 $('#wordList').innerHTML=found.slice(0,limit).map(word=>`<article><strong>${esc(word.title)}</strong><span>${esc(word.topicLabel||'綜合')} · ${esc(word.category)} · ${esc(word.custom?word.authorName:word.memeKind==='original'?'本站原創梗圖情境':'內建')}${word.aliases.length?' · 別名：'+esc(word.aliases.join('、')):''}</span></article>`).join('')||'<p>沒有符合的題目。</p>';
}
async function load(){
 const response=await fetch('/api/draw/words'),data=await response.json();if(!response.ok)throw Error(data.error||'載入失敗');
 $('#wordCount').textContent=data.builtin.length+' 個內建題目 · '+data.custom.length+' 個好友投稿';
 words=[...data.custom,...data.builtin];
 const topic=$('#wordTopicFilter').value;$('#wordTopicFilter').innerHTML='<option value="">全部題材</option>'+[...data.topics,{id:'misc',label:'綜合'}].map(item=>`<option value="${esc(item.id)}">${esc(item.label)}</option>`).join('');$('#wordTopicFilter').value=topic;
 render();
}
for(const selector of ['#wordSearch','#wordTopicFilter','#wordSourceFilter'])$(selector).addEventListener(selector==='#wordSearch'?'input':'change',()=>{limit=60;render();});
$('#wordMore').onclick=()=>{limit+=60;render();};
$('#wordForm').onsubmit=async event=>{
 event.preventDefault();const form=event.target,button=form.querySelector('button'),aliases=form.elements.aliases.value.split(/[，,]/u).map(value=>value.trim()).filter(Boolean);
 button.disabled=true;
 try{const response=await fetch('/api/draw/words',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:form.elements.title.value,aliases,difficulty:form.elements.difficulty.value,topic:form.elements.topic.value})});
  const result=await response.json();if(!response.ok)throw Error(result.error||'投稿失敗');form.reset();$('#wordStatus').textContent='已加入「'+result.title+'」';await load();
 }catch(error){$('#wordStatus').textContent=error.message;}finally{button.disabled=false;}
};
load().catch(error=>$('#wordStatus').textContent=error.message);
