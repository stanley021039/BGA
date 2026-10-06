/* Confirmed expression events use the common personal effects preference. */
(()=>{
 const sampleRate=24000,maxFrames=sampleRate*10,maxInputBytes=10*1024*1024;
 function encodePCM(buffer){
  const frames=buffer?.length,rate=buffer?.sampleRate,channels=buffer?.numberOfChannels;
  if(!Number.isInteger(frames)||frames<1||rate!==sampleRate||!Number.isInteger(channels)||channels<1||channels>32)throw Error('無法轉換這個音檔，請改用其他音訊格式');
  if(frames>maxFrames)throw Error('音效不可超過 10 秒，請先縮短音檔');
  const bytes=new Uint8Array(44+frames*2),view=new DataView(bytes.buffer),ascii=(offset,value)=>{for(let i=0;i<value.length;i++)view.setUint8(offset+i,value.charCodeAt(i));};
  ascii(0,'RIFF');view.setUint32(4,bytes.length-8,true);ascii(8,'WAVE');ascii(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,sampleRate,true);view.setUint32(28,sampleRate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);ascii(36,'data');view.setUint32(40,frames*2,true);
  const samples=Array.from({length:channels},(_,index)=>buffer.getChannelData(index));
  for(let frame=0;frame<frames;frame++){
   let sample=0;for(const channel of samples){if(channel.length!==frames||!Number.isFinite(channel[frame]))throw Error('音檔資料無法讀取，請改用其他音檔');sample+=channel[frame]/channels;}
   sample=Math.max(-1,Math.min(1,sample));view.setInt16(44+frame*2,Math.round(sample*(sample<0?32768:32767)),true);
  }
  return bytes;
 }
 async function encodeFile(file){
  if(!file||!Number.isInteger(file.size)||file.size<1||file.size>maxInputBytes)throw Error('請選擇不超過 10 MB 的音檔');
  const OfflineContext=window.OfflineAudioContext||window.webkitOfflineAudioContext;if(!OfflineContext)throw Error('這個瀏覽器無法匯入音檔，請使用支援音訊解碼的瀏覽器');
  let decoded;
  try{const input=await file.arrayBuffer();if(input.byteLength<1||input.byteLength>maxInputBytes)throw Error('input-size');decoded=await new OfflineContext(1,1,sampleRate).decodeAudioData(input);}catch{throw Error('無法讀取音檔，請改用瀏覽器支援的 MP3、WAV、OGG 或 M4A 音檔');}
  const bytes=encodePCM(decoded);let binary='';for(let start=0;start<bytes.length;start+=8192)binary+=String.fromCharCode(...bytes.subarray(start,start+8192));
  return {base64:btoa(binary),durationMs:Math.ceil(decoded.length/sampleRate*1000)};
 }
 function create(){
  const seen=new Set(),clips=new Set();let context=null,baseline=true,lastUpdate=null,disposed=false;
  function stop(){for(const clip of clips)window.AudioSettings?.stopEffect(clip);clips.clear();}
  function reset(){stop();seen.clear();context=null;baseline=true;lastUpdate=null;}
  function remember(id){seen.add(id);while(seen.size>256)seen.delete(seen.values().next().value);}
  function update({contextId,events=[]}={}){
   if(disposed)return;
   const now=Date.now();if(typeof contextId!=='string'||!contextId){reset();return;}
   if(context!==contextId){reset();context=contextId;}
   const suppress=baseline||document.hidden||lastUpdate===null||now-lastUpdate>5000;
   if(suppress)stop();baseline=document.hidden;lastUpdate=now;
   const current=Array.isArray(events)?events:[];
   for(const event of current.slice(-256)){
    if(!event||!['string','number'].includes(typeof event.id)||String(event.id).length>200||!Number.isFinite(event.at))continue;
    const id=String(event.id);if(seen.has(id))continue;remember(id);
    if(suppress||now-event.at>5000||event.at>now+1000)continue;
    const clip=window.AudioSettings?.playExpression(event.sound,{onStop:ended=>clips.delete(ended)});if(clip)clips.add(clip);
   }
  }
  const hidden=()=>{if(document.hidden){stop();baseline=true;}};
  const pagehide=()=>{stop();baseline=true;lastUpdate=null;};
  document.addEventListener('visibilitychange',hidden);window.addEventListener('pagehide',pagehide);
  function destroy(){if(disposed)return;reset();disposed=true;document.removeEventListener('visibilitychange',hidden);window.removeEventListener('pagehide',pagehide);}
  return {update,reset,stop,destroy};
 }
 window.ExpressionSounds={create,mount:create,encodePCM,encodeFile};
})();
