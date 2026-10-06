const vm=require('node:vm');
const {webcrypto}=require('node:crypto');
class Field{constructor(){this.value='';this.checked=false;this.disabled=false;}}
class Element{
 constructor(id=''){this.id=id;this.value='';this.textContent='';this.innerHTML='';this.disabled=false;this.hidden=false;this.checked=false;this.dataset={};this.classList={toggle(){}};this.elements={targetDate:new Field(),confirmed:new Field(),returnPct:new Field(),reason:new Field()};}
 setAttribute(){}addEventListener(){}querySelectorAll(){return [];}focus(){}close(){this.open=false;}showModal(){this.open=true;}
}
// Execute the shipped client. The DOM stub supplies controls, not voting logic;
// inspection is injected only into this VM and is absent from the browser bundle.
async function createClient({source,rules,fetch}){
 const nodes=new Map(),tabs=['daily','records','admin'].map(view=>{const element=new Element(view);element.dataset.view=view;return element;});
 const document={activeElement:{},visibilityState:'visible',querySelector(selector){if(selector==='[data-view=admin]')return tabs[2];if(!nodes.has(selector))nodes.set(selector,new Element(selector));return nodes.get(selector);},querySelectorAll(selector){return selector==='[data-view]'?tabs:[];}};
 const context={document,MarketRules:rules,fetch,crypto:webcrypto,Uint8Array,Intl,Date,performance:{now:()=>0},location:{hash:'',href:''},setInterval(){},addEventListener(){},structuredClone};context.window=context;
 const bootstrap='load().catch(error=>{uncertain=true;message(error.message,true);});';
 if(!source.includes(bootstrap))throw Error('Frontend test bootstrap anchor missing');
 vm.runInNewContext(source.replace(bootstrap,'globalThis.__inspect=()=>({draft:structuredClone(draft),busy,uncertain,state:structuredClone(state)});globalThis.__ready = '+bootstrap),context,{filename:'market.js'});await context.__ready;
 if(context.__inspect().uncertain)throw Error('Fixture UI failed: '+document.querySelector('#message').textContent);
 return {node:selector=>document.querySelector(selector),inspect:()=>context.__inspect(),choose(optionId){document.querySelector('#options').onchange({target:{name:'optionId',value:optionId}});},submit(){document.querySelector('#voteForm').onsubmit({preventDefault(){}});},refresh(){return document.querySelector('#refresh').onclick();}};
}
async function waitFor(predicate){for(let i=0;i<100;i++){if(predicate())return;await new Promise(resolve=>setImmediate(resolve));}throw Error('Synthetic async condition did not settle');}
function deferred(){let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};}
// Real SQLite writes and reads; delays happen after a response snapshot exists.
function makeTransport(store,user,events,delay){return async(url,options={})=>{
 const method=options.method||'GET',input=options.body?JSON.parse(options.body):null;let body,status=200;
 try{body=method==='POST'?store.vote(user,input):store.view(user);}catch(error){status=error.status||400;body={code:error.code,error:error.message};}
 const event={method,optionId:input?.optionId,expectedRevision:input?.expectedRevision,status,code:body.code};events.push(event);
 const serialized=JSON.stringify(body);if(delay)await delay(event);return new Response(serialized,{status,headers:{'Content-Type':'application/json'}});
};}
module.exports={createClient,waitFor,deferred,makeTransport};
