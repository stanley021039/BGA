const $=selector=>document.querySelector(selector);
let appearance,characters=[],labels={},artworks=[],chosenCharacterArtwork=null,chosenExpressionArtwork=null;
const uploads=new Map();
async function json(url,options){const response=await fetch(url,options),value=await response.json();if(!response.ok)throw Error(value.error);return value;}
function status(form,message){form.querySelector('.upload-status').textContent=message;}
function clearArtworkFor(inputId){if(inputId==='#character-file')chosenCharacterArtwork=null;else chosenExpressionArtwork=null;renderArtworkPickers();}
function bindUpload(formId,inputId){
 const form=$(formId),input=$(inputId),drop=form.querySelector('.upload-drop');
 input.addEventListener('change',()=>{uploads.set(inputId,input.files[0]);if(input.files[0])clearArtworkFor(inputId);status(form,input.files[0]?`已選取：${input.files[0].name}`:'尚未選取圖片');});
 drop.addEventListener('dragover',event=>{event.preventDefault();event.dataTransfer.dropEffect='copy';drop.classList.add('dragging');});
 drop.addEventListener('dragleave',()=>drop.classList.remove('dragging'));
 drop.addEventListener('drop',event=>{
  event.preventDefault();drop.classList.remove('dragging');
  const file=event.dataTransfer.files[0];
  if(!file)return;
  input.value='';uploads.set(inputId,file);clearArtworkFor(inputId);status(form,`已拖入：${file.name}`);
 });
}
function selected(){return characters.find(character=>character.id===appearance.characterId)||characters[0];}
function expressionLabel(character,expression){return character.labels?.[expression]||labels[expression]||expression;}
function render(){
 const character=selected();
 if(!character)return;
 if(!character.expressions[appearance.expression])appearance.expression='neutral';
 $('#preview').src=character.expressions[appearance.expression];
 $('#preview').alt=character.name+'－'+expressionLabel(character,appearance.expression);
 for(const group of ['#builtin-characters','#my-characters','#shared-characters'])$(group).replaceChildren();
 $('#my-empty').hidden=characters.some(item=>item.owned);
 $('#shared-empty').hidden=characters.some(item=>item.id.startsWith('user:')&&!item.owned);
 for(const item of characters){
  const button=document.createElement('button'),img=document.createElement('img'),name=document.createElement('span');
  button.type='button';button.className='preset-card';button.setAttribute('aria-pressed',String(item.id===character.id));
  button.classList.toggle('active',item.id===character.id);button.setAttribute('aria-label','選擇'+item.name+'，'+item.source);
  img.src=item.expressions.neutral;img.alt='';name.textContent=item.name;button.append(img,name);
  if(item.id.startsWith('user:')){const source=document.createElement('small');source.textContent=item.owned?(item.shared?'已分享':'僅自己可選'):item.source;button.append(source);}
  button.onclick=()=>{appearance={version:5,characterId:item.id,expression:'neutral'};$('#message').textContent='已選擇角色，按「保存角色」才會套用。';render();};
  $(item.id.startsWith('builtin:')?'#builtin-characters':item.owned?'#my-characters':'#shared-characters').append(button);
 }
 $('#expressions').replaceChildren();
 for(const [expression,url] of Object.entries(character.expressions)){
  const button=document.createElement('button'),img=document.createElement('img'),name=document.createElement('span');
  button.type='button';button.className='expression-card';button.setAttribute('aria-pressed',String(expression===appearance.expression));
  button.classList.toggle('active',expression===appearance.expression);button.setAttribute('aria-label','顯示'+expressionLabel(character,expression)+'表情');
  img.src=url;img.alt='';name.textContent=expressionLabel(character,expression);button.append(img,name);
  button.onclick=()=>{appearance.expression=expression;$('#message').textContent='已選擇表情，按「保存角色」才會套用。';render();};
  $('#expressions').append(button);
 }
 $('#sharing-controls').hidden=!character.owned;
 $('#sharing-description').textContent=character.shared?'好友可在圖庫選用這位角色與表情。':'目前只有你可以選用這位角色。';
 $('#toggle-sharing').textContent=character.shared?'停止分享':'分享給會員';
 $('#upload-expression').hidden=!character.owned;
 $('#emote-target').textContent=character.owned?`正在為「${character.name}」新增表情（最多 6 個）。`:'先從「我的作品」選擇自己的角色。';
}
function renderArtworkPickers(){
 for(const [mode,target] of [['character','#character-artworks'],['expression','#expression-artworks']]){
  const box=$(target);box.replaceChildren();
  if(!artworks.length){const empty=document.createElement('p');empty.textContent='圖庫目前沒有作品。';box.append(empty);continue;}
  const chosen=mode==='character'?chosenCharacterArtwork:chosenExpressionArtwork;
  for(const artwork of artworks){
   const button=document.createElement('button'),img=document.createElement('img'),name=document.createElement('span');
   button.type='button';button.className='artwork-choice';button.setAttribute('aria-pressed',String(chosen===artwork.id));button.setAttribute('aria-label','使用圖庫作品 '+artwork.name);
   img.src=artwork.url;img.alt='';name.textContent=artwork.name;button.append(img,name);
   button.onclick=()=>{
    const next=chosen===artwork.id?null:artwork.id;
    if(mode==='character'){chosenCharacterArtwork=next;$('#character-file').value='';uploads.delete('#character-file');}
    else{chosenExpressionArtwork=next;$('#expression-file').value='';uploads.delete('#expression-file');}
    renderArtworkPickers();
   };box.append(button);
  }
 }
}
async function refreshGallery(){const options=await json('/api/profile/options');characters=options.characters;render();}
async function imagePayload(file,form){
 if(!file||file.size>1024*1024)throw Error('請選擇不超過 1 MB 的圖片');
 if(file.type&&!['image/png','image/gif','image/webp'].includes(file.type))throw Error('僅接受 PNG、GIF 或 WebP 圖片');
 status(form,'正在讀取圖片…');
 const base64=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(Error('讀取圖片失敗'));reader.readAsDataURL(file);});
 return {base64,mime:file.type};
}
async function selectedImagePayload(artworkId,file,form){return artworkId?{artworkId}:imagePayload(file,form);}
async function init(){
 const [me,options,library]=await Promise.all([json('/api/auth/me'),json('/api/profile/options'),json('/api/artworks')]);
 appearance=me.appearance||options.defaults;characters=options.characters;labels=options.expressionLabels;artworks=library.artworks;
 if(!characters.some(item=>item.id===appearance.characterId))appearance=options.defaults;
 const query=new URLSearchParams(location.search),requested=characters.find(item=>item.id===query.get('character'));
 if(requested)appearance={version:5,characterId:requested.id,expression:requested.expressions[query.get('expression')]?query.get('expression'):'neutral'};
 const art=artworks.find(item=>item.id===query.get('artwork'));
 if(art){chosenCharacterArtwork=art.id;chosenExpressionArtwork=art.id;$('.artist-templates').open=true;$('#message').textContent=`已選擇圖庫作品「${art.name}」。可建立主角色，或選擇自己的角色新增表情。`;}
 render();renderArtworkPickers();
}
$('#save').onclick=async()=>{const button=$('#save');button.disabled=true;try{const result=await json('/api/profile/appearance',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(appearance)});appearance=result.appearance;$('#message').textContent='角色已保存，遊戲座位會更新。';}catch(error){$('#message').textContent=error.message;}finally{button.disabled=false;}};
$('#toggle-sharing').onclick=async()=>{const character=selected(),button=$('#toggle-sharing');if(!character.owned)return;button.disabled=true;try{await json(`/api/profile/characters/${character.id.slice(5)}/sharing`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({shared:!character.shared})});await refreshGallery();$('#message').textContent=character.shared?'已停止分享；選用這位角色的好友會恢復預設角色。':'已分享到好友圖庫。';}catch(error){$('#message').textContent=error.message;}finally{button.disabled=false;}};
bindUpload('#create-character','#character-file');
bindUpload('#upload-expression','#expression-file');
$('#create-character').onsubmit=async event=>{event.preventDefault();const form=event.currentTarget,button=form.querySelector('button');button.disabled=true;try{
 const image=await selectedImagePayload(chosenCharacterArtwork,uploads.get('#character-file')||$('#character-file').files[0],form);
 status(form,'正在上傳角色…');
 const result=await json('/api/profile/characters',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:$('#character-name').value,...image})});
 appearance={version:5,characterId:result.id,expression:'neutral'};await refreshGallery();
 form.reset();uploads.delete('#character-file');chosenCharacterArtwork=null;renderArtworkPickers();status(form,'主角色已建立');$('#message').textContent='主角色已建立。可繼續新增表情；按「保存角色」後會顯示在遊戲座位。';render();
 }catch(error){status(form,error.message);}finally{button.disabled=false;}};
$('#upload-expression').onsubmit=async event=>{event.preventDefault();const form=event.currentTarget,button=form.querySelector('button');button.disabled=true;try{
 const id=selected().id.slice(5),name=$('#expression-name').value.trim(),image=await selectedImagePayload(chosenExpressionArtwork,uploads.get('#expression-file')||$('#expression-file').files[0],form);
 status(form,'正在上傳表情…');
 const result=await json(`/api/profile/characters/${id}/emotes`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,...image})});
 appearance.expression=result.expression;await refreshGallery();
 form.reset();uploads.delete('#expression-file');chosenExpressionArtwork=null;renderArtworkPickers();status(form,'表情圖片已新增');$('#message').textContent='表情已新增到角色。若要將它設為預設外觀，再按「保存角色」。';render();
 }catch(error){status(form,error.message);}finally{button.disabled=false;}};
init().catch(error=>$('#message').textContent=error.message);
