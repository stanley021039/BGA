const $=selector=>document.querySelector(selector);
let appearance,characters=[],labels={};
const uploads=new Map();
async function json(url,options){const response=await fetch(url,options),value=await response.json();if(!response.ok)throw Error(value.error);return value;}
function status(form,message){form.querySelector('.upload-status').textContent=message;}
function bindUpload(formId,inputId){
 const form=$(formId),input=$(inputId),drop=form.querySelector('.upload-drop');
 input.addEventListener('change',()=>{uploads.set(inputId,input.files[0]);status(form,input.files[0]?`已選取：${input.files[0].name}`:'尚未選取圖片');});
 drop.addEventListener('dragover',event=>{event.preventDefault();event.dataTransfer.dropEffect='copy';drop.classList.add('dragging');});
 drop.addEventListener('dragleave',()=>drop.classList.remove('dragging'));
 drop.addEventListener('drop',event=>{
  event.preventDefault();drop.classList.remove('dragging');
  const file=event.dataTransfer.files[0];
  if(!file)return;
  input.value='';uploads.set(inputId,file);status(form,`已拖入：${file.name}`);
 });
}
function selected(){return characters.find(character=>character.id===appearance.characterId)||characters[0];}
function render(){
 const character=selected();
 if(!character)return;
 if(!character.expressions[appearance.expression])appearance.expression='neutral';
 $('#preview').src=character.expressions[appearance.expression];
 $('#preview').alt=character.name+'－'+labels[appearance.expression];
 $('#characters').replaceChildren();
 for(const item of characters){
  const button=document.createElement('button'),img=document.createElement('img'),name=document.createElement('span');
  button.type='button';button.className='preset-card';button.setAttribute('aria-pressed',String(item.id===character.id));
  button.classList.toggle('active',item.id===character.id);button.setAttribute('aria-label','選擇'+item.name);
  img.src=item.expressions.neutral;img.alt='';name.textContent=item.name;button.append(img,name);
  button.onclick=()=>{appearance={version:5,characterId:item.id,expression:'neutral'};$('#message').textContent='已選擇角色，按「保存角色」才會套用。';render();};
  $('#characters').append(button);
 }
 $('#expressions').replaceChildren();
 for(const [expression,url] of Object.entries(character.expressions)){
  const button=document.createElement('button'),img=document.createElement('img'),name=document.createElement('span');
  button.type='button';button.className='expression-card';button.setAttribute('aria-pressed',String(expression===appearance.expression));
  button.classList.toggle('active',expression===appearance.expression);button.setAttribute('aria-label','顯示'+labels[expression]+'表情');
  img.src=url;img.alt='';name.textContent=labels[expression];button.append(img,name);
  button.onclick=()=>{appearance.expression=expression;$('#message').textContent='已選擇表情，按「保存角色」才會套用。';render();};
  $('#expressions').append(button);
 }
 $('#upload-expression').hidden=!character.id.startsWith('user:');
}
async function imagePayload(file,form){
 if(!file||file.size>1024*1024)throw Error('請選擇不超過 1 MB 的圖片');
 if(file.type&&!['image/png','image/gif','image/webp'].includes(file.type))throw Error('僅接受 PNG、GIF 或 WebP 圖片');
 status(form,'正在讀取圖片…');
 const base64=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(Error('讀取圖片失敗'));reader.readAsDataURL(file);});
 return {base64,mime:file.type};
}
async function init(){
 const [me,options]=await Promise.all([json('/api/auth/me'),json('/api/profile/options')]);
 appearance=me.appearance||options.defaults;characters=options.characters;labels=options.expressionLabels;
 for(const [expression,label] of Object.entries(labels)){
  const option=document.createElement('option');option.value=expression;option.textContent=label;$('#expression-name').append(option);
 }
 render();
}
$('#save').onclick=async()=>{const button=$('#save');button.disabled=true;try{const result=await json('/api/profile/appearance',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(appearance)});appearance=result.appearance;$('#message').textContent='角色已保存，遊戲座位會更新。';}catch(error){$('#message').textContent=error.message;}finally{button.disabled=false;}};
bindUpload('#create-character','#character-file');
bindUpload('#upload-expression','#expression-file');
$('#create-character').onsubmit=async event=>{event.preventDefault();const form=event.currentTarget,button=form.querySelector('button');button.disabled=true;try{
 const image=await imagePayload(uploads.get('#character-file')||$('#character-file').files[0],form);
 status(form,'正在上傳角色…');
 const result=await json('/api/profile/characters',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:$('#character-name').value,...image})});
 const options=await json('/api/profile/options');characters=options.characters;appearance={version:5,characterId:result.id,expression:'neutral'};
 form.reset();uploads.delete('#character-file');status(form,'角色已上傳');$('#message').textContent='角色已上傳。可以繼續加入表情，保存後會顯示在遊戲座位。';render();
 }catch(error){status(form,error.message);}finally{button.disabled=false;}};
$('#upload-expression').onsubmit=async event=>{event.preventDefault();const form=event.currentTarget,button=form.querySelector('button');button.disabled=true;try{
 const id=selected().id.slice(5),expression=$('#expression-name').value,image=await imagePayload(uploads.get('#expression-file')||$('#expression-file').files[0],form);
 status(form,'正在上傳表情…');
 await json(`/api/profile/characters/${id}/expressions`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({expression,...image})});
 const options=await json('/api/profile/options');characters=options.characters;appearance.expression=expression;
 form.reset();uploads.delete('#expression-file');status(form,'表情已上傳');$('#message').textContent='表情已上傳，按「保存角色」才會套用到遊戲座位。';render();
 }catch(error){status(form,error.message);}finally{button.disabled=false;}};
init().catch(error=>$('#message').textContent=error.message);
