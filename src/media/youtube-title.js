const {fallbackTitle}=require('./room');
const MAX_TITLE_CACHE=256,MAX_METADATA_BYTES=32768,TITLE_TIMEOUT_MS=2000;
function createYoutubeTitleResolver({enabled=true,fetcher=fetch}={}){
 const cache=new Map(),pending=new Map();let closed=false;
 async function resolve(videoId){
  const fallback=fallbackTitle(videoId);
  if(!/^[A-Za-z0-9_-]{11}$/.test(videoId)||!enabled||closed)return fallback;
  if(cache.has(videoId))return cache.get(videoId);
  if(pending.has(videoId))return pending.get(videoId).promise;
  if(pending.size>=32)return fallback;
  const controller=new AbortController();
  const promise=(async()=>{
   let timer;try{
    const work=(async()=>{
     const url=new URL('https://www.youtube.com/oembed');url.searchParams.set('url','https://www.youtube.com/watch?v='+videoId);url.searchParams.set('format','json');
     const response=await fetcher(url.href,{redirect:'error',signal:controller.signal,headers:{Accept:'application/json'}});
     if(!response.ok||!response.body||Number(response.headers.get('content-length')||0)>MAX_METADATA_BYTES)throw Error('metadata unavailable');
     const reader=response.body.getReader(),chunks=[];let size=0;
     try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>MAX_METADATA_BYTES)throw Error('metadata too large');chunks.push(Buffer.from(value));}}finally{reader.releaseLock();}
     const data=JSON.parse(Buffer.concat(chunks).toString('utf8'));
     if(typeof data.title!=='string')throw Error('metadata title missing');
     const title=[...data.title.replace(/[\u0000-\u001f\u007f]/g,' ').trim()].slice(0,120).join('');if(!title)throw Error('metadata title missing');return title;
    })();
    return await Promise.race([work,new Promise(resolve=>{timer=setTimeout(()=>{controller.abort();resolve(fallback);},TITLE_TIMEOUT_MS);})]);
   }catch{controller.abort();return fallback;}finally{clearTimeout(timer);}
  })();
  pending.set(videoId,{promise,controller});
  try{const title=await promise;if(!closed){cache.set(videoId,title);while(cache.size>MAX_TITLE_CACHE)cache.delete(cache.keys().next().value);}return title;}finally{pending.delete(videoId);}
 }
 return {resolve,clear(){closed=true;for(const entry of pending.values())entry.controller.abort();pending.clear();cache.clear();}};
}
module.exports={createYoutubeTitleResolver,MAX_TITLE_CACHE,MAX_METADATA_BYTES,TITLE_TIMEOUT_MS};
