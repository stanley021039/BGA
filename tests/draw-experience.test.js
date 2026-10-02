const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {randomUUID,randomFillSync} = require('node:crypto');
const {DrawGuessRoom} = require('../src/games/draw-guess');

const script = fs.readFileSync(path.join(__dirname, '..', 'public', 'draw.js'), 'utf8');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

function browserHarness() {
 const elements = new Map(), listeners = new Map(), frames = [], animations = [], strokeRequests = [], commandRequests = [];
 let snapshot = {round: 1, version: 0, strokes: []};
 function element(selector) {
  if (!elements.has(selector)) {
   const handlers = new Map();
   const node = {
    hidden: false, value: selector === '#color' ? '#273942' : selector === '#size' ? '5' : '', checked: false,
    innerHTML: '', textContent: '', dataset: {}, style: {}, children: [], scrollHeight: 0, scrollTop: 0, clientHeight: 0,
    classList: {toggle() {}, add() {}, remove() {}},
    addEventListener(type, fn) { handlers.set(type, fn); listeners.set(selector + ':' + type, fn); },
    setPointerCapture() {}, setAttribute() {},
    append(...children) { for (const child of children) { child.parent = this; this.children.push(child); } },
    replaceChildren(...children) { this.children = []; this.append(...children); },
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); },
    querySelector(selector) { return selector === '.feed-empty' ? this.children.find(child => child.className === 'feed-empty') || null : null; },
    querySelectorAll() { return []; },
    animate() { animations.push(selector); return {cancel() {}}; }, showModal() {}, close() {}, focus() {},
   };
   elements.set(selector, node);
  }
  return elements.get(selector);
 }
 const context = vm.createContext({
  window: {matchMedia: () => ({matches: false})},
  document: {body: element('body'), querySelector: element, createElement: () => element('created:' + randomUUID())},
  location: {pathname: '/draw/ABC123', origin: 'http://localhost:3000', search: ''},
  localStorage: {getItem: () => null, setItem() {}},
  history: {replaceState() {}}, navigator: {clipboard: {writeText: async () => {}}},
  URLSearchParams, setTimeout, clearTimeout, setInterval: () => 0, clearInterval: () => {},
  Date, crypto: {getRandomValues: bytes=>randomFillSync(bytes)}, confirm: () => true,
  fetch: async route => ({json: async () => route === '/api/info' ? {preferred: null} : {}}),
  RoomHost: {update() {}, kicked() {}}, RoomReconnect: {restore: async () => null},
  GameShell: {playerRow:(p)=>`<div class="player" data-player-id="${p.id}"></div>`,stableMarkup(node, html) {
   node.innerHTML = html;
   if (node === element('#players')) {
    node.playerRows = [...html.matchAll(/data-player-id="([^"]+)"/g)].map(([, id]) => {
     const row = element('row:' + id + ':' + randomUUID());
     row.dataset.playerId = id;
     return row;
    });
    node.querySelectorAll = selector => selector === '.player' ? node.playerRows : [];
   }
  }},
  StrokeCanvas: {
   pointFrom(event) { return event.point; },
   redraw(_canvas, strokes, preview) {
    frames.push(JSON.parse(JSON.stringify({strokes, preview: preview || null})));
   },
  },
  RoomApi: {
   async request(route, data) {
    if (route === 'draw/canvas') return JSON.parse(JSON.stringify(snapshot));
    if (route === 'draw/stroke') return new Promise(resolve => strokeRequests.push({data, resolve}));
    if (route === 'draw/command') {
     commandRequests.push(data);
     return {round: 1, version: snapshot.version + 1, strokes: []};
    }
    throw Error('Unexpected API call: ' + route);
   },
  },
 });
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../public/shared/stroke-canvas.js'),'utf8'),context);
 context.StrokeCanvas.strokeId=context.window.StrokeCanvas.strokeId;
 vm.runInContext(script, context, {filename: 'public/draw.js'});
 function receive(state) {
  context.injectedState = state;
  vm.runInContext('session={code:"ABC123"};receive(injectedState)', context);
 }
 return {context, element, listeners, frames, animations, strokeRequests, commandRequests, receive, setSnapshot(value) { snapshot = value; }};
}

function drawingState(me, guesses = []) {
 const now = Date.now();
 return {
  type: 'draw', code: 'ABC123', name: '朋友試玩', phase: 'drawing', version: 2,
  host: me === 'artist', hostId: 'artist', me, round: 1, roundLimit: 2,
  presenterId: 'artist', options: {seconds: 90, customPercent: null},
  deadline: now + 90_000, serverNow: now,
  candidates: [], question: me === 'artist' ? {title: '貓咪', category: '簡單', difficulty: 'easy'} : null,
  hint: {category: '簡單', length: 2},
  players: [
   {id: 'artist', name: '畫者', score: 0, online: true},
   {id: 'guest', name: '猜者', score: 0, online: true},
  ],
  participantIds: ['guest'], guessedIds: [], guesses, result: null, winner: null,
  strokeVersion: 0, events: [],
 };
}

function frameContainsStroke(frame) {
 const all = [...frame.strokes, ...(frame.preview ? [frame.preview] : [])];
 return all.some(stroke => stroke.points?.some(point => point[0] === 25 && point[1] === 25));
}

test('non-host presenter can draw over HTTP without crypto.randomUUID',async()=>{
 const ui=browserHarness(),state=drawingState('artist');state.host=false;state.hostId='guest';
 ui.receive(state);await pause(0);
 ui.listeners.get('#drawCanvas:pointerdown')({button:0,pointerId:1,point:[20,20],preventDefault(){}});
 ui.listeners.get('#drawCanvas:pointermove')({pointerId:1,point:[25,25],preventDefault(){}});
 ui.listeners.get('#drawCanvas:pointerup')({pointerId:1,preventDefault(){}});
 await pause(0);assert.equal(ui.strokeRequests.length,1);
 const request=ui.strokeRequests[0];
 for(const id of [request.data.strokeId,request.data.batchId])assert.match(id,/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
 assert.ok(frameContainsStroke(ui.frames.at(-1)));
 request.resolve({version:1});await pause(0);
});

test('artist stroke remains visible while the server accepts a delayed write', async () => {
 const ui = browserHarness();
 ui.receive(drawingState('artist'));
 await pause(0);
 const down = ui.listeners.get('#drawCanvas:pointerdown');
 const move = ui.listeners.get('#drawCanvas:pointermove');
 const up = ui.listeners.get('#drawCanvas:pointerup');
 down({button: 0, pointerId: 1, point: [20, 20], preventDefault() {}});
 move({pointerId: 1, point: [25, 25], preventDefault() {}});
 assert.ok(frameContainsStroke(ui.frames.at(-1)), 'the live preview shows the stroke');
 const beforeFinish = ui.frames.length;
 up({pointerId: 1, point: [25, 25], preventDefault() {}});
 await pause(250);
 assert.equal(ui.strokeRequests.length, 1, 'the write has reached the delayed server');
 assert.ok(ui.frames.slice(beforeFinish).every(frameContainsStroke), 'no repaint removes the stroke before acknowledgement');
 const posted = ui.strokeRequests[0].data;
 ui.setSnapshot({round: 1, version: 1, strokes: [{version: 1, strokeId: posted.strokeId, tool: posted.tool, color: posted.color, size: posted.size, points: posted.points}]});
 ui.strokeRequests[0].resolve({round: 1, version: 1});
 await pause(0);
 await vm.runInContext('syncCanvas()', ui.context);
 assert.ok(frameContainsStroke(ui.frames.at(-1)), 'the confirmed stroke stays visible');
 assert.equal(ui.frames.at(-1).strokes.length, 1, 'the authoritative stroke does not overlap the local draft');
 assert.equal(vm.runInContext('localStrokes.size', ui.context), 0, 'the optimistic draft is removed after acknowledgement');
});

test('undo waits for a queued stroke before sending the canvas command', async () => {
 const ui = browserHarness();
 ui.receive(drawingState('artist'));
 await pause(0);
 ui.listeners.get('#drawCanvas:pointerdown')({button: 0, pointerId: 1, point: [20, 20], preventDefault() {}});
 ui.listeners.get('#drawCanvas:pointermove')({pointerId: 1, point: [25, 25], preventDefault() {}});
 ui.listeners.get('#drawCanvas:pointerup')({pointerId: 1, point: [25, 25], preventDefault() {}});
 await pause(250);
 assert.equal(ui.strokeRequests.length, 1);
 const undo = ui.element('#undo').onclick();
 await pause(0);
 assert.equal(ui.commandRequests.length, 0, 'undo does not overtake the in-flight stroke');
 ui.listeners.get('#drawCanvas:pointerdown')({button: 0, pointerId: 2, point: [40, 40], preventDefault() {}});
 assert.equal(vm.runInContext('active', ui.context), null, 'a new stroke cannot start while undo is pending');
 const posted = ui.strokeRequests[0].data;
 ui.setSnapshot({round: 1, version: 1, strokes: [{version: 1, strokeId: posted.strokeId, tool: posted.tool, color: posted.color, size: posted.size, points: posted.points}]});
 ui.strokeRequests[0].resolve({round: 1, version: 1});
 await undo;
 assert.deepEqual(ui.commandRequests.map(item => item.command), ['undo']);
 assert.equal(ui.frames.at(-1).strokes.length, 0, 'the completed stroke is undone');
 assert.equal(vm.runInContext('localStrokes.size', ui.context), 0);
});

test('a second touch cannot steal or leave behind the first pointer stroke', async () => {
 const ui = browserHarness();ui.receive(drawingState('artist'));await pause(0);
 const down=ui.listeners.get('#drawCanvas:pointerdown'),move=ui.listeners.get('#drawCanvas:pointermove'),up=ui.listeners.get('#drawCanvas:pointerup');
 down({button:0,pointerId:1,point:[20,20],preventDefault(){}});
 move({pointerId:1,point:[25,25],preventDefault(){}});
 down({button:0,pointerId:2,point:[50,50],preventDefault(){}});
 move({pointerId:2,point:[55,55],preventDefault(){}});
 up({pointerId:2,point:[55,55],preventDefault(){}});
 assert.equal(vm.runInContext('active.pointerId',ui.context),1);
 assert.equal(vm.runInContext('localStrokes.size',ui.context),1);
 assert.ok(!ui.frames.at(-1).strokes[0].points.some(point=>point[0]===55));
 up({pointerId:1,point:[25,25],preventDefault(){}});await pause(250);
 assert.equal(ui.strokeRequests.length,1);
 const posted=ui.strokeRequests[0].data;
 ui.setSnapshot({round:1,version:1,strokes:[{version:1,strokeId:posted.strokeId,tool:posted.tool,color:posted.color,size:posted.size,points:posted.points}]});
 ui.strokeRequests[0].resolve({round:1,version:1});await vm.runInContext('sendQueue',ui.context);
 assert.equal(vm.runInContext('localStrokes.size',ui.context),0);
});

test('older wrong guesses remain visible in the guessing feed and are escaped', () => {
 const ui = browserHarness();
 const view = drawingState('guest', [
  {id: 'friend', name: '朋友', answer: '<img src=x onerror=alert(1)>', correct: false, at: Date.now() - 20_000},
  {id: 'guest', name: '猜者', answer: '小狗', correct: false, at: Date.now() - 15_000},
 ]);
 view.players.push({id: 'friend', name: '朋友', score: 0, online: true});
 view.participantIds.push('friend');
 ui.receive(view);
 const feed = ui.element('#guessFeed');
 const visible = feed.children.map(child => child.textContent).join('\n') || feed.innerHTML;
 assert.match(visible, /小狗/, 'previous guesses remain readable beyond eight seconds');
 assert.match(visible, /朋友.*(?:<img|&lt;img)/, 'other players’ wrong answers are visible');
 assert.doesNotMatch(feed.innerHTML, /<img/, 'guess text cannot create HTML elements');
});

test('chat drops only its oldest node after fifty guesses',()=>{
 const ui=browserHarness(),now=Date.now();
 const guesses=Array.from({length:50},(_,index)=>({id:'guest',name:'猜者',answer:'猜'+index,correct:false,at:now+index}));
 const view=drawingState('guest',guesses);ui.receive(view);
 const before=[...ui.element('#guessFeed').children];
 ui.receive({...view,guesses:[...guesses.slice(1),{id:'guest',name:'猜者',answer:'新猜測',correct:false,at:now+51}]});
 const after=ui.element('#guessFeed').children;
 assert.equal(after.length,50);
 assert.equal(after[0],before[1],'existing chat nodes remain instead of being announced again');
 assert.match(after.at(-1).textContent,/新猜測/);
});

test('phase scenes stay in one canvas frame without replacing the drawing canvas', async () => {
 const ui=browserHarness(),base=drawingState('guest');
 const choosing={...base,phase:'choosing',question:null,hint:null,candidates:[],deadline:Date.now()+15_000};
 ui.receive(choosing);await pause(0);
 const canvas=ui.element('#drawCanvas'),frameCount=ui.frames.length;
 assert.equal(ui.element('#boardSection').hidden,false);
 assert.match(ui.element('#canvasStage').innerHTML,/畫者正在挑題/);
 assert.doesNotMatch(ui.element('#canvasStage').innerHTML,/貓咪/,'the guessing player does not see the answer');
 ui.receive(base);await pause(0);
 assert.equal(ui.element('#canvasStage').hidden,true);
 assert.equal(ui.element('#drawCanvas'),canvas);
 assert.equal(ui.frames.length,frameCount,'entering the drawing phase does not clear or repaint the canvas');
 const reveal={...base,phase:'reveal',question:{title:'貓咪'},result:{answer:'貓咪',reason:'時間到',guessedIds:[]},deadline:Date.now()+8000};
 ui.receive(reveal);await pause(0);
 assert.match(ui.element('#canvasStage').innerHTML,/答案揭曉/);
 assert.match(ui.element('#canvasStage').innerHTML,/貓咪/);
 assert.equal(ui.element('#drawCanvas'),canvas);
 assert.equal(ui.frames.length,frameCount,'the reveal stage does not repaint the source canvas');
 ui.receive({...reveal,phase:'finished',winner:{ids:['artist'],score:0},deadline:null});
 assert.match(ui.element('#canvasStage').innerHTML,/今晚的畫猜高手/);
 assert.equal(ui.element('#drawCanvas'),canvas);
});

test('only a newly confirmed correct guess receives a local score reaction', () => {
 const ui=browserHarness(),before=drawingState('guest');
 ui.receive(before);
 const at=Date.now();
 const after={...before,serverNow:at+120,guessedIds:['guest'],guesses:[{id:'guest',name:'猜者',correct:true,points:84,at}],players:[before.players[0],{...before.players[1],score:84}]};
 ui.receive(after);
 const row=ui.element('#players').playerRows.find(item=>item.dataset.playerId==='guest');
 assert.equal(row.children.at(-1).textContent,'✓ +84 分');
 const reconnected=browserHarness();reconnected.receive(after);
 const newRow=reconnected.element('#players').playerRows.find(item=>item.dataset.playerId==='guest');
 assert.equal(newRow.children.length,0,'the first state after reconnect does not replay past reactions');
});

test('correct-guess reaction uses server time when client and server clocks differ', () => {
 const ui=browserHarness(),before=drawingState('guest');
 ui.receive(before);
 const serverNow=Date.now()-60_000;
 const after={...before,serverNow,guessedIds:['guest'],guesses:[{id:'guest',name:'猜者',correct:true,points:81,at:serverNow-100}],players:[before.players[0],{...before.players[1],score:81}]};
 ui.receive(after);
 const row=ui.element('#players').playerRows.find(item=>item.dataset.playerId==='guest');
 assert.equal(row.children.at(-1).textContent,'✓ +81 分');
});

test('a brief failed poll suppresses phase and score animations on reconnect', async () => {
 const ui=browserHarness(),before=drawingState('guest');
 ui.receive(before);await pause(0);
 await vm.runInContext('poll()',ui.context);
 assert.equal(vm.runInContext('disconnected',ui.context),true);
 const count=ui.animations.length,at=Date.now();
 const after={...before,serverNow:at+120,phase:'reveal',guessedIds:['guest'],guesses:[{id:'guest',name:'猜者',correct:true,points:80,at}],result:{answer:'貓咪',reason:'所有猜題者已完成',guessedIds:['guest']},players:[before.players[0],{...before.players[1],score:80}]};
 ui.receive(after);
 assert.equal(ui.animations.length,count,'reconnecting within five seconds does not replay the reveal transition');
 const row=ui.element('#players').playerRows.find(item=>item.dataset.playerId==='guest');
 assert.equal(row.children.length,0,'past correct guesses do not show a new score badge');
 assert.equal(vm.runInContext('disconnected',ui.context),false);
});

test('multiple guesses are public and earlier correct guesses earn more points', () => {
 let now = 1_000_000;
 const room = new DrawGuessRoom('ABC123', '朋友試玩', () => 0, () => now);
 const artist = room.add('畫者'), fast = room.add('快猜'), slow = room.add('慢猜');
 room.wordProvider = () => [0, 1, 2].map(index => ({
  id: 'custom-' + index, title: '題目' + index, aliases: [], difficulty: 'easy', category: '簡單', custom: true,
 }));
 room.configure(artist.id, {seconds: 90, customPercent: 100});
 room.start();
 const selected = room.candidates[0];
 room.act(artist.id, 'choose', {questionId: selected.id});
 for (let index = 0; index < 25; index++) {
  now += 800;
  room.act(fast.id, 'guess', {answer: '錯誤' + index});
 }
 const publicGuesses = room.view(slow.id).guesses;
 assert.equal(publicGuesses.length, 25, 'the whole round of guesses remains in the room view');
 assert.equal(publicGuesses[0].answer, '錯誤0', 'other players see earlier wrong answers');
 assert.equal(room.view(slow.id).question, null, 'the answer stays hidden while drawing');
 now += 800;
 room.act(fast.id, 'guess', {answer: selected.title});
 const fastPoints = fast.score;
 const publicCorrect = room.view(slow.id).guesses.at(-1);
 assert.equal(publicCorrect.correct, true);
 assert.equal(publicCorrect.answer, undefined, 'correct answers are never published before reveal');
 now += 20_000;
 room.act(slow.id, 'guess', {answer: selected.title});
 assert.ok(fastPoints > slow.score, 'the faster player scores more');
 assert.equal(artist.score, 30, 'the artist receives credit for both correct guesses');
});
