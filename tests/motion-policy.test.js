const test=require('node:test'),assert=require('node:assert/strict');
const {fixture}=require('./helpers/motion');
const snapshot=(version,barrages=[],code='ROOM')=>({code,version,barrages});

test('motion preferences persist independently, follow other tabs and honor reduced motion',()=>{
 const h=fixture(),values=[],unsubscribe=h.policy.subscribe(value=>values.push(value));
 assert.equal(h.policy.allowsMotion(),true);h.policy.set({barrages:false});assert.equal(h.policy.allowsMotion(),true);assert.equal(h.policy.get().barrages,false);
 h.policy.set({enabled:false});assert.equal(h.classes.has('motion-reduced'),true);assert.equal(JSON.parse(h.storage.get('ah-motion-settings')).enabled,false);
 h.policy.set({enabled:true});h.reduce(true);assert.equal(h.policy.get().enabled,true);assert.equal(h.policy.allowsMotion(),false);h.reduce(false);assert.equal(h.policy.allowsMotion(),true);
 h.storage.set('ah-motion-settings',JSON.stringify({version:1,enabled:false,barrages:true}));h.window.dispatch('storage',{key:'ah-motion-settings'});assert.equal(h.policy.allowsMotion(),false);assert.equal(h.policy.get().barrages,true);
 const count=values.length;unsubscribe();h.policy.set({enabled:true});assert.equal(values.length,count);
});

test('an existing per-game opt-out is respected until a shared preference is explicitly saved',()=>{
 const h=fixture({legacy:{'ah-gift-motion':'off'}});assert.equal(h.policy.get().enabled,false);assert.equal(h.policy.get().barrages,true);h.policy.set({enabled:true});
 const next=fixture({legacy:{'ah-gift-motion':'off'},saved:JSON.parse(h.storage.get('ah-motion-settings'))});assert.equal(next.policy.get().enabled,true);
});

test('event gates establish baselines on hydration, reconnect, visibility return, room change and long gaps',()=>{
 const h=fixture(),g=h.policy.createGate();
 assert.equal(g.update(snapshot(1)),false);assert.equal(g.take('old'),false);assert.equal(g.update(snapshot(2)),true);assert.equal(g.take('new'),true);assert.equal(g.take('new'),false);
 assert.equal(g.update(snapshot(3),{connected:false}),false);assert.equal(g.take('reconnected'),false);assert.equal(g.update(snapshot(4)),true);
 h.hide(true);assert.equal(g.update(snapshot(5)),false);assert.equal(g.take('hidden'),false);h.hide(false);assert.equal(g.update(snapshot(6)),false);assert.equal(g.take('return'),false);assert.equal(g.update(snapshot(7)),true);
 h.tick(5001);assert.equal(g.update(snapshot(8)),false);assert.equal(g.update(snapshot(9)),true);
 assert.equal(g.update(snapshot(1,[],'OTHER')),false);assert.equal(g.size(),0);assert.equal(g.update(snapshot(2,[],'OTHER')),true);
 assert.equal(g.update(snapshot(1,[],'OTHER')),false);assert.equal(g.take('stale'),false);
});

test('gate seen keys remain bounded and disposed gates cannot replay',()=>{
 const h=fixture(),g=h.policy.createGate({maxSeen:8});g.update(snapshot(1));g.update(snapshot(2));
 for(let i=0;i<100;i++)g.take(i);assert.equal(g.size(),8);assert.equal(g.take(99),false);g.dispose();assert.equal(g.size(),0);assert.equal(g.update(snapshot(3)),false);assert.equal(g.take('after'),false);
});

test('managed WAAPI effects cancel when hidden or disabled and handle rejected finished promises',async()=>{
 const h=fixture(),animations=[];
 const node={animate(){let reject;const animation={finished:new Promise((resolve,fail)=>{reject=fail;}),cancelled:false,cancel(){this.cancelled=true;reject(new Error('AbortError'));}};animations.push(animation);return animation;}};
 assert.ok(h.policy.confirm(node));h.hide(true);assert.equal(animations[0].cancelled,true);assert.equal(h.policy.confirm(node),null);
 h.hide(false);h.policy.confirm(node);h.policy.set({enabled:false});assert.equal(animations[1].cancelled,true);assert.equal(h.policy.confirm(node),null);
 h.policy.set({enabled:true});h.policy.confirm(node);h.window.dispatch('pagehide');assert.equal(animations[2].cancelled,true);await Promise.resolve();await Promise.resolve();
});

function barrageFixture(options){const h=fixture(options),shown=[],removed=[];const controller=h.policy.createBarrageController((item,lane,props)=>{shown.push({item,lane,...props});return()=>removed.push(item.id);});const message=id=>({id,name:'甲',message:'文字 '+id,kind:id%2?'text':'emoji',emoji:'🎉',at:h.now});return{...h,h,shown,removed,controller,message};}
test('barrages show only new confirmed events in at most four lanes and never queue overflow',()=>{
 const f=barrageFixture(),{controller:c,message:m,shown}=f;c.update(snapshot(1,[m(1)]));assert.equal(shown.length,0);
 c.update(snapshot(2,[m(1),m(2),m(3),m(4),m(5),m(6)]));assert.equal(shown.length,4);assert.deepEqual(shown.map(row=>row.lane),[0,1,2,3]);assert.equal(c.size(),4);assert.equal(f.timers.size,4);
 shown[0].finish();assert.equal(c.size(),3);c.update(snapshot(3,[m(2),m(3),m(4),m(5),m(6),m(7)]));assert.equal(shown.length,5);assert.equal(shown[4].item.id,7);assert.equal(shown[4].lane,0);
 f.h.tick(8000);assert.equal(c.size(),0);assert.equal(f.timers.size,0);assert.equal(f.removed.length,5);c.dispose();
});

test('barrage toggle, disconnect and hidden return discard catch-up; static mode remains readable for five seconds',()=>{
 const f=barrageFixture({reduced:true}),{controller:c,message:m,shown,h}=f;c.update(snapshot(1));c.update(snapshot(2,[m(1)]));assert.equal(shown[0].moving,false);h.tick(4999);assert.equal(c.size(),1);h.tick(1);assert.equal(c.size(),0);
 h.policy.set({barrages:false});c.update(snapshot(3,[m(2)]));h.policy.set({barrages:true});c.update(snapshot(4,[m(2)]));assert.equal(shown.length,1);
 c.update(snapshot(5,[m(3)]));assert.equal(shown.length,2);c.disconnect();assert.equal(c.size(),0);c.update(snapshot(6,[m(4)]));assert.equal(shown.length,2);
 c.update(snapshot(7,[m(5)]));h.hide(true);assert.equal(c.size(),0);c.update(snapshot(8,[m(6)]));h.hide(false);c.update(snapshot(9,[m(7)]));assert.equal(shown.length,3);c.update(snapshot(10,[m(8)]));assert.equal(shown.length,4);
 c.dispose();assert.equal(c.size(),0);assert.equal(h.timers.size,0);c.update(snapshot(11,[m(9)]));assert.equal(shown.length,4);
});

test('barrage room changes clear old nodes, and expired history is not displayed',()=>{
 const f=barrageFixture(),{controller:c,message:m,h}=f;c.update(snapshot(1));c.update(snapshot(2,[m(1)]));assert.equal(c.size(),1);c.update(snapshot(1,[m(2)],'OTHER'));assert.equal(c.size(),0);assert.equal(f.removed.length,1);
 c.update(snapshot(2,[{...m(3),at:h.now-8000}], 'OTHER'));assert.equal(f.shown.length,1);c.dispose();
});

test('barrage placement rejection releases its lane without a timer or later replay',()=>{
 const h=fixture(),shown=[],removed=[];
 const c=h.policy.createBarrageController((item,lane)=>{shown.push({id:item.id,lane});return item.id<=5?false:()=>removed.push(item.id);});
 const m=id=>({id,at:h.now,message:'message '+id});
 c.update(snapshot(1));c.update(snapshot(2,[m(1),m(2),m(3),m(4),m(5)]));
 assert.equal(c.size(),0);assert.equal(h.timers.size,0);assert.deepEqual(shown.map(row=>row.lane),[0,0,0,0,0]);
 c.update(snapshot(3,[m(1),m(2),m(3),m(4),m(5),m(6)]));
 assert.deepEqual(shown.map(row=>row.id),[1,2,3,4,5,6]);assert.equal(shown[5].lane,0);assert.equal(c.size(),1);assert.equal(h.timers.size,1);
 c.dispose();assert.deepEqual(removed,[6]);assert.equal(h.timers.size,0);
});

test('a barrage show callback returning undefined keeps its lane for the normal duration',()=>{
 const h=fixture(),shown=[];
 const c=h.policy.createBarrageController((item,lane)=>{shown.push({id:item.id,lane});});
 c.update(snapshot(1));c.update(snapshot(2,[{id:'legacy',at:h.now}]));
 assert.equal(shown.length,1);assert.equal(c.size(),1);assert.equal(h.timers.size,1);
 h.tick(7999);assert.equal(c.size(),1);h.tick(1);assert.equal(c.size(),0);assert.equal(h.timers.size,0);c.dispose();
});

test('synchronous barrage finish cleans the returned node once and never schedules a timer',()=>{
 const h=fixture(),shown=[],removed=[];
 const c=h.policy.createBarrageController((item,lane,{finish})=>{shown.push({id:item.id,lane,finish});finish();return()=>{removed.push(item.id);finish();};});
 c.update(snapshot(1));c.update(snapshot(2,[{id:'first',at:h.now},{id:'second',at:h.now}]));
 assert.deepEqual(shown.map(row=>row.lane),[0,0]);assert.deepEqual(removed,['first','second']);assert.equal(c.size(),0);assert.equal(h.timers.size,0);
 shown[0].finish();shown[1].finish();h.tick(8000);c.dispose();assert.deepEqual(removed,['first','second']);assert.equal(h.timers.size,0);
});

test('throwing barrage renderers release their lane and do not block later messages',()=>{
 const h=fixture(),shown=[],removed=[];
 const c=h.policy.createBarrageController((item,lane,{finish})=>{shown.push({id:item.id,lane,finish});if(item.id==='broken')throw new Error('placement failed');return()=>removed.push(item.id);});
 c.update(snapshot(1));assert.doesNotThrow(()=>c.update(snapshot(2,[{id:'broken',at:h.now},{id:'valid',at:h.now}])));
 assert.deepEqual(shown.map(row=>row.lane),[0,0]);assert.equal(c.size(),1);assert.equal(h.timers.size,1);
 shown[0].finish();assert.equal(c.size(),1);assert.equal(h.timers.size,1);
 c.update(snapshot(3,[{id:'broken',at:h.now},{id:'valid',at:h.now}]));assert.equal(shown.length,2);
 h.tick(8000);assert.deepEqual(removed,['valid']);assert.equal(c.size(),0);assert.equal(h.timers.size,0);c.dispose();
});
