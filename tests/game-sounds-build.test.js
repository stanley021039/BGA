const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const script=path.join(__dirname,'../scripts/build-game-sounds.cjs'),source=fs.readFileSync(script,'utf8');
function check(change){const shim={...fs,readFileSync(file,...args){const bytes=fs.readFileSync(file,...args);return change(String(file),bytes);},writeFileSync(){throw Error('Check must be read-only');},mkdirSync(){throw Error('Check must not create directories');}};vm.runInNewContext(source,{Buffer,require:name=>name==='node:fs'?shim:require(name),__filename:script,__dirname:path.dirname(script),process:{argv:['node',script,'--check']},console:{log(){}}},{filename:script});}
test('offline asset checks accept Git CRLF conversion of text manifest while keeping WAV verification exact',()=>{
 assert.doesNotThrow(()=>check((file,bytes)=>file.endsWith('manifest.json')?Buffer.from(bytes.toString('utf8').replace(/\r\n/g,'\n').replace(/\n/g,'\r\n')):bytes));
});
test('newline compatibility cannot mask modified manifest data or damaged audio bytes',()=>{
 assert.throws(()=>check((file,bytes)=>file.endsWith('manifest.json')?Buffer.from(bytes.toString('utf8').replace('"durationMs": 320','"durationMs": 321')):bytes),/Generated asset differs: manifest.json/);
 assert.throws(()=>check((file,bytes)=>{if(file.endsWith('shot.wav')){const changed=Buffer.from(bytes);changed[100]^=1;return changed;}return bytes;}),/Generated asset differs: shot.wav/);
});
