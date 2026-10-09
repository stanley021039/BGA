const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {mediaHarness}=require('./helpers/media-browser.cjs');
const source=fs.readFileSync(path.join(__dirname,'../public/shared/barrage-frames.js'),'utf8');
function fixture(saved){const f=mediaHarness();if(saved!==undefined)f.storage.set('ah-barrage-frame-settings',saved);vm.runInContext(source,f.context);return {...f,frames:f.window.BarrageFrames};}
test('frame settings normalize untrusted storage, persist and follow cross-tab changes independently of motion',()=>{
 for(const saved of ['broken','null','{"enabled":0,"selected":"__proto__"}','{"enabled":"false","selected":"url(evil)"}']){const f=fixture(saved);assert.deepEqual({...f.frames.get()},{version:1,enabled:true,selected:'default'});}
 const f=fixture();f.frames.set({enabled:false,selected:'comic'});assert.equal(f.document.body.classList.contains('barrage-frames-disabled'),true);assert.equal(JSON.parse(f.storage.get('ah-barrage-frame-settings')).selected,'comic');
 let seen=0;const unsubscribe=f.frames.subscribe(()=>seen++);f.storage.set('ah-barrage-frame-settings',JSON.stringify({enabled:true,selected:'pixel'}));f.window.dispatch('storage',{key:'unrelated'});assert.equal(seen,1);f.window.dispatch('storage',{key:'ah-barrage-frame-settings'});assert.equal(seen,2);assert.equal(f.frames.get().selected,'pixel');assert.equal(f.document.body.classList.contains('barrage-frames-disabled'),false);unsubscribe();assert.equal(f.storage.has('ah-motion-settings'),false);
});
test('only trusted versioned builtin descriptors choose a style; message and name remain text nodes',()=>{
 const f=fixture();for(const value of [null,{kind:'builtin',id:'paper',version:2},{kind:'url',id:'comic',version:1},{kind:'builtin',id:'https://bad',version:1},{kind:'builtin',id:[],version:1}])assert.equal(f.frames.descriptorId(value),'default');
 const bubble=f.document.createElement('div');f.frames.decorate(bubble,{kind:'builtin',id:'pixel',version:1},'<img onerror=bad>','<svg>你好 🎉</svg>');assert.equal(bubble.dataset.frameId,'pixel');assert.equal(bubble.children[2].children[0].textContent,'<img onerror=bad>：');assert.equal(bubble.children[2].children[1].textContent,'<svg>你好 🎉</svg>');
 f.frames.set({selected:'comic',enabled:false});assert.equal(bubble.dataset.frameId,'pixel');assert.equal(bubble.children.length,3);
});
test('measured placements reserve full multiline height with gaps and reject unusable space',()=>{
 const {frames}=fixture();assert.equal(frames.findPlacement(500,50),12);assert.equal(frames.findPlacement(500,100,[{top:12,height:96}]),116);assert.equal(frames.findPlacement(500,50,[{top:200,height:100},{top:12,height:60}]),80);assert.equal(frames.findPlacement(120,100),null);assert.equal(frames.findPlacement(500,Infinity),null);assert.equal(frames.findPlacement(500,0),null);assert.equal(frames.findPlacement(240,60,[{top:12,height:90},{top:110,height:90}]),null);
 const spans=[];for(let i=0;i<4;i++){const top=frames.findPlacement(500,90,spans);assert.notEqual(top,null);spans.push({top,height:90});}for(let i=1;i<spans.length;i++)assert.ok(spans[i].top>=spans[i-1].top+90+8);
});
test('DOM placement failure removes a bubble and receiver opt-out preserves live node geometry',()=>{
 const f=fixture(),layer=f.document.createElement('div'),first=f.document.createElement('div');layer.clientHeight=150;first.offsetHeight=90;assert.equal(f.frames.place(layer,first),true);assert.equal(first.style.top,'12px');const second=f.document.createElement('div');second.offsetHeight=90;assert.equal(f.frames.place(layer,second),false);assert.equal(layer.children.length,1);f.frames.set({enabled:false});assert.equal(layer.children[0],first);assert.equal(first.style.top,'12px');assert.equal(first.offsetHeight,90);
});
test('all header entry points load the same frame preference module and shared frame art',()=>{
 const pages=fs.readdirSync(path.join(__dirname,'../public')).filter(name=>name.endsWith('.html')).map(name=>({name,html:fs.readFileSync(path.join(__dirname,'../public',name),'utf8')})).filter(page=>page.html.includes('/shared/site-header.js'));assert.equal(pages.length,22);
 for(const {name,html} of pages){assert.equal((html.match(/src="\/shared\/barrage-frames.js"/g)||[]).length,1,name);assert.equal((html.match(/href="\/shared\/barrage-frames.css"/g)||[]).length,1,name);assert.ok(html.indexOf('/shared/barrage-frames.js')<html.indexOf('/shared/site-header.js'),name);if(html.includes('/shared/game-shell.js'))assert.ok(html.indexOf('/shared/barrage-frames.js')<html.indexOf('/shared/game-shell.js'),name);}
});
