'use strict';
// Usage: node tools/convert-quacks-stop-settlement.cjs ffmpeg.exe stop.mp3 settlement.mp3
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{spawnSync}=require('child_process');
const [ffmpeg,stop,settlement]=process.argv.slice(2);if(!ffmpeg||!stop||!settlement)throw Error('Supply ffmpeg, stop.mp3 and settlement.mp3');
const dir=path.resolve(__dirname,'../public/assets/game-sounds'),manifest=JSON.parse(fs.readFileSync(path.join(dir,'quacks-manifest.json')));
for(const [key,source,label]of [['stop',stop,'不抽了.mp3'],['settlement',settlement,'結算.mp3']]){
 const r=spawnSync(ffmpeg,['-v','error','-i',source,'-af','highpass=f=60,lowpass=f=6500','-ar','24000','-ac','1','-f','s16le','pipe:1'],{maxBuffer:4*1024*1024});if(r.status!==0)throw Error(String(r.stderr));const pcm=r.stdout,frames=pcm.length/2;if(!frames||frames>24000*10)throw Error('Empty or over-ten-second source');let peak=0;for(let i=0;i<frames;i++)peak=Math.max(peak,Math.abs(pcm.readInt16LE(i*2)));if(!peak)throw Error('Silent source');
 const bytes=Buffer.alloc(44+pcm.length);bytes.write('RIFF');bytes.writeUInt32LE(bytes.length-8,4);bytes.write('WAVEfmt ',8);bytes.writeUInt32LE(16,16);bytes.writeUInt16LE(1,20);bytes.writeUInt16LE(1,22);bytes.writeUInt32LE(24000,24);bytes.writeUInt32LE(48000,28);bytes.writeUInt16LE(2,32);bytes.writeUInt16LE(16,34);bytes.write('data',36);bytes.writeUInt32LE(pcm.length,40);
 for(let i=0;i<frames;i++)bytes.writeInt16LE(Math.round(pcm.readInt16LE(i*2)*(.35*32767/peak)*Math.max(0,Math.min(1,i/240,(frames-1-i)/720))),44+i*2);
 const file='quacks-'+key+'-user.wav';fs.writeFileSync(path.join(dir,file),bytes);manifest[key+'User']={file,durationMs:Math.ceil(frames/24),bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),source:'User-supplied '+label,sourceSha256:crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex'),peakTarget:.35,fadeInMs:10,fadeOutMs:30,lowpassHz:6500,generator:'tools/convert-quacks-stop-settlement.cjs'};
}
fs.writeFileSync(path.join(dir,'quacks-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({stop:manifest.stopUser.durationMs,settlement:manifest.settlementUser.durationMs}));
