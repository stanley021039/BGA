const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {randomUUID,randomFillSync}=require('node:crypto');
const {rasterCanvas}=require('./raster-canvas.cjs');
const script=fs.readFileSync(path.join(__dirname,'../../public/draw.js'),'utf8');
const sharedScript=fs.readFileSync(path.join(__dirname,'../../public/shared/stroke-canvas.js'),'utf8');
const resultsScript=fs.readFileSync(path.join(__dirname,'../../public/shared/draw-results.js'),'utf8');
const motionScript=fs.readFileSync(path.join(__dirname,'../../public/shared/motion-policy.js'),'utf8');
const transportScript=fs.readFileSync(path.join(__dirname,'../../public/shared/draw-transport.js'),'utf8');
const CANVAS_EPOCH='00000000-0000-4000-8000-000000000001';
function browserHarness({realRenderer=false,events=false,rendererOptions,clock}={}) {
 const sources=[],elements = new Map(), listeners = new Map(), frames = [], animations = [], strokeRequests = [], commandRequests = [];
 const animationFrames=new Map();let frameId=0,rectReads=0;
 function pointerEvent(event,type){const converted={...event,type};if(event.point){converted.clientX=event.point[0];converted.clientY=event.point[1];}if(event.getCoalescedEvents)converted.getCoalescedEvents=()=>event.getCoalescedEvents().map(sample=>pointerEvent(sample,type));return converted;}
 let snapshot = {canvasEpoch:CANVAS_EPOCH,round: 1, version: 0, strokes: []};
 function element(selector) {
  if (!elements.has(selector)) {
   const handlers = new Map();
   const node = {
    id:/^#[\w-]+$/.test(selector)?selector.slice(1):'',
    hidden: false, open:false, value: selector === '#color' ? '#273942' : selector === '#size' ? '5' : '', checked: false,
    innerHTML: '', textContent: '', dataset: {}, style: {}, children: [], scrollHeight: 0, scrollTop: 0, clientHeight: 0,
    classList: {toggle() {}, add() {}, remove() {}},
    addEventListener(type, fn) { const handler=type.startsWith('pointer')?event=>fn(pointerEvent(event,type)):fn;handlers.set(type, handler);listeners.set(selector + ':' + type, handler); },
    getBoundingClientRect(){rectReads++;return {left:0,top:0,width:512,height:256,right:512,bottom:256};},
    setPointerCapture() {}, setAttribute() {},
    append(...children) { for (const child of children) { child.parent = this; this.children.push(child); } },
    replaceChildren(...children) { this.children = []; this.append(...children); },
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); },
    querySelector(selector) { return selector === '.feed-empty' ? this.children.find(child => child.className === 'feed-empty') || null : null; },
    querySelectorAll() { return []; },
    animate() { animations.push(selector); return {cancel() {}}; }, showModal() {this.open=true;}, close() {this.open=false;handlers.get('close')?.();}, focus() {context.document.activeElement=this;},
   };
   elements.set(selector, node);
  }
  return elements.get(selector);
 }
 const context = vm.createContext({
  window: {matchMedia: () => ({matches: false}),addEventListener(type,fn){const key='window:'+type,previous=listeners.get(key);listeners.set(key,event=>{previous?.(event);fn(event);});}},
  document: {body: element('body'),documentElement:element('html'),hidden:false,visibilityState:'visible',querySelector: element,getElementById:id=>element('#'+id),addEventListener(type,fn){const key='document:'+type,previous=listeners.get(key);listeners.set(key,event=>{previous?.(event);fn(event);});},createElement: tag => {const node=element('created:'+randomUUID());if(tag==='canvas'){Object.assign(node,rasterCanvas(512,256));node.toDataURL=()=> 'data:image/png;base64,c3ludGhldGlj';}return node;}},
  location: {pathname: '/draw/ABC123', origin: 'http://localhost:3000', search: ''},
  localStorage: {getItem: () => null, setItem() {}},
  history: {replaceState() {}}, navigator: {clipboard: {writeText: async () => {}}},
  URLSearchParams, setTimeout:clock?.setTimeout||setTimeout, clearTimeout:clock?.clearTimeout||clearTimeout, setInterval: () => 0, clearInterval: () => {},
  requestAnimationFrame:fn=>{const id=++frameId;animationFrames.set(id,fn);return id;},cancelAnimationFrame:id=>animationFrames.delete(id),
  Date:clock?.Date||Date,...(clock?{performance:{now:clock.now}}:{}),AbortController,DOMException,crypto: {getRandomValues: bytes=>randomFillSync(bytes)}, confirm: () => true,
  fetch: async route => ({json: async () => route === '/api/info' ? {preferred: null} : {}}),
  RoomHost: {update() {}, kicked() {}}, RoomReconnect: {restore: async () => null},
  GameShell: {settingsActions:()=>'<button class="room-settings-save" data-do="settings">儲存房間設定</button>',playerRow:(p,{status=''})=>`<div class="room-player player" data-player-id="${p.id}"><div class="room-player-avatar"></div><small>${status}</small></div>`,stableMarkup(node, html) {
   if(node._gameMarkup===html)return;node._gameMarkup=html;
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
   async request(route, data, options) {
    if (route === 'draw/canvas') return JSON.parse(JSON.stringify(snapshot));
    if (route === 'draw/stroke') return new Promise((resolve,reject) => {strokeRequests.push({data, resolve,reject,signal:options?.signal,startedAt:clock?.now()??Date.now()});options?.signal?.addEventListener('abort',()=>reject(options.signal.reason),{once:true});});
    if (route === 'draw/command') {
     commandRequests.push(data);
     return {canvasEpoch:snapshot.canvasEpoch,round: snapshot.round, version: snapshot.version + 1, strokes: []};
    }
    throw Error('Unexpected API call: ' + route);
   },
  },
 });
 Object.assign(element('#drawResultCanvas'),rasterCanvas(512,256));Object.assign(element('#stagePreview'),rasterCanvas(512,256));
 if(realRenderer){const raster=rasterCanvas(512,256);Object.assign(element('#drawCanvas'),raster);}
 if(events){class EventSource{constructor(){this.handlers=new Map();sources.push(this);}addEventListener(type,fn){this.handlers.set(type,fn);}close(){}emit(type,data){this.handlers.get(type)?.({data:JSON.stringify(data)});}}context.EventSource=EventSource;context.window.EventSource=EventSource;}
 vm.runInContext(sharedScript,context);
 if(realRenderer){context.StrokeCanvas=context.window.StrokeCanvas;context.StrokeCanvas.pointFrom=event=>event.point;if(rendererOptions){const factory=context.StrokeCanvas.createRenderer;context.StrokeCanvas.createRenderer=(canvas,options)=>factory(canvas,{...options,...rendererOptions});}}
 context.StrokeCanvas.strokeId=context.window.StrokeCanvas.strokeId;
 vm.runInContext(motionScript,context,{filename:'public/shared/motion-policy.js'});
 vm.runInContext(resultsScript,context,{filename:'public/shared/draw-results.js'});
 vm.runInContext(transportScript,context,{filename:'public/shared/draw-transport.js'});
 vm.runInContext(script, context, {filename: 'public/draw.js'});
 function receive(state) {
  context.injectedState = state;
  vm.runInContext('session={code:"ABC123"};receive(injectedState)', context);
 }
 return {context, element, listeners, sources,frames, animations, strokeRequests, commandRequests, receive, setSnapshot(value) { snapshot = value; },paintFrame(){const jobs=[...animationFrames.values()];animationFrames.clear();for(const job of jobs)job(clock?.now()??Date.now());},pendingFrames:()=>animationFrames.size,rectReads:()=>rectReads};
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
  canvasEpoch:CANVAS_EPOCH,strokeVersion: 0, events: [],
 };
}

module.exports={browserHarness,drawingState,CANVAS_EPOCH};
