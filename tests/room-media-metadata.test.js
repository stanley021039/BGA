const {test}=require('node:test'),assert=require('node:assert/strict');
const {createYoutubeTitleResolver,MAX_TITLE_CACHE,MAX_METADATA_BYTES,TITLE_TIMEOUT_MS}=require('../src/media/youtube-title');
const VIDEO='M7lc1UVf-VE';
test('YouTube metadata uses only a fixed ID-derived endpoint, refuses redirects and caches one sanitized title',async()=>{
 const calls=[],resolver=createYoutubeTitleResolver({fetcher:async(url,options)=>{calls.push({url,options});return new Response(JSON.stringify({title:'  Real\nvideo\tname '+ '🎬'.repeat(150)}));}});
 const title=await resolver.resolve(VIDEO);assert.ok(title.startsWith('Real video name '));assert.equal([...title].length,120);
 const url=new URL(calls[0].url);assert.equal(url.origin,'https://www.youtube.com');assert.equal(url.pathname,'/oembed');assert.equal(url.searchParams.get('url'),'https://www.youtube.com/watch?v='+VIDEO);assert.equal(url.searchParams.get('format'),'json');assert.equal(calls[0].options.redirect,'error');
 assert.equal(await resolver.resolve(VIDEO),title);assert.equal(calls.length,1);
 await resolver.resolve('https://evil.test');assert.equal(calls.length,1);resolver.clear();await resolver.resolve(VIDEO);assert.equal(calls.length,1);
});
test('simultaneous requests for a video share one metadata operation',async()=>{
 let done,calls=0;const response=new Promise(resolve=>{done=resolve;}),resolver=createYoutubeTitleResolver({fetcher(){calls++;return response;}});
 const first=resolver.resolve(VIDEO),second=resolver.resolve(VIDEO);assert.equal(calls,1);done(new Response(JSON.stringify({title:'Same title'})));assert.equal(await first,'Same title');assert.equal(await second,'Same title');assert.equal(calls,1);resolver.clear();
});
test('disabled external side effects perform no fetch and safely retain a display name',async()=>{
 let calls=0;const resolver=createYoutubeTitleResolver({enabled:false,fetcher(){calls++;throw Error('should not fetch');}});
 assert.match(await resolver.resolve(VIDEO),/YouTube/);assert.equal(calls,0);resolver.clear();
});
test('failed, redirected, empty, non-JSON and oversized metadata falls back and failures are cached',async()=>{
 const responses=[()=>{throw Error('network');},()=>new Response('',{status:302}),()=>new Response('{}'),()=>new Response('not json'),()=>new Response(JSON.stringify({title:''})),()=>new Response('x'.repeat(MAX_METADATA_BYTES+1)),()=>new Response('small',{headers:{'Content-Length':String(MAX_METADATA_BYTES+1)}})];
 for(const response of responses){let calls=0;const resolver=createYoutubeTitleResolver({fetcher:async()=>{calls++;return response();}});const title=await resolver.resolve(VIDEO);assert.match(title,/YouTube/);assert.equal(await resolver.resolve(VIDEO),title);assert.equal(calls,1);resolver.clear();}
});
test('a stuck fetch has a two-second deadline and is aborted without requiring the fetcher to cooperate',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});let signal;
 const resolver=createYoutubeTitleResolver({fetcher:(_url,options)=>{signal=options.signal;return new Promise(()=>{});}}),pending=resolver.resolve(VIDEO);
 t.mock.timers.tick(TITLE_TIMEOUT_MS);assert.match(await pending,/YouTube/);assert.equal(signal.aborted,true);resolver.clear();
});
test('the title cache evicts old entries and in-flight work has a separate fixed bound',async()=>{
 let calls=0;const resolver=createYoutubeTitleResolver({fetcher:async()=>{calls++;return new Response(JSON.stringify({title:'bounded'}));}});
 for(let n=0;n<=MAX_TITLE_CACHE;n++)await resolver.resolve(String(n).padStart(11,'0'));
 const before=calls;await resolver.resolve('00000000000');assert.equal(calls,before+1);resolver.clear();
 const pending=[],signals=[];let release;
 const body=new Promise(resolve=>{release=resolve;}),limited=createYoutubeTitleResolver({fetcher:(_url,options)=>{signals.push(options.signal);return body;}});
 for(let n=0;n<32;n++)pending.push(limited.resolve(String(n).padStart(11,'0')));
 assert.match(await limited.resolve('00000000032'),/YouTube/);assert.equal(signals.length,32);limited.clear();assert.ok(signals.every(signal=>signal.aborted));
 release(new Response(JSON.stringify({title:'resolved after clear'})));await Promise.all(pending);
});
