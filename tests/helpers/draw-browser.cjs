const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {randomUUID,randomFillSync}=require('node:crypto');
const {rasterCanvas}=require('./raster-canvas.cjs');
const script=fs.readFileSync(path.join(__dirname,'../../public/draw.js'),'utf8');
const sharedScript=fs.readFileSync(path.join(__dirname,'../../public/shared/stroke-canvas.js'),'utf8');
function browserHarness({realRenderer=false,events=false}={}) {
 const sources=[],elements = new Map(), listeners = new Map(), frames = [], animations = [], strokeRequests = [], commandRequests = [];
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
   createRenderer() {
    let signature='';
    return {
     reset(){signature='';frames.push({strokes:[],preview:null});},
     render(strokes,{keys}={}){const next=JSON.stringify(keys||strokes);if(next===signature)return false;signature=next;frames.push(JSON.parse(JSON.stringify({strokes,preview:null})));return true;},
    };
   },
  },
  RoomApi: {
   async request(route, data) {
    if (route === 'draw/canvas') return JSON.parse(JSON.stringify(snapshot));
    if (route === 'draw/stroke') return new Promise((resolve,reject) => strokeRequests.push({data, resolve,reject}));
    if (route === 'draw/command') {
     commandRequests.push(data);
     return {round: 1, version: snapshot.version + 1, strokes: []};
    }
    throw Error('Unexpected API call: ' + route);
   },
  },
 });
 if(realRenderer){const raster=rasterCanvas(512,256);Object.assign(element('#drawCanvas'),raster);element('#stagePreview').getContext=()=>({clearRect(){},drawImage(){}});}
 if(events){class EventSource{constructor(){this.handlers=new Map();sources.push(this);}addEventListener(type,fn){this.handlers.set(type,fn);}close(){}emit(type,data){this.handlers.get(type)?.({data:JSON.stringify(data)});}}context.EventSource=EventSource;context.window.EventSource=EventSource;}
 vm.runInContext(sharedScript,context);
 if(realRenderer){context.StrokeCanvas=context.window.StrokeCanvas;context.StrokeCanvas.pointFrom=event=>event.point;}
 context.StrokeCanvas.strokeId=context.window.StrokeCanvas.strokeId;
 vm.runInContext(script, context, {filename: 'public/draw.js'});
 function receive(state) {
  context.injectedState = state;
  vm.runInContext('session={code:"ABC123"};receive(injectedState)', context);
 }
 return {context, element, listeners, sources,frames, animations, strokeRequests, commandRequests, receive, setSnapshot(value) { snapshot = value; }};
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

module.exports={browserHarness,drawingState};
