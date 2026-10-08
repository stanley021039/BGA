(()=>{
 const KEY='ah-barrage-frame-settings',VERSION=1;
 const options=Object.freeze([{id:'default',label:'預設'},{id:'paper',label:'紙張'},{id:'comic',label:'漫畫'},{id:'pixel',label:'像素'}].map(Object.freeze));
 const ids=new Set(options.map(item=>item.id)),listeners=new Set();
 function normalize(value){return {version:VERSION,enabled:typeof value?.enabled==='boolean'?value.enabled:true,selected:ids.has(value?.selected)?value.selected:'default'};}
 function read(){try{return normalize(JSON.parse(localStorage.getItem(KEY)||'null'));}catch{return normalize(null);}}
 let prefs=read(),dialog=null,choices=[];
 function get(){return {...prefs};}
 function notify(){document.body?.classList.toggle('barrage-frames-disabled',!prefs.enabled);for(const listener of listeners)listener(get());}
 function set(patch){prefs=normalize({...prefs,...patch});try{localStorage.setItem(KEY,JSON.stringify(prefs));}catch{}notify();return get();}
 function subscribe(listener){listeners.add(listener);listener(get());return ()=>listeners.delete(listener);}
 window.addEventListener('storage',event=>{if(event.key===KEY||event.key===null){prefs=read();notify();}});
 function descriptorId(value){return value?.kind==='builtin'&&value.version===1&&ids.has(value.id)?value.id:'default';}
 function decorate(node,frame,name,message){
  node.dataset.frameId=descriptorId(frame);
  const backdrop=document.createElement('span'),decoration=document.createElement('span'),content=document.createElement('span'),sender=document.createElement('strong');
  backdrop.className='barrage-frame-backdrop';decoration.className='barrage-frame-decoration';content.className='barrage-frame-content';
  backdrop.setAttribute('aria-hidden','true');decoration.setAttribute('aria-hidden','true');sender.textContent=name+'：';content.append(sender,document.createTextNode(message));node.append(backdrop,decoration,content);return node;
 }
 // Reserve the measured vertical interval once. No queue and no layout work per
 // animation frame; a larger bubble uses as much space as it actually needs.
 function findPlacement(layerHeight,bubbleHeight,occupied=[]){
  if(!Number.isFinite(layerHeight)||!Number.isFinite(bubbleHeight)||bubbleHeight<=0)return null;
  const margin=12,gap=8,limit=layerHeight-margin-bubbleHeight;
  if(limit<margin)return null;
  const spans=occupied.filter(span=>Number.isFinite(span.top)&&Number.isFinite(span.height)&&span.height>0).sort((a,b)=>a.top-b.top);
  let top=margin;
  for(const span of spans){if(top+bubbleHeight+gap<=span.top)break;if(top<span.top+span.height+gap)top=span.top+span.height+gap;}
  return top<=limit?top:null;
 }
 function place(layer,bubble){
  bubble.style.visibility='hidden';layer.append(bubble);
  const occupied=[...layer.children].filter(node=>node!==bubble).map(node=>({top:parseFloat(node.style.top),height:node.offsetHeight}));
  const top=findPlacement(layer.clientHeight,bubble.offsetHeight,occupied);
  if(top===null){bubble.remove();return false;}
  bubble.style.top=top+'px';bubble.style.visibility='';return true;
 }
 function createPicker(){
  dialog=document.createElement('dialog');dialog.id='barrage-frame-picker';dialog.className='barrage-frame-dialog';dialog.setAttribute('aria-labelledby','barrage-frame-title');
  const header=document.createElement('div'),title=document.createElement('h2'),close=document.createElement('button'),body=document.createElement('div'),grid=document.createElement('div');
  header.className='barrage-frame-header';title.id='barrage-frame-title';title.textContent='選擇彈幕框';close.type='button';close.textContent='關閉';window.GameUI?.decorateButton(close,'close',{iconOnly:true,label:'關閉彈幕框選擇'});close.onclick=()=>dialog.close();header.append(title,close);
  body.className='barrage-frame-body';grid.className='barrage-frame-grid';grid.setAttribute('role','group');grid.setAttribute('aria-label','內建彈幕框');
  for(const option of options){
   const button=document.createElement('button'),label=document.createElement('span'),preview=document.createElement('span');button.type='button';button.className='barrage-frame-choice';button.dataset.frameId=option.id;button.setAttribute('aria-label',option.label+'彈幕框');label.textContent=option.label;preview.className='barrage-frame-preview';preview.setAttribute('aria-hidden','true');decorate(preview,{kind:'builtin',id:option.id,version:1},'小雨','這一桌好好玩！');button.append(label,preview);button.onclick=()=>set({selected:option.id});grid.append(button);choices.push(button);
  }
  body.append(grid);dialog.append(header,body);document.body.append(dialog);subscribe(value=>{for(const button of choices)button.setAttribute('aria-pressed',String(button.dataset.frameId===value.selected));});
 }
 function openPicker(trigger){if(!dialog)createPicker();if(window.GameUI)window.GameUI.openDialog(dialog,trigger);else dialog.showModal();choices.find(button=>button.dataset.frameId===prefs.selected)?.focus();}
 notify();window.BarrageFrames={get,set,subscribe,options,descriptorId,decorate,findPlacement,place,openPicker};
})();
