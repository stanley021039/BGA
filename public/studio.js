const $=selector=>document.querySelector(selector);
const canvas=$('#paint-canvas'),paint=canvas.getContext('2d',{willReadFrequently:true});
const snapshots=[];
let drawing=false,lastPoint=null,erasing=false,cursor={x:32,y:32};

async function json(url,options){const response=await fetch(url,options),value=await response.json();if(!response.ok)throw Error(value.error);return value;}
function remember(){snapshots.push(paint.getImageData(0,0,64,64));if(snapshots.length>20)snapshots.shift();$('#paint-undo').disabled=false;}
function paintPoint(x,y){
 const size=Number($('#paint-size').value),left=Math.max(0,Math.min(64-size,Math.floor(x-(size-1)/2))),top=Math.max(0,Math.min(64-size,Math.floor(y-(size-1)/2)));
 if(erasing)paint.clearRect(left,top,size,size);else{paint.fillStyle=$('#paint-color').value;paint.fillRect(left,top,size,size);}
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

function updateTarget(){
 const expression=$('#paint-target').value==='expression';
 $('#character-target-label').hidden=!expression;
 $('#paint-name-label').textContent=expression?'表情名稱（最多 20 字）':'角色名稱（最多 32 字）';
 $('#paint-name').maxLength=expression?20:32;
 $('#paint-name').placeholder=expression?'例如：開心大笑':'我的畫作';
}
$('#paint-target').onchange=updateTarget;
async function init(){
 const options=await json('/api/profile/options');
 const own=options.characters.filter(character=>character.owned);
 const target=$('#paint-character');
 for(const character of own){const option=document.createElement('option');option.value=character.id;option.textContent=character.name;target.append(option);}
 if(!own.length)$('#paint-target option[value="expression"]').disabled=true;
 const requested=new URLSearchParams(location.search).get('character');
 if(own.some(character=>character.id===requested)){target.value=requested;$('#paint-target').value='expression';}
 updateTarget();
}
$('#paint-save').onclick=async()=>{
 const button=$('#paint-save'),target=$('#paint-target').value,name=$('#paint-name').value.trim(),message=$('#paint-status');
 if(!name){message.textContent='請填入作品名稱。';return;}
 const pixels=paint.getImageData(0,0,64,64).data;
 if(!pixels.some((value,index)=>index%4===3&&value>0)){message.textContent='先在畫布上畫一些內容。';return;}
 const id=$('#paint-character').value;
 if(target==='expression'&&!/^user:[a-f0-9-]{36}$/.test(id)){message.textContent='請先選擇自己的角色。';return;}
 button.disabled=true;message.textContent='正在儲存畫作…';
 try{
  const data={name,mime:'image/png',base64:canvas.toDataURL('image/png').split(',')[1]};
  const route=target==='character'?'/api/profile/characters':`/api/profile/characters/${id.slice(5)}/emotes`;
  const result=await json(route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
  const characterId=target==='character'?result.id:id;
  const params=new URLSearchParams({character:characterId});
  if(target==='expression')params.set('expression',result.expression);
  $('#back-to-profile').href='/profile?'+params;
  $('#back-to-profile').focus();
  message.textContent=target==='character'?'畫作已建立。回角色頁保存外觀，並可選擇分享給好友。':'表情已加入角色。回角色頁可預覽並保存為預設表情。';
 }catch(error){message.textContent=error.message;}finally{button.disabled=false;}
};
init().catch(error=>$('#paint-status').textContent=error.message);
