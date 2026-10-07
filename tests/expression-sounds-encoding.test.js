const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../public/shared/expression-sounds.js'),'utf8');
function buffer(channels,rate=24000,duration=999){return {sampleRate:rate,length:channels[0].length,numberOfChannels:channels.length,duration,getChannelData:index=>channels[index]};}
function fixture(decoded){const calls=[];class OfflineAudioContext{constructor(...args){calls.push(args);}async decodeAudioData(input){calls.push(input.byteLength);if(decoded instanceof Error)throw decoded;return decoded;}}const window={OfflineAudioContext},context={window,document:{},btoa:value=>Buffer.from(value,'binary').toString('base64')};vm.runInNewContext(source,context);return {api:window.ExpressionSounds,calls};}
test('encoding uses a standard 44-byte 24000 Hz mono PCM16 WAV and averages channels without trusting duration',()=>{
 const {api}=fixture(),bytes=api.encodePCM(buffer([new Float32Array([-1,1,.5,0]),new Float32Array([-1,1,-.5,2])],24000,600)),wav=Buffer.from(bytes);
 assert.equal(wav.length,52);assert.equal(wav.toString('ascii',0,4),'RIFF');assert.equal(wav.readUInt32LE(4),44);assert.equal(wav.toString('ascii',8,16),'WAVEfmt ');assert.equal(wav.readUInt32LE(16),16);assert.equal(wav.readUInt16LE(20),1);assert.equal(wav.readUInt16LE(22),1);assert.equal(wav.readUInt32LE(24),24000);assert.equal(wav.readUInt32LE(28),48000);assert.equal(wav.readUInt16LE(32),2);assert.equal(wav.readUInt16LE(34),16);assert.equal(wav.toString('ascii',36,40),'data');assert.equal(wav.readUInt32LE(40),8);assert.deepEqual(Array.from({length:4},(_,n)=>wav.readInt16LE(44+n*2)),[-32768,32767,0,32767]);
});
test('real decoded sample count enforces ten seconds and canonical bytes fit the server cap',()=>{
 const {api}=fixture();assert.equal(api.encodePCM(buffer([new Float32Array(240000)],24000,.1)).length,480044);
 assert.throws(()=>api.encodePCM(buffer([new Float32Array(240001)],24000,1)),/10 秒/);
 assert.throws(()=>api.encodePCM(buffer([new Float32Array(480000)],48000,10)),/轉換/);
 assert.throws(()=>api.encodePCM(buffer([new Float32Array([NaN])])),/資料/);assert.throws(()=>api.encodePCM(buffer([new Float32Array(0)])),/轉換/);
});
test('file import decodes in a 24000 Hz offline context and sends only canonical encoded samples',async()=>{
 const f=fixture(buffer([new Float32Array(24000),new Float32Array(24000)],24000,900));const result=await f.api.encodeFile({size:5,arrayBuffer:async()=>new ArrayBuffer(5)}),wav=Buffer.from(result.base64,'base64');
 assert.deepEqual(f.calls[0],[1,1,24000]);assert.equal(f.calls[1],5);assert.equal(result.durationMs,1000);assert.equal(wav.length,48044);assert.equal(wav.readUInt32LE(24),24000);
});
test('oversized, undecodable and overlong files fail without trimming or trusting MIME or declared duration',async()=>{
 const f=fixture(buffer([new Float32Array(240001)],24000,1));let reads=0;
 await assert.rejects(f.api.encodeFile({size:10*1024*1024+1,arrayBuffer:async()=>{reads++;return new ArrayBuffer(1);}}),/10 MB/);assert.equal(reads,0);
 await assert.rejects(f.api.encodeFile({size:2,type:'audio/wav',arrayBuffer:async()=>new ArrayBuffer(2)}),/10 秒/);
 const failed=fixture(new Error('sensitive decoder details'));await assert.rejects(failed.api.encodeFile({size:2,arrayBuffer:async()=>new ArrayBuffer(2)}),error=>/瀏覽器支援/.test(error.message)&&!error.message.includes('sensitive'));
 const bytes=fixture(buffer([new Float32Array(2)]));await assert.rejects(bytes.api.encodeFile({size:1,arrayBuffer:async()=>new ArrayBuffer(10*1024*1024+1)}),/無法讀取/);
});
