const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const directory=path.join(__dirname,'../public/assets/game-sounds'),expected={turn:320,correct:220,'dice-roll':650,shot:280,slam:350,nitro:500,skid:480};
test('the seven adopted cues match manifest digests, PCM lengths and bounded peaks with faded edges',()=>{
 const manifest=JSON.parse(fs.readFileSync(path.join(directory,'manifest.json'),'utf8'));assert.deepEqual(Object.keys(manifest.cues).sort(),Object.keys(expected).sort());
 for(const [cue,durationMs]of Object.entries(expected)){
  const entry=manifest.cues[cue],data=fs.readFileSync(path.join(directory,entry.file));assert.equal(entry.file,cue+'.wav');assert.equal(entry.durationMs,durationMs);assert.equal(entry.sha256,crypto.createHash('sha256').update(data).digest('hex'));assert.equal(entry.bytes,data.length);
  assert.equal(data.toString('ascii',0,4),'RIFF');assert.equal(data.readUInt32LE(4),data.length-8);assert.equal(data.toString('ascii',8,16),'WAVEfmt ');assert.equal(data.readUInt32LE(16),16);assert.equal(data.readUInt16LE(20),1);assert.equal(data.readUInt16LE(22),1);assert.equal(data.readUInt32LE(24),24000);assert.equal(data.readUInt16LE(34),16);assert.equal(data.toString('ascii',36,40),'data');assert.equal(data.readUInt32LE(40),durationMs*48);assert.equal(data.length,44+durationMs*48);
  let peak=0;for(let i=44;i<data.length;i+=2)peak=Math.max(peak,Math.abs(data.readInt16LE(i))/32768);assert.ok(peak>0&&peak<=.3,cue+' peak');assert.ok(Math.abs(data.readInt16LE(44))<=1);assert.ok(Math.abs(data.readInt16LE(data.length-2))<=1);assert.ok(entry.source);assert.ok(entry.license);assert.ok(entry.author);assert.ok(entry.changes);
 }
});
test('game cue controllers and WAV routes are served exactly, unrelated files remain inaccessible',async()=>{
 const {createApp}=require('../src/app'),temp=fs.mkdtempSync(path.join(os.tmpdir(),'bga-game-cue-http-'));
 const app=createApp({port:0,host:'127.0.0.1',dbFile:path.join(temp,'db.sqlite'),historyDir:path.join(temp,'history'),communityDir:path.join(temp,'community'),musicDir:path.join(temp,'music'),externalSideEffectsEnabled:false});
 try{const {port}=await app.listen(),base='http://127.0.0.1:'+port;
  for(const file of ['shared/game-sounds.js','shared/race-game-sounds.js',...Object.keys(expected).map(cue=>'assets/game-sounds/'+cue+'.wav')]){const response=await fetch(base+'/'+file);assert.equal(response.status,200,file);assert.match(response.headers.get('content-type'),file.endsWith('.wav')?/audio\/wav/:/javascript/);assert.deepEqual(Buffer.from(await response.arrayBuffer()),fs.readFileSync(path.join(__dirname,'../public',file)));}
  for(const file of ['assets/game-sounds/missing.wav','assets/game-sounds/manifest.json','assets/game-sounds/sources/confirmation_001.wav'])assert.equal((await fetch(base+'/'+file)).status,404);
 }finally{await app.close();const resolved=path.resolve(temp);assert.ok(resolved.startsWith(path.resolve(os.tmpdir())+path.sep)&&path.basename(resolved).startsWith('bga-game-cue-http-'));fs.rmSync(resolved,{recursive:true,force:true,maxRetries:5});}
});
