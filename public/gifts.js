'use strict';
const $=selector=>document.querySelector(selector);
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
let gifts=[],categories=[],limit=32,busy=false,previewUrl=null;

function toast(message){$('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').hidden=true,4500);}
async function api(data){
 const response=await fetch('/api/community/gifts',{method:data?'POST':'GET',headers:{'Content-Type':'application/json'},body:data?JSON.stringify(data):undefined});
 if(response.status===401){location.href='/login?next='+encodeURIComponent('/gifts');throw Error('請先登入');}
 const result=await response.json();if(!response.ok)throw Error(result.error||'題庫暫時無法使用');return result;
}
function render(){
 const query=$('#search').value.trim().toLocaleLowerCase(),category=$('#filter').value;
 const found=gifts.filter(gift=>(!category||gift.category===category)&&gift.title.toLocaleLowerCase().includes(query));
 $('#resultCount').textContent=`${found.length} 件禮物`;
 $('#more').hidden=found.length<=limit;
 $('#giftList').innerHTML=found.slice(0,limit).map(gift=>`<article class="library-gift"><div class="library-gift-art">${gift.image?`<img src="${esc(gift.image)}" alt="" loading="lazy">`:'<span aria-hidden="true">✦</span>'}</div><strong>${esc(gift.title)}</strong><small>${esc(gift.category)} · ${esc(gift.author||'Afterhours')}</small></article>`).join('')||'<p>沒有符合的禮物。</p>';
}
async function reload(){
 const data=await api();categories=data.categories;gifts=data.gifts.sort((a,b)=>Number(!!b.shared)-Number(!!a.shared)||String(b.at||'').localeCompare(String(a.at||'')));
 $('#giftCategory').innerHTML=categories.map(category=>`<option value="${esc(category)}">${esc(category)}</option>`).join('');
 const current=$('#filter').value;$('#filter').innerHTML='<option value="">全部分類</option>'+categories.map(category=>`<option value="${esc(category)}">${esc(category)}</option>`).join('');$('#filter').value=current;
 render();
}
function clearPreview(){if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl=null;$('#imagePreview').hidden=true;$('#previewArt').removeAttribute('src');}
$('#giftImage').onchange=()=>{clearPreview();const file=$('#giftImage').files[0];if(!file)return;if(file.size>1024*1024){$('#giftImage').value='';return toast('圖片不得超過 1 MB');}previewUrl=URL.createObjectURL(file);$('#previewArt').src=previewUrl;$('#imagePreview').hidden=false;};
$('#removeImage').onclick=()=>{$('#giftImage').value='';clearPreview();};
$('#search').oninput=$('#filter').onchange=()=>{limit=32;render();};
$('#more').onclick=()=>{limit+=32;render();};
function base64(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(Error('無法讀取圖片'));reader.readAsDataURL(file);});}
$('#giftForm').onsubmit=async event=>{
 event.preventDefault();if(busy)return;busy=true;$('#submitGift').disabled=true;
 try{
  const file=$('#giftImage').files[0];if(file&&file.size>1024*1024)throw Error('圖片不得超過 1 MB');
  const data={title:$('#giftTitle').value,category:$('#giftCategory').value,image:file?{mime:file.type,base64:await base64(file)}:null};
  await api(data);$('#giftForm').reset();clearPreview();limit=32;await reload();toast('禮物已加入共用題庫');
 }catch(error){toast(error.message);}finally{busy=false;$('#submitGift').disabled=false;}
};
reload().catch(error=>toast(error.message));
