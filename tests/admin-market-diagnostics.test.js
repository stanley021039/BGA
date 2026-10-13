const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
test('admin diagnostic refresh renders text safely, disables while pending and clears stale data on failure',async()=>{
 const elements=new Map(),get=id=>{if(!elements.has(id))elements.set(id,{textContent:'',innerHTML:'',disabled:false});return elements.get(id);};let resolveRequest,calls=0;
 const context={document:{querySelector:get},URL,FormData,fetch:async url=>{
  if(url==='/api/admin/market/diagnostics'){calls++;return new Promise(resolve=>{resolveRequest=resolve;});}
  return Response.json([]);
 }};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../public/admin.js'),'utf8'),context);
 const button=get('#refreshMarketDiagnostics'),request=button.onclick();assert.equal(button.disabled,true);assert.equal(calls,1);
 resolveRequest(Response.json({audit:[{detail:'<script>unsafe</script>'}]}));await request;assert.equal(button.disabled,false);assert.match(get('#marketDiagnostics').textContent,/<script>/);assert.equal(get('#marketDiagnostics').innerHTML,'');
 const retry=button.onclick();resolveRequest(Response.json({error:'只有管理員可以讀取'},{status:403}));await retry;assert.equal(get('#marketDiagnostics').textContent,'');assert.equal(button.disabled,false);assert.equal(get('#marketDiagnosticsStatus').textContent,'只有管理員可以讀取');
});
