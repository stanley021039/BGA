'use strict';
window.StudioEditor=(()=>{
 const WIDTH=512,HEIGHT=256,MAX_LAYERS=8,MAX_SOURCE_BYTES=12*1024*1024;
 const preset=['#202a32','#faf4df','#8b6043','#dca77c','#f6d6b8','#ad4f4e','#e88751','#f0c866','#557bb5','#69acc1','#567c5e','#94ba70','#7b5a9d','#c886ae','#738079','#b7bdb0'];
 const $=selector=>document.querySelector(selector);
 const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
 function normalizeHex(value){const hex=String(value||'').trim().toLowerCase();if(/^#[0-9a-f]{6}$/.test(hex))return hex;if(/^#[0-9a-f]{3}$/.test(hex))return '#'+[...hex.slice(1)].map(char=>char+char).join('');return null;}
 function hsvToHex({h,s,v}){
  const hue=((h%360)+360)%360,sector=hue/60,c=v*s,x=c*(1-Math.abs(sector%2-1)),m=v-c;
  const rgb=sector<1?[c,x,0]:sector<2?[x,c,0]:sector<3?[0,c,x]:sector<4?[0,x,c]:sector<5?[x,0,c]:[c,0,x];
  return '#'+rgb.map(value=>Math.round((value+m)*255).toString(16).padStart(2,'0')).join('');
 }
 function hexToHsv(hex){
  const [r,g,b]=[1,3,5].map(index=>parseInt(hex.slice(index,index+2),16)/255),max=Math.max(r,g,b),min=Math.min(r,g,b),delta=max-min;
  let h=0;if(delta){if(max===r)h=((g-b)/delta)%6;else if(max===g)h=(b-r)/delta+2;else h=(r-g)/delta+4;h=(h*60+360)%360;}
  return {h,s:max?delta/max:0,v:max};
 }
 function mount(){
  const canvas=$('#paint-canvas'),paint=canvas.getContext('2d',{willReadFrequently:true}),photoCanvas=$('#photo-canvas'),photos=photoCanvas.getContext('2d');
  const frame=$('#studio-canvas-frame'),sv=$('#paint-sv'),hexInput=$('#paint-hex'),brightness=$('#paint-brightness'),opacity=$('#paint-opacity'),size=$('#paint-size');
  let layers=[],history=[],future=[],drawing=false,lastPoint=null,shapeStart=null,shapeBase=null,keyboardShapeStart=null,cursor={x:WIDTH/2,y:HEIGHT/2},mode='brush',filled=false,fit='contain',layerId=0,bgTargetId=null;
  let selectedColor='#557bb5',hsv=hexToHsv(selectedColor),recent=[];
  try{const saved=JSON.parse(localStorage.getItem('ah-studio-recent-colors')||'[]');if(Array.isArray(saved))recent=[...new Set(saved.map(normalizeHex).filter(Boolean))].slice(0,10);}catch{}
  const status=message=>$('#paint-status').textContent=message;
  function renderSwatches(){
   for(const [selector,colors] of [['#paint-palette',preset],['#paint-recent',recent]]){
    const group=$(selector);group.replaceChildren();
    for(const color of colors){const button=document.createElement('button');button.type='button';button.className='paint-swatch';button.style.backgroundColor=color;button.setAttribute('aria-label',`選擇顏色 ${color}`);button.setAttribute('aria-pressed',String(selectedColor===color));button.title=color;button.onclick=()=>setColor(color,true);group.append(button);}
    if(!colors.length){const empty=document.createElement('span');empty.className='paint-recent-empty';empty.textContent='畫過或選過的顏色會出現在這裡';group.append(empty);}
   }
  }
  function rememberColor(color){const valid=normalizeHex(color);if(!valid)return;recent=[valid,...recent.filter(item=>item!==valid)].slice(0,10);try{localStorage.setItem('ah-studio-recent-colors',JSON.stringify(recent));}catch{}renderSwatches();}
  function renderColor(){
   selectedColor=hsvToHex(hsv);sv.style.setProperty('--wheel-darkness',String(1-hsv.v));
   const angle=hsv.h*Math.PI/180,radius=hsv.s*48;
   $('#paint-sv-marker').style.left=(50+Math.cos(angle)*radius)+'%';$('#paint-sv-marker').style.top=(50+Math.sin(angle)*radius)+'%';
   brightness.value=String(Math.round(hsv.v*100));$('#paint-brightness-value').textContent=brightness.value+'%';
   hexInput.value=selectedColor;$('#paint-native-color').value=selectedColor;$('#paint-current').style.backgroundColor=selectedColor;
   $('#paint-current').style.opacity=String(Number(opacity.value)/100);
   renderSwatches();
  }
  function setColor(value,used=false){const valid=normalizeHex(value);if(!valid)return false;hsv=hexToHsv(valid);renderColor();if(used)rememberColor(valid);return true;}
  const isShape=()=>['line','rect','ellipse'].includes(mode);
  function setMode(next){mode=next;if(next!=='removeBg')bgTargetId=null;keyboardShapeStart=null;for(const [id,name] of [['paint-brush','brush'],['paint-line','line'],['paint-rect','rect'],['paint-ellipse','ellipse'],['paint-pick','pick'],['paint-erase','erase']]){const button=$('#'+id),active=name===mode;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));}$('#paint-shape-fill').disabled=!['rect','ellipse'].includes(mode);canvas.style.cursor=['pick','removeBg'].includes(mode)?'copy':mode==='erase'?'cell':'crosshair';}
  function capture(){return {pixels:paint.getImageData(0,0,WIDTH,HEIGHT),layers:layers.map(layer=>({...layer}))};}
  function updateHistoryButtons(){$('#paint-undo').disabled=!history.length;$('#paint-redo').disabled=!future.length;}
  function remember(){history.push(capture());if(history.length>20)history.shift();future=[];updateHistoryButtons();}
  function restore(snapshot){paint.putImageData(snapshot.pixels,0,0);layers=snapshot.layers;renderPhotos();renderLayers();updateHistoryButtons();}
  function renderPhotos(){photos.clearRect(0,0,WIDTH,HEIGHT);for(const layer of layers)if(layer.visible){photos.globalAlpha=layer.opacity;photos.drawImage(layer.canvas,0,0);}photos.globalAlpha=1;}
  function renderLayers(){
   const list=$('#photo-layers');list.replaceChildren();$('#photo-layer-count').textContent=`${layers.length} / ${MAX_LAYERS}`;
   if(!layers.length){const empty=document.createElement('p');empty.className='studio-layer-empty';empty.textContent='尚未加入照片；畫布目前只有透明背景與筆跡。';list.append(empty);return;}
   for(let index=layers.length-1;index>=0;index--){
    const layer=layers[index],row=document.createElement('div'),heading=document.createElement('div'),thumb=document.createElement('img'),name=document.createElement('strong'),order=document.createElement('span'),controls=document.createElement('div');
    row.className='studio-layer'+(layer.visible?'':' is-hidden');heading.className='studio-layer-title';thumb.className='studio-layer-thumb';thumb.src=layer.preview;thumb.alt='';name.textContent=layer.name;order.textContent=`照片 ${index+1}`;heading.append(thumb,name,order);controls.className='studio-layer-actions';
    const action=(label,description,handler,disabled=false)=>{const button=document.createElement('button');button.type='button';button.textContent=label;button.setAttribute('aria-label',description+'：'+layer.name);button.disabled=disabled;button.onclick=handler;controls.append(button);};
    action(layer.visible?'隱藏':'顯示',layer.visible?'隱藏圖層':'顯示圖層',()=>{remember();layer.visible=!layer.visible;renderPhotos();renderLayers();});
    action('上移','上移圖層',()=>moveLayer(index,1),index===layers.length-1);
    action('下移','下移圖層',()=>moveLayer(index,-1),index===0);
    action('自動去背','從邊角辨識並移除純色背景',()=>removeBackground(layer,'auto'));
    action('點選去背','點選畫布上的背景顏色',()=>{bgTargetId=layer.id;setMode('removeBg');status(`請在畫布上點選「${layer.name}」要去除的背景顏色。`);canvas.focus();});
    action('還原背景','還原原始照片背景',()=>{remember();layer.canvas=layer.originalCanvas;layer.preview=layer.originalPreview;layer.backgroundRemoved=false;renderPhotos();renderLayers();},!layer.backgroundRemoved);
    action('移除','移除圖層',()=>{remember();layers.splice(index,1);renderPhotos();renderLayers();});
    const opacityLabel=document.createElement('label'),slider=document.createElement('input'),value=document.createElement('output');opacityLabel.textContent='圖層透明度 ';slider.type='range';slider.min='0';slider.max='100';slider.value=String(Math.round(layer.opacity*100));slider.setAttribute('aria-label','圖層透明度：'+layer.name);value.textContent=slider.value+'%';
    slider.addEventListener('pointerdown',remember);slider.addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key))remember();});
    slider.oninput=()=>{layer.opacity=Number(slider.value)/100;value.textContent=slider.value+'%';renderPhotos();};opacityLabel.append(slider,value);
    row.append(heading,opacityLabel,controls);list.append(row);
   }
  }
  function moveLayer(index,delta){remember();[layers[index],layers[index+delta]]=[layers[index+delta],layers[index]];renderPhotos();renderLayers();}
  function removeBackground(layer,points){
   const source=layer.canvas.getContext('2d').getImageData(0,0,WIDTH,HEIGHT),pixels=source.data,tolerance=Number($('#bg-tolerance').value)*4.42,at=(x,y)=>(y*WIDTH+x)*4;
   const distance=(a,b)=>Math.hypot(pixels[a]-pixels[b],pixels[a+1]-pixels[b+1],pixels[a+2]-pixels[b+2]);
   if(points==='auto'){
    let left=WIDTH,top=HEIGHT,right=-1,bottom=-1;
    for(let y=0;y<HEIGHT;y++)for(let x=0;x<WIDTH;x++)if(pixels[at(x,y)+3]){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
    if(right<0){status('這張照片沒有可去除的背景。');return;}
    const candidates=[[left,top],[right,top],[left,bottom],[right,bottom]].filter(([x,y])=>pixels[at(x,y)+3]>0);
    const group=candidates.map(seed=>candidates.filter(point=>distance(at(...seed),at(...point))<=Math.max(16,tolerance/2))).sort((a,b)=>b.length-a.length)[0]||[];
    if(group.length<2){status('邊角沒有一致的純色背景；請用「點選去背」指定背景位置。');return;}
    points=group.map(([x,y])=>({x,y}));
   }
   const output=layer.canvas.getContext('2d').getImageData(0,0,WIDTH,HEIGHT),result=output.data;
   let removed=0;
   for(const point of points){
    const seed=point.y*WIDTH+point.x,reference=seed*4;if(!pixels[reference+3])continue;
    const visited=new Uint8Array(WIDTH*HEIGHT),queue=new Int32Array(WIDTH*HEIGHT);let head=0,tail=0;queue[tail++]=seed;visited[seed]=1;
    while(head<tail){
     const index=queue[head++],offset=index*4;if(!pixels[offset+3]||distance(offset,reference)>tolerance)continue;
     if(result[offset+3]){result[offset+3]=0;removed++;}
     const x=index%WIDTH,y=Math.floor(index/WIDTH);
     for(const neighbor of [x>0?index-1:-1,x<WIDTH-1?index+1:-1,y>0?index-WIDTH:-1,y<HEIGHT-1?index+WIDTH:-1])if(neighbor>=0&&!visited[neighbor]){visited[neighbor]=1;queue[tail++]=neighbor;}
    }
   }
   if(!removed){status('沒有找到相近的連續背景；可提高容差或改點另一個位置。');return;}
   const cutout=document.createElement('canvas');cutout.width=WIDTH;cutout.height=HEIGHT;cutout.getContext('2d').putImageData(output,0,0);
   remember();layer.canvas=cutout;layer.preview=cutout.toDataURL('image/png');layer.backgroundRemoved=true;renderPhotos();renderLayers();status(`已移除約 ${removed.toLocaleString()} 個背景像素；不滿意可按「復原」或「還原背景」。`);
  }
  function paintPoint(x,y){
   const width=Number(size.value),left=clamp(Math.floor(x-(width-1)/2),0,WIDTH-width),top=clamp(Math.floor(y-(width-1)/2),0,HEIGHT-width);
   if(mode==='erase'){paint.clearRect(left,top,width,width);return;}
   const rgb=[1,3,5].map(index=>parseInt(selectedColor.slice(index,index+2),16));paint.fillStyle=`rgba(${rgb.join(',')},${Number(opacity.value)/100})`;paint.fillRect(left,top,width,width);
  }
  function paintLine(from,to){const steps=Math.max(Math.abs(to.x-from.x),Math.abs(to.y-from.y),1);for(let i=0;i<=steps;i++)paintPoint(Math.round(from.x+(to.x-from.x)*i/steps),Math.round(from.y+(to.y-from.y)*i/steps));}
  function drawShape(from,to){
   const rgb=[1,3,5].map(index=>parseInt(selectedColor.slice(index,index+2),16)),color=`rgba(${rgb.join(',')},${Number(opacity.value)/100})`;
   const left=Math.min(from.x,to.x),top=Math.min(from.y,to.y),width=Math.abs(to.x-from.x)+1,height=Math.abs(to.y-from.y)+1;
   paint.save();paint.strokeStyle=color;paint.fillStyle=color;paint.lineWidth=Number(size.value);paint.lineCap='round';paint.lineJoin='round';
   if(mode==='line'){paint.beginPath();paint.moveTo(from.x+.5,from.y+.5);paint.lineTo(to.x+.5,to.y+.5);paint.stroke();}
   else if(mode==='rect'){if(filled)paint.fillRect(left,top,width,height);else paint.strokeRect(left+.5,top+.5,Math.max(0,width-1),Math.max(0,height-1));}
   else if(mode==='ellipse'){paint.beginPath();paint.ellipse(left+width/2,top+height/2,Math.max(.5,width/2),Math.max(.5,height/2),0,0,Math.PI*2);filled?paint.fill():paint.stroke();}
   paint.restore();
  }
  function pointFrom(event){const box=canvas.getBoundingClientRect();return {x:clamp(Math.floor((event.clientX-box.left)*WIDTH/box.width),0,WIDTH-1),y:clamp(Math.floor((event.clientY-box.top)*HEIGHT/box.height),0,HEIGHT-1)};}
  function flatten(){const output=document.createElement('canvas');output.width=WIDTH;output.height=HEIGHT;const context=output.getContext('2d',{willReadFrequently:true});context.drawImage(photoCanvas,0,0);context.drawImage(canvas,0,0);return output;}
  function pickColor(point){const pixels=flatten().getContext('2d').getImageData(point.x,point.y,1,1).data;if(!pixels[3]){status('該位置是透明的，請點選有顏色的地方。');return;}const picked='#'+[...pixels].slice(0,3).map(value=>value.toString(16).padStart(2,'0')).join('');setColor(picked,true);opacity.value=String(Math.round(pixels[3]/255*100));$('#paint-opacity-value').textContent=opacity.value+'%';renderColor();setMode('brush');status(`已從畫布取色 ${picked}。`);}
  function endStroke(event){if(!drawing)return;if(isShape()){paint.putImageData(shapeBase,0,0);drawShape(shapeStart,pointFrom(event));rememberColor(selectedColor);}drawing=false;lastPoint=null;shapeStart=null;shapeBase=null;}
  canvas.addEventListener('pointerdown',event=>{if(event.button!==0)return;event.preventDefault();const point=pointFrom(event);cursor=point;if(mode==='pick'){pickColor(point);return;}if(mode==='removeBg'){const layer=layers.find(item=>item.id===bgTargetId);if(layer)removeBackground(layer,[point]);setMode('brush');return;}canvas.setPointerCapture(event.pointerId);remember();drawing=true;lastPoint=point;if(isShape()){shapeStart=point;shapeBase=history.at(-1).pixels;drawShape(point,point);}else{paintPoint(point.x,point.y);if(mode==='brush')rememberColor(selectedColor);}});
  canvas.addEventListener('pointermove',event=>{if(!drawing)return;const point=pointFrom(event);if(isShape()){paint.putImageData(shapeBase,0,0);drawShape(shapeStart,point);}else paintLine(lastPoint,point);lastPoint=point;cursor=point;});
  canvas.addEventListener('pointerup',endStroke);canvas.addEventListener('pointercancel',()=>{if(shapeBase){paint.putImageData(shapeBase,0,0);history.pop();updateHistoryButtons();}drawing=false;lastPoint=null;shapeStart=null;shapeBase=null;});
  canvas.addEventListener('keydown',event=>{const moves={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};if(moves[event.key]){event.preventDefault();cursor.x=clamp(cursor.x+moves[event.key][0],0,WIDTH-1);cursor.y=clamp(cursor.y+moves[event.key][1],0,HEIGHT-1);status(`畫布位置 ${cursor.x+1}, ${cursor.y+1}；按空白鍵${mode==='pick'?'取色':mode==='removeBg'?'取背景色':isShape()?'設定形狀端點':'繪製'}。`);}if(event.key===' '){event.preventDefault();if(mode==='pick')pickColor(cursor);else if(mode==='removeBg'){const layer=layers.find(item=>item.id===bgTargetId);if(layer)removeBackground(layer,[cursor]);setMode('brush');}else if(isShape()){if(!keyboardShapeStart){keyboardShapeStart={...cursor};status('形狀起點已設定；移動方向鍵後再按空白鍵完成。');}else{remember();drawShape(keyboardShapeStart,cursor);rememberColor(selectedColor);keyboardShapeStart=null;}}else{remember();paintPoint(cursor.x,cursor.y);if(mode==='brush')rememberColor(selectedColor);}}});
  $('#paint-brush').onclick=()=>setMode('brush');$('#paint-line').onclick=()=>setMode('line');$('#paint-rect').onclick=()=>setMode('rect');$('#paint-ellipse').onclick=()=>setMode('ellipse');$('#paint-pick').onclick=()=>setMode('pick');$('#paint-wheel-pick').onclick=()=>setMode('pick');$('#paint-erase').onclick=()=>setMode('erase');
  $('#paint-shape-fill').onclick=()=>{filled=!filled;$('#paint-shape-fill').classList.toggle('active',filled);$('#paint-shape-fill').setAttribute('aria-pressed',String(filled));};
  $('#paint-undo').onclick=()=>{const previous=history.pop();if(!previous)return;future.push(capture());restore(previous);status('已復原上一個繪畫或圖層操作。');};
  $('#paint-redo').onclick=()=>{const next=future.pop();if(!next)return;history.push(capture());restore(next);status('已重做上一個操作。');};
  document.addEventListener('keydown',event=>{if(!(event.ctrlKey||event.metaKey)||event.target.closest?.('input,textarea,[contenteditable]'))return;const key=event.key.toLowerCase();if(key==='z'){event.preventDefault();(event.shiftKey?$('#paint-redo'):$('#paint-undo')).click();}else if(key==='y'){event.preventDefault();$('#paint-redo').click();}});
  $('#paint-clear').onclick=()=>{remember();paint.clearRect(0,0,WIDTH,HEIGHT);status('已清空筆跡，照片圖層仍保留。');};
  $('#paint-reset').onclick=()=>{remember();paint.clearRect(0,0,WIDTH,HEIGHT);layers=[];renderPhotos();renderLayers();status('已清空畫布與照片圖層。');};
  $('#paint-download').onclick=()=>{flatten().toBlob(blob=>{if(!blob){status('無法產生 PNG。');return;}const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='afterhours-art-512x256.png';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);},'image/png');};
  function updateSv(event){const box=sv.getBoundingClientRect(),x=event.clientX-box.left-box.width/2,y=event.clientY-box.top-box.height/2;hsv.s=clamp(Math.hypot(x,y)/(Math.min(box.width,box.height)/2),0,1);if(hsv.s>.015)hsv.h=(Math.atan2(y,x)*180/Math.PI+360)%360;renderColor();}
  let pickingSv=false;sv.addEventListener('pointerdown',event=>{event.preventDefault();sv.setPointerCapture(event.pointerId);pickingSv=true;updateSv(event);});sv.addEventListener('pointermove',event=>{if(pickingSv)updateSv(event);});sv.addEventListener('pointerup',()=>{if(pickingSv)rememberColor(selectedColor);pickingSv=false;});sv.addEventListener('pointercancel',()=>{pickingSv=false;});
  sv.addEventListener('keydown',event=>{const hueStep=event.shiftKey ? 15 : 5,saturationStep=event.shiftKey ? .1 : .02;if(event.key==='ArrowLeft')hsv.h=(hsv.h-hueStep+360)%360;else if(event.key==='ArrowRight')hsv.h=(hsv.h+hueStep)%360;else if(event.key==='ArrowUp')hsv.s=clamp(hsv.s+saturationStep,0,1);else if(event.key==='ArrowDown')hsv.s=clamp(hsv.s-saturationStep,0,1);else return;event.preventDefault();renderColor();rememberColor(selectedColor);});
  brightness.oninput=()=>{hsv.v=Number(brightness.value)/100;renderColor();};brightness.onchange=()=>rememberColor(selectedColor);
  size.oninput=()=>{$('#paint-size-value').textContent=size.value+' 像素';};
  opacity.oninput=()=>{$('#paint-opacity-value').textContent=opacity.value+'%';$('#paint-current').style.opacity=String(Number(opacity.value)/100);};
  $('#paint-zoom').oninput=event=>{$('.studio-canvas-stack').style.width=event.target.value+'%';$('#paint-zoom-value').textContent=event.target.value+'%';};
  $('#bg-tolerance').oninput=event=>{$('#bg-tolerance-value').textContent=event.target.value+'%';};
  hexInput.oninput=()=>{if(/^#[0-9a-f]{6}$/i.test(hexInput.value))setColor(hexInput.value);};
  hexInput.onchange=()=>{if(!setColor(hexInput.value,true))status('色號請輸入 #RGB 或 #RRGGBB。');renderColor();};
  $('#paint-native-color').oninput=event=>setColor(event.target.value);$('#paint-native-color').onchange=()=>rememberColor(selectedColor);
  document.querySelectorAll('[data-photo-fit]').forEach(button=>button.onclick=()=>{fit=button.dataset.photoFit;document.querySelectorAll('[data-photo-fit]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));});
  async function importFiles(files){
   const errors=[];let added=0;
   for(const file of files){
    if(layers.length>=MAX_LAYERS){errors.push('照片圖層最多 8 張');break;}
    if(file.size>MAX_SOURCE_BYTES){errors.push(`${file.name} 超過 12 MB`);continue;}
    if(file.type&&!['image/jpeg','image/png','image/webp','image/gif'].includes(file.type)){errors.push(`${file.name} 不是支援的圖片格式`);continue;}
    let bitmap;
    try{
     bitmap=await createImageBitmap(file);if(!bitmap.width||!bitmap.height)throw Error('無法讀取圖片尺寸');
     const layerCanvas=document.createElement('canvas');layerCanvas.width=WIDTH;layerCanvas.height=HEIGHT;
     const ratio=fit==='cover'?Math.max(WIDTH/bitmap.width,HEIGHT/bitmap.height):Math.min(WIDTH/bitmap.width,HEIGHT/bitmap.height),drawWidth=bitmap.width*ratio,drawHeight=bitmap.height*ratio;
     layerCanvas.getContext('2d').drawImage(bitmap,(WIDTH-drawWidth)/2,(HEIGHT-drawHeight)/2,drawWidth,drawHeight);
     const preview=layerCanvas.toDataURL('image/png');remember();layers.push({id:++layerId,name:file.name.slice(0,80),canvas:layerCanvas,originalCanvas:layerCanvas,preview,originalPreview:preview,backgroundRemoved:false,visible:true,opacity:1});added++;
    }catch(error){errors.push(`${file.name} 無法匯入：${error.message}`);}finally{bitmap?.close?.();}
   }
   renderPhotos();renderLayers();$('#photo-status').textContent=[added?`已加入 ${added} 張照片；可繼續畫圖與調整圖層。`:'',...errors].filter(Boolean).join(' ');
  }
  $('#photo-files').onchange=async event=>{const files=[...event.target.files];event.target.value='';await importFiles(files);};
  frame.addEventListener('dragover',event=>{if(event.dataTransfer?.types?.includes('Files')){event.preventDefault();frame.classList.add('dragging');}});
  frame.addEventListener('dragleave',()=>frame.classList.remove('dragging'));
  frame.addEventListener('drop',event=>{event.preventDefault();frame.classList.remove('dragging');if(event.dataTransfer?.files)importFiles([...event.dataTransfer.files]);});
  renderColor();renderLayers();setMode('brush');updateHistoryButtons();
  return {flatten,importFiles,dimensions:{width:WIDTH,height:HEIGHT}};
 }
 return {mount,colors:{normalizeHex,hsvToHex,hexToHsv}};
})();
