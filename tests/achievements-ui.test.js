const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=name=>fs.readFileSync(path.join(__dirname,'../public',name),'utf8');

function fixture(){
 const requests=[],nodes=new Map(),icons=[];
 class Node{
  constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.parentNode=null;this.attributes=new Map();this.dataset={};this.className='';this._text='';this._value=undefined;this._html='';this.listeners=new Map();this.hidden=false;this.disabled=false;this.classList={toggle:(name,on)=>{const values=new Set(this.className.split(/\s+/).filter(Boolean));if(on)values.add(name);else values.delete(name);this.className=[...values].join(' ');}};}
  append(...children){for(const child of children){if(child.parentNode)child.parentNode.children=child.parentNode.children.filter(node=>node!==child);child.parentNode=this;this.children.push(child);}}
  replaceChildren(...children){for(const child of this.children)child.parentNode=null;this.children=[];this._text='';this.append(...children);}
  set textContent(value){this.replaceChildren();this._text=String(value);}get textContent(){return this._text+this.children.map(child=>child.textContent).join('');}
  set innerHTML(value){this.replaceChildren();this._html=value;}get innerHTML(){return this._html;}
  setAttribute(name,value){this.attributes.set(name,String(value));}getAttribute(name){return this.attributes.get(name)??null;}
  addEventListener(type,callback){this.listeners.set(type,callback);}dispatch(type){this.listeners.get(type)?.({target:this});}
  get options(){return this.tagName==='SELECT'?this.children:undefined;}
  get value(){return this._value??this.children[0]?.value??'';}set value(value){this._value=String(value);}
  focus(){document.activeElement=this;}
 }
 const document={activeElement:null,createElement:tag=>new Node(tag),querySelector:selector=>nodes.get(selector)};
 for(const id of ['achievementList','achievementSummary','achievementGameFilter','achievementStatusFilter','achievementFilterSummary','achievementRetry'])nodes.set('#'+id,new Node(id.includes('Filter')&&!id.includes('Summary')?'select':id==='achievementRetry'?'button':'div'));
 for(const id of ['achievementGameFilter','achievementStatusFilter']){const control=nodes.get('#'+id);control.disabled=true;const option=new Node('option');option.value='*';control.append(option);control.value='*';}
 nodes.get('#achievementRetry').hidden=true;
 const window={GameUI:{icon:name=>{icons.push(name);return '<svg data-icon="'+name+'"></svg>';},decorateButton:()=>{}}};
 const context=vm.createContext({document,window,Intl,Date,fetch:route=>new Promise((resolve,reject)=>requests.push({route,resolve,reject}))});
 vm.runInContext(read('achievements.js'),context,{filename:'achievements.js'});
 const all=(root=nodes.get('#achievementList'))=>[root,...root.children.flatMap(child=>all(child))];
 const classNodes=(name,root)=>all(root).filter(node=>node.className.split(/\s+/).includes(name));
 const visibleText=(root=nodes.get('#achievementList'))=>root.hidden||root.className.split(/\s+/).includes('ui-sr-only')?'':root._text+root.children.map(child=>visibleText(child)).join('');
 async function flush(){for(let i=0;i<8;i++)await Promise.resolve();}
 return {requests,nodes,icons,document,all,classNodes,visibleText,flush,card:id=>classNodes('achievement-card').find(node=>node.dataset.achievementId===id),async reply(index,body,{ok=true,jsonError=false}={}){requests[index].resolve({ok,json:async()=>{if(jsonError)throw Error('bad JSON');return body;}});await flush();},filter(id,value){const node=nodes.get('#'+id);node.value=value;node.focus();node.dispatch('change');}};
}
const defs=[['gift-first-gift','gift'],['majority-first-vote','majority'],['poker-first-hand','poker'],['thunder-first-drive','thunder'],['all-first-table','all'],['draw-first-round','draw'],['draw-soul-artist','draw'],['draw-first-correct','draw'],['gift-coincidental-twins','gift'],['gift-wishlist-echo','gift'],['majority-one-channel','majority'],['majority-tied-signals','majority'],['all-two-tables','all']];
const item=(id,game,extra={})=>({id,achievement_id:id,game,title:'伺服器名稱 '+id,description:'伺服器確認的條件 '+id,rule_version:1,condition_key:id+'.v1',icon_key:'check',visibility:'private',status:'enabled',category:'intro',unlockedAt:null,...extra});

test('achievement page renders server names and conditions in six groups with readable categories and unlock dates',async()=>{
 const f=fixture(),items=defs.map(([id,game],index)=>item(id,game,index<2?{unlockedAt:'2026-10-07T18:10:00.000Z',rule_version:2}:{}));items[0].title='伺服器提供的心意';items[0].description='伺服器提供的短條件';
 assert.equal(f.nodes.get('#achievementGameFilter').disabled,true);await f.reply(0,{achievements:items});
 assert.deepEqual(f.classNodes('achievement-group').map(node=>node.dataset.game),['draw','gift','majority','poker','thunder','all']);assert.equal(f.classNodes('achievement-card').length,13);
 assert.equal(f.nodes.get('#achievementSummary').textContent,'已收藏 2 / 13 枚');assert.equal(f.nodes.get('#achievementList').getAttribute('aria-busy'),'false');
 const card=f.card('gift-first-gift');assert.match(card.textContent,/伺服器提供的心意/);assert.match(card.textContent,/伺服器提供的短條件/);assert.match(card.textContent,/已解鎖/);assert.match(card.textContent,/入門/);assert.equal(card.dataset.achievementId,'gift-first-gift');assert.doesNotMatch(card.textContent,/gift-first-gift|規則 v2/);assert.equal(f.all(card).filter(node=>node.tagName==='CODE').length,0);
 assert.ok(card.className.split(/\s+/).includes('unlocked'));assert.ok(!f.card('draw-first-round').className.split(/\s+/).includes('unlocked'));assert.doesNotMatch(f.visibleText(),/已解鎖|尚未解鎖|未解鎖/);assert.equal(f.classNodes('achievement-status-icon').length,0);
 assert.equal(f.classNodes('ui-sr-only',card)[0].textContent,'已解鎖');assert.equal(f.classNodes('ui-sr-only',f.card('draw-first-round'))[0].textContent,'尚未解鎖');
 const time=f.all(card).find(node=>node.tagName==='TIME');assert.equal(time.dateTime,'2026-10-07T18:10:00.000Z');assert.match(time.textContent,/2026年10月8日/);assert.match(f.visibleText(card),/取得於 2026年10月8日/);assert.match(f.card('draw-first-round').textContent,/尚未解鎖/);assert.equal(f.all(f.card('draw-first-round')).some(node=>node.tagName==='TIME'),false);
 assert.equal(f.nodes.get('#achievementGameFilter').disabled,false);assert.deepEqual(f.requests.map(request=>request.route),['/api/achievements']);
});

test('game and unlock filters compose locally, preserve the controls and focus, and do not fetch or change awards',async()=>{
 const f=fixture();await f.reply(0,{achievements:[item('gift-a','gift',{unlockedAt:'2026-10-08'}),item('gift-b','gift'),item('draw-a','draw')]});
 const select=f.nodes.get('#achievementGameFilter');f.filter('achievementGameFilter','gift');assert.equal(f.classNodes('achievement-card').length,2);assert.equal(f.document.activeElement,select);
 f.filter('achievementStatusFilter','locked');assert.deepEqual(f.classNodes('achievement-card').map(node=>node.dataset.achievementId),['gift-b']);assert.equal(f.nodes.get('#achievementFilterSummary').textContent,'目前顯示 1 枚');assert.equal(f.classNodes('achievement-group-count')[0].textContent,'已收藏 1 / 2 枚');
 f.filter('achievementGameFilter','draw');f.filter('achievementStatusFilter','unlocked');assert.equal(f.classNodes('achievement-card').length,0);assert.match(f.nodes.get('#achievementList').textContent,/此篩選沒有符合/);
 f.filter('achievementGameFilter','*');f.filter('achievementStatusFilter','*');assert.equal(f.classNodes('achievement-card').length,3);assert.equal(f.nodes.get('#achievementGameFilter'),select);assert.equal(f.nodes.get('#achievementSummary').textContent,'已收藏 1 / 3 枚');assert.equal(f.requests.length,1);
});

test('unknown game and icon metadata fall back safely while all server text remains text content',async()=>{
 const f=fixture(),title='<img src=x onerror=bad()>',id='<script>alert(1)</script>';
 await f.reply(0,{achievements:[item(id,'future-game',{title,description:'<svg onload=bad()>',icon_key:'<svg onload=bad()>',rule_version:'<script>',category:'__proto__',unlockedAt:'invalid-date'})]});
 assert.equal(f.classNodes('achievement-group')[0].dataset.game,'other');assert.equal(f.nodes.get('#achievementGameFilter').options[1].textContent,'其他成就');
 const card=f.card(id);assert.match(card.textContent,/<img src=x onerror=bad\(\)>/);assert.match(card.textContent,/取得日期待確認/);assert.doesNotMatch(card.textContent,/規則 v|<script>|\[object Object\]/);assert.equal(card.dataset.achievementId,id);assert.equal(f.all(card).filter(node=>['IMG','SCRIPT'].includes(node.tagName)).length,0);
 assert.ok(f.icons.includes('book'));assert.ok(!f.icons.includes('<svg onload=bad()>'));assert.ok(f.all(card).every(node=>!node.innerHTML.includes('onload=bad')));
});

test('legacy metadata remains readable and proposed P2 badges never enter groups or collection counts',async()=>{
 const f=fixture();await f.reply(0,{achievements:[{id:'legacy',game:'poker',title:'舊徽章',description:'原有條件',unlockedAt:null},item('paused','gift',{status:'paused',unlockedAt:'2026-10-08'}),item('paused-locked','gift',{status:'paused'}),item('p2-only','thunder',{status:'proposed'}),null,{id:22,game:'draw'}]});
 assert.equal(f.classNodes('achievement-card').length,2);assert.match(f.card('legacy').textContent,/舊徽章/);assert.doesNotMatch(f.card('legacy').textContent,/規則版本|legacy/);assert.match(f.card('paused').textContent,/已解鎖/);assert.match(f.card('paused').textContent,/暫停新授予，已取得紀錄保留/);assert.equal(f.card('p2-only'),undefined);
 assert.equal(f.nodes.get('#achievementSummary').textContent,'已收藏 1 / 2 枚');assert.ok(!f.nodes.get('#achievementGameFilter').options.some(option=>option.value==='thunder'));
});

test('failed or malformed responses expose a readable retry, prevent duplicate requests, and recover after retry',async()=>{
 const f=fixture();await f.reply(0,{error:'<b>登入已過期</b>'},{ok:false});
 assert.equal(f.nodes.get('#achievementRetry').hidden,false);assert.equal(f.classNodes('achievement-error')[0].getAttribute('role'),'alert');assert.match(f.nodes.get('#achievementList').textContent,/<b>登入已過期<\/b>/);assert.equal(f.nodes.get('#achievementGameFilter').disabled,true);
 f.nodes.get('#achievementRetry').dispatch('click');f.nodes.get('#achievementRetry').dispatch('click');assert.equal(f.requests.length,2);assert.equal(f.nodes.get('#achievementList').getAttribute('aria-busy'),'true');
 await f.reply(1,{achievements:null});assert.match(f.nodes.get('#achievementList').textContent,/資料格式不正確/);assert.equal(f.nodes.get('#achievementList').getAttribute('aria-busy'),'false');
 f.nodes.get('#achievementRetry').dispatch('click');await f.reply(2,{achievements:[item('restored','draw')]});assert.equal(f.nodes.get('#achievementRetry').hidden,true);assert.equal(f.nodes.get('#achievementStatusFilter').disabled,false);assert.ok(f.card('restored'));assert.ok(f.requests.every(request=>request.route==='/api/achievements'));
});

test('an empty collection has a readable state and no fabricated game sections',async()=>{
 const f=fixture();await f.reply(0,{achievements:[]});assert.equal(f.classNodes('achievement-group').length,0);assert.equal(f.nodes.get('#achievementSummary').textContent,'已收藏 0 / 0 枚');assert.match(f.nodes.get('#achievementList').textContent,/目前沒有可收集/);assert.equal(f.nodes.get('#achievementGameFilter').options.length,1);
});

test('achievement game icons are defined by the common 24px registry instead of page artwork',()=>{
 const source=read('shared/ui-components.js'),end=source.indexOf(' /* One hover/focus hint');const context=vm.createContext({window:{},document:{}});vm.runInContext(source.slice(0,end)+'})();',context);
 for(const name of ['edit','gift','users','cards','car','table']){const svg=context.window.GameUI.icon(name);assert.match(svg,/class="ui-icon" viewBox="0 0 24 24"/);assert.match(svg,/aria-hidden="true" focusable="false"/);assert.doesNotMatch(svg,/<script|<image|https?:/);}
 const html=read('achievements.html');assert.match(html,/for="achievementGameFilter"/);assert.match(html,/for="achievementStatusFilter"/);assert.match(html,/<option value="unlocked">已解鎖<\/option>/);assert.match(html,/<option value="locked">未解鎖<\/option>/);assert.ok(html.indexOf('/shared/ui-components.js')<html.indexOf('/achievements.js'));
});
