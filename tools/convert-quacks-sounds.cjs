
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const [ffmpeg,cardSource,ingredientSource]=process.argv.slice(2);
if(!ffmpeg||!cardSource||!ingredientSource)throw Error('Usage: node tools/convert-quacks-sounds.cjs ffmpeg card.mp3 ingredient.mp3');
const dir=path.resolve(__dirname,'../public/assets/game-sounds'),manifest=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../public/assets/game-sounds/quacks-manifest.json'),'utf8'));
for(const [kind,source,start,ms,cutoff,level]of [['card',cardSource,.04,1500,1800,.23],['ingredient',ingredientSource,10.8,650,2800,.40]]){
 const r=spawnSync(ffmpeg,['-v','error','-ss',String(start),'-i',source,'-t',String(ms/1000),'-af','highpass=f=65,lowpass=f='+cutoff,'-ac','1','-ar','24000','-f','s16le','pipe:1'],{maxBuffer:1024*1024});
 if(r.status!==0)throw Error(String(r.stderr));const pcm=r.stdout,frames=ms*24;let inputPeak=0;
 for(let i=0;i<pcm.length;i+=2)inputPeak=Math.max(inputPeak,Math.abs(pcm.readInt16LE(i)));
 if(!inputPeak)throw Error('Silent source');const gain=level*32767/inputPeak,bytes=Buffer.alloc(44+frames*2);
 bytes.write('RIFF');bytes.writeUInt32LE(bytes.length-8,4);bytes.write('WAVEfmt ',8);bytes.writeUInt32LE(16,16);bytes.writeUInt16LE(1,20);bytes.writeUInt16LE(1,22);bytes.writeUInt32LE(24000,24);bytes.writeUInt32LE(48000,28);bytes.writeUInt16LE(2,32);bytes.writeUInt16LE(16,34);bytes.write('data',36);bytes.writeUInt32LE(frames*2,40);
 let peak=0;for(let i=0;i<frames;i++){const sample=i*2<pcm.length?pcm.readInt16LE(i*2):0,fade=Math.min(1,i/240,(frames-1-i)/1440),n=Math.round(sample*gain*Math.max(0,fade));bytes.writeInt16LE(n,44+i*2);peak=Math.max(peak,Math.abs(n));}
 const file='quacks-'+kind+'.wav';fs.writeFileSync(path.join(dir,file),bytes);
 manifest[kind]={file,durationMs:ms,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),peak,source:'User-supplied '+(kind==='card'?'抽卡.mp3':'抽藥.mp3'),sourceSha256:crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex'),trimStartSeconds:start,lowpassHz:cutoff,peakTarget:level,fadeInMs:10,fadeOutMs:60,generator:'tools/convert-quacks-sounds.cjs'};
}
fs.writeFileSync(path.join(dir,'quacks-manifest.json'),JSON.stringify(manifest,null,2)+'\n');console.log(JSON.stringify(manifest,null,2));
