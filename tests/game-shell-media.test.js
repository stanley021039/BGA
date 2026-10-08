const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {mediaHarness,json}=require('./helpers/media-browser.cjs');
const read=file=>fs.readFileSync(path.join(__dirname,'../public/shared',file),'utf8');
async function fixture(){
 const responses=[],sounds=[],calls={mount:0,updates:[],stop:0,disconnect:0};let next;
 const f=mediaHarness({fetchHandler:async request=>{if(request.route==='/api/social/options')return json({emojis:['🎉','😂']});if(request.route==='/api/auth/me')return json({appearance:{characterId:'user:owned'}});if(request.route==='/api/profile/options')return json({defaults:{characterId:'user:owned'},characters:[{id:'user:owned',name:'我的角色',labels:{'emote-happy':'開心大笑'},expressions:{neutral:'/neutral.png','emote-happy':'/happy.gif'}}],expressionLabels:{neutral:'平常'}});if(request.body){responses.push(request.body);return json(next);}throw Error('unexpected '+request.route);}});
 const layout=f.document.createElement('div');layout.className='play-layout';const arena=f.document.createElement('main'),aside=f.document.createElement('aside'),actions=f.document.createElement('section');actions.setAttribute('data-game-action-slot','');aside.append(actions);layout.append(arena,aside);f.document.body.append(layout);
 f.window.TableMedia={mount(target){calls.mount++;const button=f.document.createElement('button');button.textContent='媒體';target.append(button);},update:state=>calls.updates.push(state),stop:()=>calls.stop++,disconnected:()=>calls.disconnect++};f.window.TableMusic={update(){throw Error('legacy music mounted');},getWatchSlot(){throw Error('legacy music mounted');}};f.window.TableWatch={update(){throw Error('legacy watch mounted');},mount(){throw Error('legacy watch mounted');}};
 const motion={createBarrageController:()=>({update(){},disconnect(){},dispose(){}})};f.context.MotionPolicy=motion;f.window.MotionPolicy=motion;f.window.UIPopover={bind:()=>({sync(){}}),bindDetails(){},bindOverlay(){}};f.window.GameUI.setBusy=()=>{};f.window.AudioSettings.playExpression=sound=>{sounds.push(sound);};vm.runInContext(read('expression-sounds.js'),f.context);vm.runInContext(read('game-shell.js'),f.context);await f.flush();
 const state=(changes={})=>({type:'majority',code:'ABC123',version:1,me:'host',phase:'waiting',serverNow:100000,players:[{id:'host',name:'朋友'}],expressions:[],social:[],...changes});
 return {...f,calls,responses,sounds,state,setResponse:value=>{next=value;}};
}
test('GameShell mounts and updates only unified media; disconnect and stop forward cleanup',async()=>{
 const f=await fixture(),state=f.state();f.window.GameShell.update(state);await f.flush();assert.equal(f.calls.mount,1);assert.equal(f.calls.updates.length,1);assert.equal(f.calls.updates[0],state);assert.equal(f.document.querySelectorAll('.shared-expression-menu').length,0);
 f.window.GameShell.disconnected();f.window.GameShell.stop();assert.equal(f.calls.disconnect,1);assert.equal(f.calls.stop,1);
});

test('test AI controls are host-only, respect capacity, and retain a Chinese accessible name',async()=>{
 const f=await fixture(),shell=f.window.GameShell;
 f.window.GameUI.icon=()=>'<svg aria-hidden="true"></svg>';
 assert.equal(shell.botButton({host:false,botSupport:{supported:true,canAdd:true}}),'');
 assert.equal(shell.botButton({host:true,botSupport:{supported:false,canAdd:false}}),'');
 const target=f.document.createElement('div');
 target.innerHTML=shell.botButton({host:true,botSupport:{supported:true,canAdd:true}});
 const enabled=target.querySelector('button');assert.equal(enabled.disabled,false);assert.equal(enabled.getAttribute('aria-label'),'加入測試 AI');assert.equal(enabled.getAttribute('data-do'),'bot');assert.ok(enabled.classList.contains('ui-icon-button'));
 target.innerHTML=shell.botButton({host:true,botSupport:{supported:true,canAdd:false}});assert.equal(target.querySelector('button').disabled,true);
});
test('one emoji button opens general emojis then a separator and named character expressions',async()=>{
 const f=await fixture();f.window.GameShell.update(f.state());await f.flush();const picker=f.node('shared-emoji-picker'),toggle=f.node('shared-emote-toggle');assert.equal(picker.hidden,true);toggle.click();assert.equal(picker.hidden,false);assert.match(toggle.getAttribute('aria-label'),/角色表情/);
 assert.deepEqual(picker.children.map(node=>node.tagName),['H3','DIV','HR','H3','DIV']);assert.equal(picker.children[2].getAttribute('role'),'separator');assert.equal(picker.querySelectorAll('.shared-emoji-choices button').length,2);assert.equal(picker.querySelectorAll('#shared-expressions button').length,2);const expression=picker.querySelectorAll('#shared-expressions button')[1];assert.equal(expression.title,'送出「開心大笑」');assert.equal(expression.getAttribute('aria-label'),'送出「開心大笑」表情');assert.equal(expression.querySelector('img').src,'/happy.gif');
 f.setResponse(f.state({serverNow:100010,expressions:[{id:'sound-new',at:100005,playerId:'host',expression:'emote-happy',label:'開心大笑',sound:{url:'/sound',durationMs:1000}}]}));await expression.click();await f.flush();assert.equal(picker.hidden,true);assert.deepEqual(f.responses[0],{code:'ABC123',kind:'expression',expression:'emote-happy'});assert.equal(f.sounds.length,1);assert.equal(f.document.activeElement,toggle);
});
test('emoji and text still send their original social kinds without changing character-expression ownership',async()=>{
 const f=await fixture();f.window.GameShell.update(f.state());await f.flush();f.setResponse(f.state({serverNow:100010}));f.node('shared-emote-toggle').click();const emoji=f.node('shared-emoji-picker').querySelector('.shared-emoji-choices button');await emoji.click();await f.flush();assert.deepEqual(f.responses[0],{code:'ABC123',kind:'emoji',emoji:'🎉'});
 const input=f.node('shared-barrage').querySelector('input');input.value='測試彈幕';await f.node('shared-barrage').submit();await f.flush();assert.deepEqual(f.responses[1],{code:'ABC123',kind:'barrage',message:'測試彈幕'});assert.equal(input.value,'');assert.equal(f.sounds.length,0);
});
