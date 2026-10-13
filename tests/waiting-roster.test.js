const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const {mediaHarness}=require('./helpers/media-browser.cjs');
const source=fs.readFileSync(path.join(__dirname,'../public/shared/room-waiting.js'),'utf8');
function fixture(type){
 const f=mediaHarness();f.document.createComment=()=>f.document.createElement('comment');const sample=f.document.createElement('span');Object.defineProperty(Object.getPrototypeOf(sample),'childNodes',{get(){return this.children;},configurable:true});const game=f.document.createElement('main');game.id='game';
 const host=f.document.createElement('div');host.className=({poker:'game-layout',thunder:'race-main',majority:'play-layout',gift:'gift-layout',draw:'draw-layout'})[type]||'';
 game.append(host);f.document.body.append(game);vm.runInContext(source,f.context);
 return {...f,host,update:s=>f.window.RoomWaiting.update(s),roster:()=>f.document.querySelector('.ui-room-roster')};
}
const state={phase:'waiting',me:'me',host:'me',players:[{id:'me',name:'長名字'.repeat(10),avatar:'/characters/me',score:7},{id:'bot',name:'測試 AI',bot:true,score:88},{id:'off',name:'<script>alert(1)</script>',offline:true},{id:'kicked',name:'已移除',kicked:true}]};
for(const type of ['poker','thunder','majority','gift','draw','telephone','trpg','musicquiz','minimal','bluff'])test(type+' waiting roster retains identity and restores play visibility',()=>{
 const f=fixture(type),s={...state,type};f.update(s);const roster=f.roster(),list=roster.querySelector('.ui-room-roster-list'),cards=list.children;
 assert.equal(roster.hidden,false);assert.equal(cards.length,3,'kicked players are excluded');assert.equal(cards[0].dataset.self,'true');
 assert.equal(cards[0].querySelector('img').src,'/characters/me');assert.equal(cards[1].querySelector('img').src,'/assets/characters/sunny-neutral.png');
 assert.equal(cards[2].querySelector('.ui-player-name-text').textContent,'<script>alert(1)</script>','nicknames are assigned as text');
 assert.match(cards[2].querySelector('small').textContent,/暫時離線/);assert.doesNotMatch(cards[0].querySelector('small').textContent,/7|分/);
 list.scrollTop=75;const first=cards[0];f.update({...s,version:2});assert.equal(list.children[0],first);assert.equal(list.scrollTop,75);
 f.update({...s,players:s.players.map(p=>p.id==='off'?{...p,offline:false}:p)});assert.equal(list.scrollTop,75);assert.match(list.children[2].querySelector('small').textContent,/已入座/);
 const img=list.children[0].querySelector('img');img.onerror();assert.equal(img.hidden,true,'failed images expose the name fallback');
 f.update({...s,phase:'playing'});assert.equal(roster.hidden,true);f.update(s);assert.equal(roster.hidden,false);assert.equal(f.document.querySelectorAll('.ui-room-roster').length,1);
});
test('race lessons keep their own teaching roster',()=>{const f=fixture('thunder');f.window.RaceLesson={};f.update({...state,type:'thunder'});assert.equal(f.roster(),null);});

test('roster add action remains last, keeps its native handler and is not counted as seated',()=>{
 const f=fixture('telephone'),s={...state,type:'telephone'};f.update(s);
 const b=f.document.createElement('button');let calls=0;b.onclick=()=>calls++;
 assert.equal(f.window.RoomWaiting.setRosterAction(b),true);
 const list=f.roster().querySelector('.ui-room-roster-list');assert.equal(list.children.length,4);
 assert.equal(list.children[3].querySelector('button'),b);assert.equal(b.getAttribute('aria-label'),'加入 AI 測試夥伴');
 b.onclick();assert.equal(calls,1);assert.match(f.roster().querySelector('.ui-room-roster-count').textContent,/3 位已入座/);
 f.update({...s,players:[...s.players,{id:'new',name:'新夥伴',bot:true}]});assert.equal(list.children.at(-1).querySelector('button'),b);
 f.window.RoomWaiting.setRosterAction(null);assert.equal(list.children.length,4);
 f.update({...s,phase:'passing'});assert.equal(f.window.RoomWaiting.setRosterAction(b),false);
});

test('moving a decorated action is idempotent, restores its home and preserves pending state',()=>{
 const f=fixture('minimal'),s={...state,type:'minimal'};f.update(s);
 const home=f.document.createElement('div'),button=f.document.createElement('button');button.className='button ui-button ui-icon-button';button.append(f.document.createElement('svg'));home.append(button);f.host.append(home);
 f.window.RoomWaiting.setRosterAction(button);const card=f.roster().querySelector('.ui-room-roster-add');
 assert.equal(button.classList.contains('ui-button'),false);assert.equal(button.classList.contains('ui-icon-button'),false);
 f.window.RoomWaiting.setRosterAction(button);assert.equal(f.roster().querySelector('.ui-room-roster-add'),card);
 f.window.RoomWaiting.setRosterBusy(true);assert.equal(button.disabled,true);
 f.window.RoomWaiting.setRosterBusy(false);assert.equal(button.disabled,false);
 button.disabled=true;f.window.RoomWaiting.setRosterBusy(true);f.window.RoomWaiting.setRosterBusy(false);assert.equal(button.disabled,true);
 f.update({...s,phase:'finished'});assert.equal(f.roster().hidden,false);assert.equal(f.roster().querySelector('.ui-room-roster-add'),card);
 f.update({...s,phase:'drawing'});assert.equal(f.window.RoomWaiting.setRosterAction(button),false);assert.equal(button.parentNode,home);assert.equal(button.className,'button ui-button ui-icon-button');assert.equal(button.children[0].tagName,'SVG');
});
