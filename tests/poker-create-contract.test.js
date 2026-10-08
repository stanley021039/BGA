const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
test('direct poker entry sends its game type when creating, while joins keep resolving the supplied code',async()=>{
 const source=fs.readFileSync(path.join(__dirname,'../public/app.js'),'utf8'),entry=source.slice(source.indexOf('async function enter(route)'),source.indexOf("$('#create').onclick"));assert.ok(entry.startsWith('async function enter(route)'));
 const requests=[],scope=vm.createContext({busy:false,session:null,$:selector=>({value:selector==='#nickname'?'帳號暱稱':'abcdef'}),api:async(route,data)=>{requests.push({route,data});return {code:'ABCDEF',type:'poker'};},localStorage:{setItem(){}},window:{history:{replaceState(){}}},location:{},toast:message=>{throw Error(message);},refresh(){}});
 vm.runInContext(entry,scope);await vm.runInContext('enter("create")',scope);assert.equal(requests[0].route,'create');assert.equal(requests[0].data.type,'poker');assert.equal(requests[0].data.name,'帳號暱稱');assert.equal(requests[0].data.code,undefined);
 await vm.runInContext('enter("join")',scope);assert.equal(requests[1].route,'join');assert.equal(requests[1].data.code,'ABCDEF');assert.equal(requests[1].data.type,undefined);
});
