const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
async function harness(rooms,failed=false){
 const store=new Map([['ah-gift',JSON.stringify({code:'ABC123'})],['ah-gift:ABC123',JSON.stringify({code:'ABC123'})]]),nodes=new Map();
 const node=()=>({children:[],style:{},classList:{toggle(){}},append(...items){this.children.push(...items);},replaceChildren(...items){this.children=items;},setAttribute(){}});
 const element=id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);};
 let current=rooms,fail=failed;
 const location={origin:'http://localhost',search:'',href:'http://localhost/'};
 const context=vm.createContext({document:{querySelector:element,querySelectorAll:()=>[],createElement:node,visibilityState:'visible'},localStorage:{getItem:key=>store.get(key)||null,setItem:(key,value)=>store.set(key,value),removeItem:key=>store.delete(key)},location,URLSearchParams,setInterval(){},setTimeout(){},navigator:{},fetch:async route=>({ok:route!=='/api/rooms'||!fail,json:async()=>route==='/api/rooms'?{rooms:current}:route==='/api/auth/me'?{displayName:'tester'}:{addresses:[]}})});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../public/hub.js'),'utf8'),context);
 await new Promise(resolve=>setImmediate(resolve));
 return {store,element,context,location,setRooms(value){current=value;},setFailed(value){fail=value;}};
}
test('return link is shown only for a live seat and rechecks before navigation',async()=>{
 const live={code:'ABC123',type:'gift',seated:true,joinable:true,playerCount:1,maxPlayers:8,phase:'waiting',name:'Gift room'};
 const ui=await harness([live]);assert.equal(ui.element('#resume').children.length,1);
 const link=ui.element('#resume').children[0];ui.setRooms([]);
 await link.onclick({button:0,preventDefault(){}});
 assert.equal(ui.location.href,'http://localhost/');assert.equal(ui.element('#resume').children.length,0);
 assert.equal(ui.store.has('ah-gift'),false);assert.equal(ui.store.has('ah-gift:ABC123'),false);
 assert.match(ui.element('#toast').textContent,/房間已結束/);
});
test('missing seats clear stale links but a temporary directory failure preserves the saved seat',async()=>{
 const missing=await harness([{code:'ABC123',type:'gift',seated:false}]);assert.equal(missing.element('#resume').children.length,0);assert.equal(missing.store.has('ah-gift'),false);
 const offline=await harness([],true);assert.equal(offline.element('#resume').children.length,0);assert.equal(offline.store.has('ah-gift'),true);
});
