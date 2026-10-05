const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {fixture}=require('./helpers/motion');

function setup(options){
 const h=fixture(options),nodes=new Map(),animations=[],barrages=[];
 const barrageController=h.policy.createBarrageController((item,lane)=>{barrages.push({item,lane});return()=>{};});
 function node(){const classes=new Set();return{hidden:false,textContent:'',innerHTML:'',dataset:{},style:{},classList:{toggle(name,value){value?classes.add(name):classes.delete(name);},add:name=>classes.add(name),remove:name=>classes.delete(name)},setAttribute(){},addEventListener(){},querySelectorAll:()=>[],contains:()=>false,closest:()=>null,animate(keyframes,settings){const effect={keyframes,settings,cancelled:false,cancel(){this.cancelled=true;}};animations.push(effect);return effect;}};}
 h.document.body=node();h.document.activeElement=null;h.document.querySelector=selector=>{if(!nodes.has(selector))nodes.set(selector,node());return nodes.get(selector);};
 h.document.querySelectorAll=selector=>selector==='.delivery-gift'?Array.from({length:(h.document.querySelector('#stage').innerHTML.match(/class="delivery-gift"/g)||[]).length},node):[];
 Object.assign(h.context,{location:{pathname:'',origin:'http://localhost',search:''},history:{replaceState(){}},URLSearchParams,setInterval(){},fetch:()=>new Promise(()=>{}),RoomHost:{update:state=>barrageController.update(state)},GameShell:{stableMarkup:(el,html)=>{el.innerHTML=html;},playerRow:()=>'<div><small>在線</small></div>',settingsActions:()=>''}});
 h.window.AudioSettings={playEffect(){},stopEffects(){}};
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../public/gift.js'),'utf8'),h.context);
 return{...h,animations,nodes,barrages,receive(state){h.context.nextState=state;return vm.runInContext('receive(nextState)',h.context);},poll(state){h.context.RoomApi={request:async()=>state};return vm.runInContext("session={code:'ABCDEF'};poll()",h.context);},disconnect(){vm.runInContext('disconnected=true',h.context);},reconnect(){vm.runInContext('disconnected=false',h.context);}};
}
const players=['A','B','C'].map(id=>({id,name:id,online:true,giveScore:0,getScore:0})),gifts=Array.from({length:4},(_,i)=>({id:'G'+i,title:'禮物'+i,category:'日常'}));
function delivery(version,recipient='A',overrides={}){return{type:'gift',code:'ABCDEF',version,phase:'delivering',round:1,target:8,players,me:'A',host:true,hostId:'A',gifts,ownAssignments:{},delivery:{recipientId:recipient,index:players.findIndex(p=>p.id===recipient),total:3,entries:players.filter(p=>p.id!==recipient).map((p,i)=>({giverId:p.id,recipientId:recipient,giftId:gifts[i].id,rank:'great',points:3}))},...overrides};}

test('gift delivery hydration is static; a new recipient animates once, and same-recipient rebuilds do not replay',()=>{
 const h=setup();h.receive(delivery(1));assert.equal(h.animations.length,0);assert.match(h.nodes.get('#stage').innerHTML,/大家一起送禮物給 A/);
 h.receive(delivery(2,'B'));assert.equal(h.animations.length,2);assert.equal(h.animations[0].settings.duration,700);
 h.receive(delivery(3,'B'));assert.equal(h.animations.length,2,'poll/social update must not replay');
 h.receive(delivery(4,'B',{target:12}));assert.equal(h.animations.length,2,'a settings-driven stage rebuild must remain static');assert(h.animations.every(a=>a.cancelled));
 h.receive(delivery(5,'C'));assert.equal(h.animations.length,4);assert.match(h.nodes.get('#stage').innerHTML,/大家一起送禮物給 C/);
});

test('gift hidden return and reconnect establish static baselines; future recipients still animate',()=>{
 const h=setup();h.receive(delivery(1));h.hide(true);h.receive(delivery(2,'B'));h.hide(false);h.receive(delivery(3,'C'));assert.equal(h.animations.length,0);
 h.receive(delivery(4,'A',{round:2}));assert.equal(h.animations.length,2);h.disconnect();h.receive(delivery(5,'B',{round:2}));h.reconnect();assert.equal(h.animations.length,2);h.receive(delivery(6,'C',{round:2}));assert.equal(h.animations.length,4);
 h.receive(delivery(5,'B',{round:2}));assert.equal(h.animations.length,4,'late ACK cannot roll the view back');assert.match(h.nodes.get('#stage').innerHTML,/大家一起送禮物給 C/);
});

test('gift score enters only after live server reveal; reduced motion preserves all static scores and gifts',()=>{
 for(const reduced of [false,true]){
  const h=setup({reduced}),last=delivery(1,'C'),result={round:1,entries:last.delivery.entries},reveal=delivery(2,'C',{phase:'reveal',result});h.receive(last);h.receive(reveal);
  assert.equal(h.animations.length,reduced?0:1);assert.match(h.nodes.get('#stage').innerHTML,/送禮與收禮總分/);assert.match(h.nodes.get('#stage').innerHTML,/收到的完整禮物/);
  h.receive({...reveal,version:3});assert.equal(h.animations.length,reduced?0:1);
  const restored=setup({reduced});restored.receive(reveal);assert.equal(restored.animations.length,0);assert.match(restored.nodes.get('#stage').innerHTML,/送禮與收禮總分/);
 }
});

test('gift state polling forwards remote barrages even when the game version and recipient remain unchanged',async()=>{
 const h=setup();await h.poll(delivery(12,'C'));h.tick(1000);
 const barrage={id:'REMOTE-1',kind:'barrage',name:'B',message:'朋友的文字',at:h.now};await h.poll(delivery(12,'C',{barrages:[barrage]}));
 assert.equal(h.barrages.length,1);assert.equal(h.barrages[0].item.id,'REMOTE-1');assert.equal(h.animations.length,0,'social messages cannot replay the delivery');
 h.tick(1000);await h.poll(delivery(12,'C',{barrages:[barrage,{id:'REMOTE-2',kind:'emoji',name:'B',emoji:'🎉',at:h.now}]}));assert.equal(h.barrages.length,2);
 h.tick(1000);await h.poll(delivery(12,'C',{barrages:[barrage]}));assert.equal(h.barrages.length,2,'repeated poll snapshots cannot replay a message');
});
