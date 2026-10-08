const vm=require('node:vm');
const {webcrypto}=require('node:crypto');
class Field{constructor(){this.value='';this.checked=false;this.disabled=false;}}
class Element{
 constructor(id=''){this.id=id;this.value='';this.textContent='';this._html='';this.inputs=[];this.disabled=false;this.hidden=false;this.checked=false;this.open=false;this.dataset={};this.attributes={};this.listeners={};this.classes=new Set();this.classList={toggle:(name,on)=>{if(on)this.classes.add(name);else this.classes.delete(name);}};this.elements={targetDate:new Field(),confirmed:new Field(),returnPct:new Field(),reason:new Field(),isOpen:new Field(),sourceUrl:new Field()};}
 set innerHTML(html){this._html=html;this.inputs=[...html.matchAll(/<input\b([^>]*)>/g)].map(match=>{const field=new Element();for(const attribute of match[1].matchAll(/([\w-]+)(?:="([^"]*)")?/g)){const [_,key,value]=attribute;if(['checked','disabled','required'].includes(key))field[key]=true;else if(value!==undefined)field[key]=value;}field.focus=()=>{if(this.ownerDocument)this.ownerDocument.activeElement=field;};return field;});
 this.buttons=[...html.matchAll(/<button\b[^>]*data-preview-option="([^"]+)"[^>]*>/g)].map(match=>{const button=new Element();button.dataset.previewOption=match[1];button.focus=()=>{if(this.ownerDocument)this.ownerDocument.activeElement=button;};return button;});
 }
 get innerHTML(){return this._html;}
 removeAttribute(name){delete this.attributes[name];delete this[name];}
 getClientRects(){return this.hidden?[]:[this.getBoundingClientRect()];}
 getBoundingClientRect(){return {left:20,top:20,right:620,bottom:500};}
 closest(selector){return selector==='[data-preview-option]'&&this.dataset.previewOption?this:null;}
 setAttribute(name,value){this.attributes[name]=value;}
 addEventListener(name,listener){(this.listeners[name]||=[]).push(listener);}
 dispatch(name,event={}){for(const listener of this.listeners[name]||[])listener(event);}
 querySelectorAll(selector){if(selector==='[data-preview-option]')return this.buttons||[];return selector==='input:checked'?this.inputs.filter(input=>input.checked):selector==='input'?this.inputs:[];}
 focus(){}close(){this.open=false;this.dispatch('close');}showModal(){this.open=true;}
}
// Execute the shipped client. These DOM/decoder stubs supply browser controls,
// not voting, draw, approval or upload logic. Inspection exists only in this VM.
async function createClient({source,rules,fetch,hash='',allowFailure=false,gameUI,curve=require('../../public/market-curve')}){
 const nodes=new Map(),tabs=['daily','uploads','records','marketHistory','leaderboard','admin'].map(view=>{const element=new Element(view);element.dataset.view=view;return element;});
 const document={activeElement:{},visibilityState:'visible',querySelector(selector){if(selector==='[data-view=admin]')return tabs.find(tab=>tab.dataset.view==='admin');if(!nodes.has(selector)){const element=new Element(selector);element.ownerDocument=document;element.focus=()=>{document.activeElement=element;};nodes.set(selector,element);}return nodes.get(selector);},querySelectorAll(selector){if(selector==='[data-view]')return tabs;const selectors=selector.split(',');return selectors.flatMap(part=>{const match=part.trim().match(/^(#[\w]+) input$/);return match?document.querySelector(match[1]).inputs:[];});}};
 const intervals=new Map(),listeners={},decoded=new Map(),imageLoads=[];let elapsed=0;
 class FileReader{readAsDataURL(file){const url=file.dataURL||'data:'+file.type+';base64,'+Buffer.from(file.bytes||'synthetic-image').toString('base64');decoded.set(url,file);Promise.resolve(file.readGate).then(()=>{if(file.readError){this.onerror?.();return;}this.result=url;this.onload?.();});}}
 class Image{set src(url){imageLoads.push(url);const file=decoded.get(url)||{};Promise.resolve(file.decodeGate).then(()=>{if(file.decodeError){this.onerror?.();return;}this.naturalWidth=file.width||32;this.naturalHeight=file.height||32;this.onload?.();});}}
 const context={document,MarketRules:rules,MarketCurve:curve,GameUI:gameUI,fetch,crypto:webcrypto,Uint8Array,Intl,Date,Set,URL,FileReader,Image,encodeURIComponent,performance:{now:()=>elapsed},location:{hash,href:''},setInterval(callback,delay){intervals.set(delay,callback);},addEventListener(name,listener){(listeners[name]||=[]).push(listener);},structuredClone};context.window=context;
 const bootstrap='load().catch(error=>{uncertain=true;message(error.message,true);});';
 if(!source.includes(bootstrap))throw Error('Frontend test bootstrap anchor missing');
 const inspect="globalThis.__inspect=()=>({draft:structuredClone(draft),busy,uncertain,state:structuredClone(state),draw:typeof drawState==='undefined'?null:structuredClone(drawState),gallery:typeof gallery==='undefined'?null:structuredClone(gallery)});globalThis.__ready = ";
 vm.runInNewContext(source.replace(bootstrap,inspect+bootstrap),context,{filename:'market.js'});await context.__ready;
 if(context.__inspect().uncertain&&!allowFailure)throw Error('Fixture UI failed: '+document.querySelector('#message').textContent);
 const node=selector=>document.querySelector(selector);
 return {node,imageLoads,resize(){for(const listener of listeners.resize||[])listener();},active:()=>document.activeElement,pagehide(){for(const listener of listeners.pagehide||[])listener();},inspect:()=>context.__inspect(),choose(optionId){node('#options').onchange({target:{name:'optionId',value:optionId}});},submit(){node('#voteForm').onsubmit({preventDefault(){}});},refresh(){return node('#refresh').onclick();},view(view){context.location.hash='#'+view;for(const listener of listeners.hashchange||[])listener();},round(id){node('#roundSelect').value=id;node('#roundSelect').onchange();},tick(delay){elapsed+=delay;return intervals.get(delay)?.();},check(selector,values){for(const input of node(selector).inputs)input.checked=values.map(String).includes(input.value);return node(selector).onchange?.({target:{}});},async file(file){node('#uploadFile').files=file?[file]:[];return node('#uploadFile').onchange();},upload(){return node('#uploadForm').onsubmit({preventDefault(){}});},cancelApproval(){const event={prevented:false,preventDefault(){this.prevented=true;}};node('#approvalDialog').dispatch('cancel',event);if(!event.prevented)node('#approvalDialog').open=false;return event;}};
}
async function waitFor(predicate){for(let i=0;i<100;i++){if(predicate())return;await new Promise(resolve=>setImmediate(resolve));}throw Error('Synthetic async condition did not settle');}
function deferred(){let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};}
// Real SQLite vote writes and reads. Gallery requests are isolated and never
// counted or dispatched as votes by existing vote-race regressions.
function makeTransport(store,user,events,delay){return async(url,options={})=>{
 if(url==='/api/market/images/draw'&&options.method==='POST'){const input=JSON.parse(options.body);return Response.json({targetDate:input.targetDate,images:{}});}
 if(url==='/api/market/images/mine'&&(!options.method||options.method==='GET'))return Response.json({images:[],limits:{}});
 const method=options.method||'GET',input=options.body?JSON.parse(options.body):null;let body,status=200;
 try{if(method==='POST'&&url==='/api/market/vote')body=store.vote(user,input);else if(method==='GET'&&['/api/market','/api/admin/market'].includes(url))body=store.view(user,url.startsWith('/api/admin'));else throw Error('Unexpected test transport path: '+url);}catch(error){status=error.status||400;body={code:error.code,error:error.message};}
 const event={method,optionId:input?.optionId,expectedRevision:input?.expectedRevision,status,code:body.code};events.push(event);
 const serialized=JSON.stringify(body);if(delay)await delay(event);return new Response(serialized,{status,headers:{'Content-Type':'application/json'}});
};}
module.exports={createClient,waitFor,deferred,makeTransport};
