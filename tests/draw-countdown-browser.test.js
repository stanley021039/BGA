const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {browserHarness,drawingState}=require('./helpers/draw-browser.cjs');

function fixture(){
 let now=1_000_000;
 const ui=browserHarness();
 class Clock extends Date{static now(){return now;}}
 ui.context.Date=Clock;
 const state=overrides=>({...drawingState('guest'),serverNow:900_000,deadline:930_000,options:{seconds:120},...overrides});
 return {...ui,state,tick(ms){now+=ms;vm.runInContext('tick()',ui.context);},receiveAt(next,ms=0){now+=ms;ui.receive(next);}};
}

test('joining during a drawing round uses the server deadline and full round duration despite clock skew',()=>{
 const ui=fixture();ui.receive(ui.state());
 assert.equal(ui.element('#drawCountdown').hidden,false);
 assert.equal(ui.element('#timer').textContent,'30 秒');
 assert.equal(ui.element('#timerProgress').value,.25);
 const canvas=ui.element('#drawCanvas'),frames=ui.frames.length;
 ui.tick(1_000);
 assert.equal(ui.element('#timer').textContent,'29 秒');
 assert.equal(ui.element('#timerProgress').value,29/120);
 assert.equal(ui.element('#drawCanvas'),canvas);
 assert.equal(ui.frames.length,frames,'updating time does not repaint or replace the drawing surface');
});

test('a presence update and repeated state do not restart a countdown, while a new authoritative deadline does',()=>{
 const ui=fixture(),initial=ui.state();ui.receive(initial);
 ui.receiveAt({...initial,version:3,serverNow:902_000,players:initial.players.map(player=>({...player,online:false}))},2_000);
 assert.equal(ui.element('#timer').textContent,'28 秒');
 assert.equal(ui.element('#timerProgress').value,28/120);
 ui.receiveAt({...initial,version:3,serverNow:902_000});
 assert.equal(ui.element('#timerProgress').value,28/120);
 const choosing={...initial,version:4,phase:'choosing',question:null,hint:null,serverNow:902_000,deadline:909_500};
 ui.receive(choosing);
 assert.equal(ui.element('#timer').textContent,'8 秒');
 assert.equal(ui.element('#timerProgress').value,.5);
 ui.receive({...choosing,version:5,deadline:917_000});
 assert.equal(ui.element('#timer').textContent,'15 秒');
 assert.equal(ui.element('#timerProgress').value,1,'candidate replacement can legitimately extend the selection deadline');
});

test('choosing, drawing and reveal use their own phase durations without retaining the previous progress',()=>{
 const ui=fixture(),base=ui.state();
 ui.receive({...base,phase:'choosing',question:null,hint:null,deadline:907_500});
 assert.equal(ui.element('#timerCaption').textContent,'選題剩餘');
 assert.equal(ui.element('#timerProgress').value,.5);
 ui.receive({...base,version:3,options:{seconds:60},deadline:960_000});
 assert.equal(ui.element('#timerCaption').textContent,'作畫剩餘');
 assert.equal(ui.element('#timer').textContent,'60 秒');
 assert.equal(ui.element('#timerProgress').value,1);
 ui.receive({...base,version:4,phase:'reveal',deadline:904_000,result:{answer:'貓咪',reason:'時間到',guessedIds:[]}});
 assert.equal(ui.element('#drawCountdown').hidden,false);
 assert.equal(ui.element('#timerCaption').textContent,'下一輪');
 assert.equal(ui.element('#timer').textContent,'4 秒');
 assert.equal(ui.element('#timerProgress').value,.5);
});

test('elapsed and future deadlines stay within the progress range and untimed phases clear the countdown',()=>{
 const ui=fixture(),base=ui.state();ui.receive({...base,deadline:899_999});
 assert.equal(ui.element('#timer').textContent,'0 秒');
 assert.equal(ui.element('#timerProgress').value,0);
 ui.receive({...base,version:3,deadline:1_020_001});
 assert.equal(ui.element('#timerProgress').value,1);
 ui.receive({...base,version:4,phase:'finished',deadline:null,winner:{ids:['artist']}});
 assert.equal(ui.element('#drawCountdown').hidden,true);
 assert.equal(ui.element('#timer').textContent,'–');
 assert.equal(ui.element('#timerProgress').value,1);
 ui.receive({...base,version:5,phase:'waiting',deadline:null,presenterId:null});
 assert.equal(ui.element('#drawCountdown').hidden,true);
});

test('the canvas heading exposes the same countdown to artist and guessers while retaining answer and input permissions',()=>{
 const ui=fixture(),base=ui.state();ui.receive(base);
 assert.equal(ui.element('#drawCountdown').hidden,false);
 assert.doesNotMatch(ui.element('#boardTitle').textContent,/貓咪/);
 assert.equal(ui.element('#tools').hidden,true);
 assert.equal(ui.element('#guessForm').hidden,false);
 ui.receive({...base,version:3,guessedIds:['guest']});
 assert.equal(ui.element('#guessForm').hidden,true);
 assert.match(ui.element('#players').innerHTML,/draw-player-correct/);
 ui.receive({...base,version:4,me:'artist',question:{title:'貓咪',category:'簡單',difficulty:'easy'}});
 assert.equal(ui.element('#boardTitle').textContent,'貓咪');
 assert.equal(ui.element('#tools').hidden,false);
 assert.equal(ui.element('#guessForm').hidden,true);
 assert.equal(ui.element('#timerProgress').value,.25);
});

test('incomplete timing metadata cannot publish NaN progress or an invalid time label',()=>{
 const ui=fixture(),base=ui.state();ui.receive({...base,options:{seconds:0},deadline:945_000});
 assert.equal(ui.element('#timerProgress').value,.5);
 for(const deadline of [null,NaN,Infinity]){
  ui.receive({...base,version:3,deadline});
  assert.equal(ui.element('#drawCountdown').hidden,true);
  assert.equal(ui.element('#timer').textContent,'–');
  assert.ok(Number.isFinite(ui.element('#timerProgress').value));
 }
});
