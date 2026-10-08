const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=name=>fs.readFileSync(path.join(__dirname,'../public',name),'utf8');
test('poker empty slots are hidden without changing the occupied seat indices',()=>{
 const source=read('app.js'),start=source.indexOf('const me=s.players.find'),end=source.indexOf("}).join(''));",start)+"}).join(''));".length;
 assert.ok(start>=0&&end>start);
 for(const [count,positions] of [[1,[0]],[2,[0,3]],[3,[0,2,4]],[4,[0,2,3,5]],[5,[0,1,2,4,5]],[6,[0,1,2,3,4,5]]]){
  const players=Array.from({length:count},(_,i)=>({id:'p'+i,name:'玩家'+i,cards:[],stack:100,online:i!==1,folded:i===1}));let markup='';
  vm.runInNewContext(source.slice(start,end),{s:{players,me:'p0',phase:'playing',turn:0,button:0},$:()=>({}),GameShell:{stableMarkup(node,html){markup=html;}},esc:String,card:()=>''});
  const seats=[...markup.matchAll(/<div class="seat(?: [^"]*)?"([^>]*)>/g)];assert.equal(seats.length,6);
  assert.deepEqual(seats.flatMap((m,i)=>m[1].includes('hidden')?[]:[i]),positions);
  assert.ok(!markup.includes('空位'));for(const p of players)assert.ok(markup.includes(p.name));
  if(count>1){assert.ok(markup.includes('離線'));assert.ok(markup.includes('folded'));}
 }
});
test('race omits unoccupied crews but keeps eliminated and offline real players',()=>{
 const source=read('race.js'),start=source.indexOf('function crewCard('),end=source.indexOf('function heli(',start);assert.ok(start>=0&&end>start);
 const scope={window:{},esc:String,sizes:['輕型','中型','重型']};vm.createContext(scope);vm.runInContext(source.slice(start,end),scope);
 assert.equal(scope.crewCard({phase:'move'},null),'');assert.equal(scope.crewCard({phase:'waiting'},undefined),'');
 const p={id:'p1',name:'留下的玩家',out:true,online:false,dice:[],color:'#abc'};
 const markup=scope.crewCard({phase:'move',cars:[],me:'p2',actor:'p2'},p);
 assert.ok(markup.includes('留下的玩家'));assert.ok(markup.includes('已出局'));assert.ok(markup.includes('離線'));
});
