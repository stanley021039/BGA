'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {HttpError}=require('../src/http/errors');
const {BUILTIN_FRAME_OPTIONS,normalizeBuiltinFrameId,builtinFrameDescriptor}=require('../src/barrage/builtins');

test('older senders without a frame receive the same default descriptor as an explicit choice',()=>{
 const canonical=builtinFrameDescriptor('default');
 for(const legacy of [undefined,null]){
  assert.equal(normalizeBuiltinFrameId(legacy),'default');assert.equal(builtinFrameDescriptor(legacy),canonical);
 }
 assert.equal(builtinFrameDescriptor(),canonical);assert.deepEqual(canonical,{kind:'builtin',id:'default',version:1});
});

test('only exact primitive builtin IDs are accepted without coercion or trimming',()=>{
 const invalid=['',0,1,true,false,NaN,Infinity,[],['paper'],{},new String('paper'),'Paper',' paper','paper ','__proto__','constructor','toString','url(https://example.com/frame.png)','https://example.com/frame.png','border: 1px solid red','data:image/svg+xml,<svg/>','paper\n','paper\u0000','x'.repeat(1024*1024)];
 let coerced=false;invalid.push({toString(){coerced=true;return 'paper';},valueOf(){coerced=true;return 'paper';}});
 for(const input of invalid)for(const accept of [normalizeBuiltinFrameId,builtinFrameDescriptor]){
  assert.throws(()=>accept(input),error=>error instanceof HttpError&&error.status===400&&error.code==='INVALID_BARRAGE_FRAME'&&!error.message.includes('example.com'));
 }
 assert.equal(coerced,false,'validation must not invoke client-controlled coercion');
});

test('catalog callers cannot modify the allowlist or published labels and descriptors',()=>{
 assert.deepEqual(BUILTIN_FRAME_OPTIONS.map(option=>option.id),['default','paper','comic','pixel']);
 assert.ok(Object.isFrozen(BUILTIN_FRAME_OPTIONS));assert.throws(()=>BUILTIN_FRAME_OPTIONS.push({id:'unsafe',label:'自訂'}),TypeError);
 const snapshots=BUILTIN_FRAME_OPTIONS.map(({id,label})=>({id,label}));
 for(const option of BUILTIN_FRAME_OPTIONS){
  assert.ok(Object.isFrozen(option));assert.throws(()=>{option.id='unsafe';},TypeError);
  const descriptor=builtinFrameDescriptor(option.id);assert.ok(Object.isFrozen(descriptor));assert.equal(builtinFrameDescriptor(option.id),descriptor);
  assert.throws(()=>{descriptor.url='https://example.com';},TypeError);assert.throws(()=>{descriptor.version=99;},TypeError);
  assert.deepEqual(Object.keys(descriptor),['kind','id','version']);assert.equal(JSON.stringify(descriptor),JSON.stringify({kind:'builtin',id:option.id,version:1}));
 }
 assert.deepEqual(BUILTIN_FRAME_OPTIONS,snapshots);assert.throws(()=>normalizeBuiltinFrameId('unsafe'),{code:'INVALID_BARRAGE_FRAME'});
});

test('changing a later selection leaves the earlier confirmed message style untouched',()=>{
 const sent={frame:builtinFrameDescriptor('paper')},next=builtinFrameDescriptor('comic');
 assert.notEqual(sent.frame,next);assert.equal(sent.frame.id,'paper');assert.equal(next.id,'comic');
 assert.throws(()=>{sent.frame.id=next.id;},TypeError);assert.equal(sent.frame,builtinFrameDescriptor('paper'));
 for(const option of BUILTIN_FRAME_OPTIONS)assert.equal(normalizeBuiltinFrameId(option.id),option.id);
});
