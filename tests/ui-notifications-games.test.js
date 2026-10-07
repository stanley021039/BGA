const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {fixture}=require('./helpers/ui-notifications.cjs');
const callers=[
 ['app.js','checkPokerAchievements','checkPokerAchievements();','pokerAchievementNotice'],
 ['gift.js','checkNewAchievement','function allowsMotion','giftAchievementNotice'],
 ['majority.js','checkNewAchievement','function restoreAchievementNotice','majorityAchievementNotice'],
 ['race.js','checkRaceAchievements','checkRaceAchievements();','raceAchievementNotice']
];
const read=file=>fs.readFileSync(path.join(__dirname,'../public',file),'utf8');
function achievementClient(file,name,end,id){
 const f=fixture(),source=read(file),start=source.indexOf('async function '+name+'('),finish=source.indexOf('\n'+end,start);delete f.ui.createAchievementTracker;assert(start>=0&&finish>start);const notice=new f.Node('p');notice.hidden=true;f.document.body.append(notice);const announcements=[],requests=[];let data={achievements:[]},ok=true;
 f.ui.notify=(text,options)=>{announcements.push({text,options:structuredClone(options)});return {element:null,dismiss(){}};};Object.assign(f.context,{$:selector=>selector==='#'+id?notice:null,fetch:async url=>{requests.push(url);return{ok,json:async()=>structuredClone(data)};}});
 f.run("let knownAchievements=null,achievementNoticeRound=null,achievementNoticeNames='';const state={round:2};"+source.slice(start,finish));
 return{...f,source,notice,announcements,requests,async check(next,{success=true}={}){data=next;ok=success;await f.run(name+'()');},known:()=>Array.from(f.run('knownAchievements||[]'))};
}
for(const [file,name,end,id]of callers){
 test(file+' achievement hydration is a baseline; all newly unlocked server IDs announce once and retain the persistent notice',async()=>{
  const f=achievementClient(file,name,end,id),old={id:'old-earned',title:'以前取得',unlockedAt:'2026-10-01'},a={id:'future-game-badge',title:'還未寫進前端的新成就',unlockedAt:'2026-10-07'},b={id:'all-first-table',title:'第一桌',unlockedAt:'2026-10-07'},c={id:'unusual-earned',title:'<img src=x onerror=bad()>',unlockedAt:'2026-10-07'},unknownTitle={id:'title-missing',unlockedAt:'2026-10-07'};
  await f.check({achievements:[old,{...a,unlockedAt:null}]});assert.equal(f.announcements.length,0);assert.equal(f.notice.hidden,true);assert.deepEqual(f.known(),['old-earned']);
  const latest={achievements:[old,a,b,c,unknownTitle,{...a},null,{id:22,unlockedAt:'invalid'}]};await f.check(latest);assert.equal(f.announcements.length,4);assert.deepEqual(f.announcements.map(item=>item.options.key),[a,b,c,unknownTitle].map(item=>'achievement:'+item.id));assert.ok(f.announcements.every(item=>item.options.kind==='achievement'&&item.options.celebrate===true&&item.options.href==='/achievements'&&item.options.durationMs===7000));assert.deepEqual(f.announcements.map(item=>item.text),[a,b,c,unknownTitle].map(item=>'解鎖成就：'+(item.title||item.id)));assert.equal(f.notice.hidden,false);assert.match(f.notice.textContent,/還未寫進前端的新成就、第一桌、<img src=x onerror=bad\(\)>、title-missing/);assert.equal(f.notice.children[0].href,'/achievements');
  await f.check(latest);assert.equal(f.announcements.length,4,'same snapshot does not replay');await f.check({achievements:[old]});await f.check(latest);assert.equal(f.announcements.length,4,'a late older response cannot make earned IDs new again');assert.equal(f.requests.length,5);assert.ok(f.requests.every(route=>route==='/api/achievements'));
 });
 test(file+' failed or malformed replies do not create a false baseline or unlock notification',async()=>{
  const f=achievementClient(file,name,end,id),earned={id:'already-earned',title:'已取得',unlockedAt:'2026-10-07'};await f.check({achievements:[earned]},{success:false});await f.check({error:'missing achievements'});assert.deepEqual(f.known(),[]);assert.equal(f.announcements.length,0);await f.check({achievements:[earned]});assert.equal(f.announcements.length,0);assert.deepEqual(f.known(),[earned.id]);await f.check({achievements:null});assert.deepEqual(f.known(),[earned.id]);assert.equal(f.announcements.length,0);
 });
}
test('all five toast callers use notifications without adding action acknowledgements and preserve legacy fallback',()=>{
 for(const [file,duration]of [['app.js',3500],['draw.js',4000],['gift.js',4500],['majority.js',4500],['race.js',4200]]){
  const source=read(file),definition=source.match(/^function toast\([^\n]+$/m)?.[0];assert.ok(definition,file);const f=fixture(),legacy=new f.Node('div');legacy.hidden=true;const calls=[];f.context.$=selector=>selector==='#toast'?legacy:null;f.ui.notify=(text,options)=>{calls.push({text,options});return 'handle';};f.run(definition);assert.equal(f.run("toast('邀請連結已複製')"),'handle');assert.equal(calls.length,1);assert.equal(calls[0].text,'邀請連結已複製');assert.equal(calls[0].options.durationMs,duration);assert.equal(legacy.textContent,'');assert.equal(f.timers.size,0);
  delete f.ui.notify;f.run("toast('完整保留錯誤')");assert.equal(legacy.textContent,'完整保留錯誤');assert.equal(f.timers.size,1);if(['app.js','race.js'].includes(file))assert.equal(legacy.style.display,'block');else assert.equal(legacy.hidden,false);
 }
 assert.doesNotMatch(read('draw.js'),/drawFeedback\('操作已完成'|drawFeedback\('猜測已送出'|輪到你畫圖/);
});
test('achievement checks keep their existing first baseline and meaningful settlement trigger without another poll',()=>{
 for(const [file,name]of callers){const source=read(file);assert.equal((source.match(/fetch\('\/api\/achievements'\)/g)||[]).length,1,file);assert.equal((source.match(new RegExp('setInterval\\('+name,'g'))||[]).length,0,file);assert.equal((source.match(new RegExp(name+'\\(\\);','g'))||[]).length,2,file);}
 assert.match(read('app.js'),/if\(showdownReveal\)\{[^}]*checkPokerAchievements\(\)/);assert.match(read('gift.js'),/if\(shouldFocus\)\{[^}]*checkNewAchievement\(\)/);assert.match(read('majority.js'),/if\(shouldFocus\)\{[^}]*checkNewAchievement\(\)/);assert.match(read('race.js'),/if\(finishTransition\)\{[^}]*checkRaceAchievements\(\)/);assert.doesNotMatch(read('draw.js'),/fetch\('\/api\/achievements'\)/);
});
