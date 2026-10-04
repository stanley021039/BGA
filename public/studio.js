let artworks=[];
const $=selector=>document.querySelector(selector);
const editor=StudioEditor.mount();
const iconize=StudioEditor.iconize;
iconize($('#paint-save'),'save','儲存目前畫布');iconize($('#artwork-edit'),'photo','載入畫布編輯或去背');iconize($('#artwork-upload button[type=submit]'),'upload','直接加入我的圖庫');
async function json(url,options){const response=await fetch(url,options),value=await response.json();if(!response.ok)throw Error(value.error);return value;}
const toBlob=(canvas,mime,quality)=>new Promise(resolve=>canvas.toBlob(resolve,mime,quality));
const toBase64=blob=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(Error('無法讀取圖片'));reader.readAsDataURL(blob);});
async function encodeArtwork(canvas){let blob=await toBlob(canvas,'image/png');if(blob?.size>1024*1024){for(const quality of [.92,.8,.65]){blob=await toBlob(canvas,'image/webp',quality);if(blob&&blob.size<=1024*1024)break;}}if(!blob||blob.size>1024*1024)throw Error('畫作超過圖庫的 1 MB 限制，請減少照片細節或圖層。');return {mime:blob.type,base64:await toBase64(blob)};}

function renderArtworks(){
 const list=$('#artwork-list');list.replaceChildren();
 $('#artwork-count').textContent=`${artworks.length} 件作品`;
 $('#artwork-empty').hidden=artworks.length>0;
 for(const artwork of artworks){
  const card=document.createElement('article'),img=document.createElement('img'),name=document.createElement('strong'),actions=document.createElement('div');
  card.className='artwork-card';actions.className='artwork-actions';img.src=artwork.url;img.alt='';img.loading='lazy';name.textContent=artwork.name;
  const use=(label,href,icon)=>{const link=document.createElement('a');link.href=href;iconize(link,icon,label);actions.append(link);};
  use('用作角色／表情','/profile?artwork='+encodeURIComponent(artwork.id),'person');
  use('用作禮物','/gifts?artwork='+encodeURIComponent(artwork.id),'gift');
  const edit=document.createElement('button');edit.type='button';iconize(edit,'photo','載入畫布作圖層');edit.onclick=async()=>{edit.disabled=true;try{const response=await fetch(artwork.url);if(!response.ok)throw Error('無法讀取圖庫作品');const blob=await response.blob();await editor.importFiles([new File([blob],artwork.name+'.'+artwork.mime.split('/')[1],{type:artwork.mime})]);document.querySelector('.studio-board').scrollIntoView({behavior:'smooth'});}catch(error){$('#paint-status').textContent=error.message;}finally{edit.disabled=false;}};actions.append(edit);
  const remove=document.createElement('button');remove.type='button';iconize(remove,'reset','刪除圖庫作品');remove.onclick=async()=>{
   if(!confirm(`要從我的圖庫刪除「${artwork.name}」嗎？已用於角色或禮物的圖片會保留。`))return;
   remove.disabled=true;
   try{await json(`/api/artworks/${artwork.id}/delete`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});await loadArtworks();$('#paint-status').textContent='作品已從圖庫刪除。';}catch(error){remove.disabled=false;$('#paint-status').textContent=error.message;}
  };actions.append(remove);card.append(img,name,actions);list.append(card);
 }
}
async function loadArtworks(){const data=await json('/api/artworks');artworks=data.artworks;renderArtworks();}
$('#paint-save').onclick=async()=>{
 const button=$('#paint-save'),name=$('#paint-name').value.trim(),message=$('#paint-status');
 if(!name){message.textContent='請填入作品名稱。';return;}
 const output=editor.flatten(),pixels=output.getContext('2d',{willReadFrequently:true}).getImageData(0,0,output.width,output.height).data;
 if(!pixels.some((value,index)=>index%4===3&&value>0)){message.textContent='先在畫布上畫圖或加入照片。';return;}
 button.disabled=true;message.textContent='正在儲存畫作…';
 try{
  const data={name,...await encodeArtwork(output)};
  await json('/api/artworks',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
  await loadArtworks();message.textContent='畫作已存入我的圖庫。可以在下方選擇用作角色或禮物。';
 }catch(error){message.textContent=error.message;}finally{button.disabled=false;}
};
$('#artwork-edit').onclick=async()=>{const file=$('#artwork-file').files[0],message=$('#upload-status');if(!file){message.textContent='請先選擇一張圖片。';return;}await editor.importFiles([file]);document.querySelector('.studio-board').scrollIntoView({behavior:'smooth'});};
$('#artwork-upload').onsubmit=async event=>{
 event.preventDefault();const form=event.currentTarget,button=form.querySelector('button[type=submit]'),file=$('#artwork-file').files[0],message=$('#upload-status');
 if(!file||file.size>1024*1024){message.textContent='請選擇不超過 1 MB 的圖片。';return;}
 if(file.type&&!['image/png','image/gif','image/webp'].includes(file.type)){message.textContent='僅接受 PNG、GIF 或 WebP 圖片。';return;}
 button.disabled=true;message.textContent='正在上傳…';
 try{
  const base64=await toBase64(file);
  await json('/api/artworks',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:$('#artwork-name').value,mime:file.type,base64})});
  form.reset();await loadArtworks();message.textContent='圖片已存入我的圖庫。';
 }catch(error){message.textContent=error.message;}finally{button.disabled=false;}
};
const studioQuery=new URLSearchParams(location.search),returnLink=$('#collection-return');
if(returnLink)returnLink.href='/collection?section='+(studioQuery.get('section')==='characters'?'characters':'avatars');
loadArtworks().then(async()=>{const artwork=artworks.find(a=>a.id===studioQuery.get('artwork'));if(!artwork)return;const response=await fetch(artwork.url);if(!response.ok)throw Error('無法讀取收藏圖片');const blob=await response.blob();await editor.importFiles([new File([blob],artwork.name,{type:artwork.mime})]);$('#paint-name').value=artwork.name;$('#paint-status').textContent='已載入收藏圖片，儲存會建立新的圖片，保留原圖。';}).catch(error=>$('#paint-status').textContent=error.message);
