const $=selector=>document.querySelector(selector);
const canvas=$('#paint-canvas'),paint=canvas.getContext('2d',{willReadFrequently:true});
const snapshots=[];
const palette=['#202a32','#faf4df','#8b6043','#dca77c','#f6d6b8','#ad4f4e','#e88751','#f0c866','#557bb5','#69acc1','#567c5e','#94ba70','#7b5a9d','#c886ae','#738079','#b7bdb0'];
let drawing=false,lastPoint=null,erasing=false,cursor={x:32,y:32},selectedColor='#557bb5';

async function json(url,options){const response=await fetch(url,options),value=await response.json();if(!response.ok)throw Error(value.error);return value;}
function showPalette(){
 const group=$('#paint-palette');group.replaceChildren();
 for(const color of palette){const button=document.createElement('button');button.type='button';button.className='paint-swatch';button.style.backgroundColor=color;button.setAttribute('aria-label',`選擇顏色 ${color}`);button.setAttribute('aria-pressed',String(selectedColor===color));button.onclick=()=>{selectedColor=color;$('#paint-custom-color').value=color;showPalette();};group.append(button);}
}
$('#paint-custom-color').oninput=event=>{selectedColor=event.target.value;showPalette();};
function setSlider(selector,output,unit){const input=$(selector);const update=()=>{$(output).textContent=input.value+unit;};input.addEventListener('input',update);update();}
setSlider('#paint-size','#paint-size-value',' 格');
setSlider('#paint-brightness','#paint-brightness-value','%');
setSlider('#paint-opacity','#paint-opacity-value','%');
showPalette();
function remember(){snapshots.push(paint.getImageData(0,0,64,64));if(snapshots.length>20)snapshots.shift();$('#paint-undo').disabled=false;}
function paintPoint(x,y){
 const size=Number($('#paint-size').value),left=Math.max(0,Math.min(64-size,Math.floor(x-(size-1)/2))),top=Math.max(0,Math.min(64-size,Math.floor(y-(size-1)/2)));
 if(erasing){paint.clearRect(left,top,size,size);return;}
 const brightness=Number($('#paint-brightness').value)/100,opacity=Number($('#paint-opacity').value)/100;
 const channels=[1,3,5].map(index=>parseInt(selectedColor.slice(index,index+2),16));
 const adjusted=channels.map(value=>Math.round(brightness<=1?value*brightness:value+(255-value)*(brightness-1)));
 paint.fillStyle=`rgba(${adjusted.join(',')},${opacity})`;paint.fillRect(left,top,size,size);
}
function paintLine(from,to){
 const steps=Math.max(Math.abs(to.x-from.x),Math.abs(to.y-from.y),1);
 for(let i=0;i<=steps;i++)paintPoint(Math.round(from.x+(to.x-from.x)*i/steps),Math.round(from.y+(to.y-from.y)*i/steps));
}
function canvasPoint(event){const box=canvas.getBoundingClientRect();return {x:Math.max(0,Math.min(63,Math.floor((event.clientX-box.left)*64/box.width))),y:Math.max(0,Math.min(63,Math.floor((event.clientY-box.top)*64/box.height)))};}
canvas.addEventListener('pointerdown',event=>{if(event.button!==0)return;event.preventDefault();canvas.setPointerCapture(event.pointerId);remember();drawing=true;lastPoint=canvasPoint(event);cursor=lastPoint;paintPoint(cursor.x,cursor.y);});
canvas.addEventListener('pointermove',event=>{if(!drawing)return;const point=canvasPoint(event);paintLine(lastPoint,point);lastPoint=point;cursor=point;});
function endStroke(){drawing=false;lastPoint=null;}
canvas.addEventListener('pointerup',endStroke);canvas.addEventListener('pointercancel',endStroke);
canvas.addEventListener('keydown',event=>{
 const moves={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
 if(moves[event.key]){event.preventDefault();cursor.x=Math.max(0,Math.min(63,cursor.x+moves[event.key][0]));cursor.y=Math.max(0,Math.min(63,cursor.y+moves[event.key][1]));$('#paint-status').textContent=`畫布位置 ${cursor.x+1}, ${cursor.y+1}；按空白鍵繪製。`;}
 if(event.key===' '){event.preventDefault();remember();paintPoint(cursor.x,cursor.y);}
});
$('#paint-undo').disabled=true;
$('#paint-undo').onclick=()=>{const previous=snapshots.pop();if(previous)paint.putImageData(previous,0,0);$('#paint-undo').disabled=!snapshots.length;};
$('#paint-clear').onclick=()=>{remember();paint.clearRect(0,0,64,64);$('#paint-status').textContent='畫布已清空。';};
$('#paint-erase').onclick=()=>{erasing=!erasing;$('#paint-erase').setAttribute('aria-pressed',String(erasing));$('#paint-erase').classList.toggle('active',erasing);};

let artworks=[];
function renderArtworks(){
 const list=$('#artwork-list');list.replaceChildren();
 $('#artwork-count').textContent=`${artworks.length} 件作品`;
 $('#artwork-empty').hidden=artworks.length>0;
 for(const artwork of artworks){
  const card=document.createElement('article'),img=document.createElement('img'),name=document.createElement('strong'),actions=document.createElement('div');
  card.className='artwork-card';img.src=artwork.url;img.alt='';img.loading='lazy';name.textContent=artwork.name;
  const use=(label,href)=>{const link=document.createElement('a');link.href=href;link.textContent=label;actions.append(link);};
  use('用作角色／表情','/profile?artwork='+encodeURIComponent(artwork.id));
  use('用作禮物','/gifts?artwork='+encodeURIComponent(artwork.id));
  const remove=document.createElement('button');remove.type='button';remove.textContent='刪除';remove.onclick=async()=>{
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
 const pixels=paint.getImageData(0,0,64,64).data;
 if(!pixels.some((value,index)=>index%4===3&&value>0)){message.textContent='先在畫布上畫一些內容。';return;}
 button.disabled=true;message.textContent='正在儲存畫作…';
 try{
  const data={name,mime:'image/png',base64:canvas.toDataURL('image/png').split(',')[1]};
  await json('/api/artworks',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
  await loadArtworks();message.textContent='畫作已存入我的圖庫。可以在下方選擇用作角色或禮物。';
 }catch(error){message.textContent=error.message;}finally{button.disabled=false;}
};
$('#artwork-upload').onsubmit=async event=>{
 event.preventDefault();const form=event.currentTarget,button=form.querySelector('button'),file=$('#artwork-file').files[0],message=$('#upload-status');
 if(!file||file.size>1024*1024){message.textContent='請選擇不超過 1 MB 的圖片。';return;}
 if(file.type&&!['image/png','image/gif','image/webp'].includes(file.type)){message.textContent='僅接受 PNG、GIF 或 WebP 圖片。';return;}
 button.disabled=true;message.textContent='正在上傳…';
 try{
  const base64=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(Error('無法讀取圖片'));reader.readAsDataURL(file);});
  await json('/api/artworks',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:$('#artwork-name').value,mime:file.type,base64})});
  form.reset();await loadArtworks();message.textContent='圖片已存入我的圖庫。';
 }catch(error){message.textContent=error.message;}finally{button.disabled=false;}
};
loadArtworks().catch(error=>$('#paint-status').textContent=error.message);
