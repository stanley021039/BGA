const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const {mediaHarness}=require('./helpers/media-browser.cjs');
const source=fs.readFileSync(path.join(__dirname,'../public/shared/room-waiting.js'),'utf8');
function fixture(type){
 const f=mediaHarness(),game=f.document.createElement('main');game.id='game';
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
