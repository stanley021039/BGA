'use strict';
const fs=require('fs'),path=require('path');
const sampleRate=22050,count=Math.floor(sampleRate*.84),out=Buffer.alloc(44+count*2);
out.write('RIFF');out.writeUInt32LE(36+count*2,4);out.write('WAVEfmt ',8);out.writeUInt32LE(16,16);out.writeUInt16LE(1,20);out.writeUInt16LE(1,22);out.writeUInt32LE(sampleRate,24);out.writeUInt32LE(sampleRate*2,28);out.writeUInt16LE(2,32);out.writeUInt16LE(16,34);out.write('data',36);out.writeUInt32LE(count*2,40);
let seed=87126,brown=0;
for(let i=0;i<count;i++){seed=(1664525*seed+1013904223)>>>0;const t=i/sampleRate,noise=seed/2147483648-1;brown=.83*brown+.17*noise;const envelope=Math.min(1,t/.008)*Math.exp(-t*6.4),bass=Math.sin(2*Math.PI*(76*t-21*t*t));const v=Math.tanh((brown*3.2+bass*.7+noise*.18)*envelope)*.69;out.writeInt16LE(Math.round(v*32767),44+i*2);}
fs.writeFileSync(path.join(__dirname,'../public/assets/game-sounds/quacks-explosion.wav'),out);


// User-supplied card/ingredient cues are built separately by convert-quacks-sounds.cjs.

// Original 600 ms glug: four low liquid bubbles, faded filtered noise; no source recording.
const crypto=require('node:crypto'),frames=14400,rate=24000,potion=Buffer.alloc(44+frames*2);
potion.write('RIFF');potion.writeUInt32LE(potion.length-8,4);potion.write('WAVEfmt ',8);potion.writeUInt32LE(16,16);potion.writeUInt16LE(1,20);potion.writeUInt16LE(1,22);potion.writeUInt32LE(rate,24);potion.writeUInt32LE(rate*2,28);potion.writeUInt16LE(2,32);potion.writeUInt16LE(16,34);potion.write('data',36);potion.writeUInt32LE(frames*2,40);
let rng=83119,low=0,peak=0;
for(let i=0;i<frames;i++){const t=i/rate;rng=(1664525*rng+1013904223)>>>0;low=.92*low+.08*(rng/2147483648-1);let value=0;for(const start of [.035,.15,.28,.43]){const u=t-start;if(u>=0&&u<.14){const e=Math.sin(Math.PI*u/.14)*Math.exp(-u*9);value+=Math.sin(2*Math.PI*(310*u-900*u*u))*e*.32;}}const fade=Math.max(0,Math.min(1,t/.01,(frames-1-i)/(rate*.035))),v=Math.round((value+low*.045)*fade*32767);potion.writeInt16LE(v,44+i*2);peak=Math.max(peak,Math.abs(v));}
const target=path.join(__dirname,'../public/assets/game-sounds'),file='quacks-potion.wav';fs.writeFileSync(path.join(target,file),potion);const manifest=JSON.parse(fs.readFileSync(path.join(target,'quacks-manifest.json'),'utf8'));manifest.potion={file,durationMs:600,bytes:potion.length,sha256:crypto.createHash('sha256').update(potion).digest('hex'),peak,seed:83119,source:'Project-original synthesis: low liquid bubbles and filtered noise, no third-party sample',generator:'tools/generate-quacks-sounds.cjs'};fs.writeFileSync(path.join(target,'quacks-manifest.json'),JSON.stringify(manifest,null,2)+'\n');

// Original 420 ms warm settlement chime; each confirmation shares a short cue.
const settleMs=420,settleFrames=settleMs*24,settleBytes=Buffer.alloc(44+settleFrames*2);
settleBytes.write('RIFF');settleBytes.writeUInt32LE(settleBytes.length-8,4);settleBytes.write('WAVEfmt ',8);settleBytes.writeUInt32LE(16,16);settleBytes.writeUInt16LE(1,20);settleBytes.writeUInt16LE(1,22);settleBytes.writeUInt32LE(24000,24);settleBytes.writeUInt32LE(48000,28);settleBytes.writeUInt16LE(2,32);settleBytes.writeUInt16LE(16,34);settleBytes.write('data',36);settleBytes.writeUInt32LE(settleFrames*2,40);
let settlePeak=0;for(let i=0;i<settleFrames;i++){const t=i/24000,fade=Math.max(0,Math.min(1,t/.012,(settleFrames-1-i)/960)),e=Math.exp(-t*6);const v=Math.round((Math.sin(2*Math.PI*523.25*t)*.23+Math.sin(2*Math.PI*783.99*t)*.12+Math.sin(2*Math.PI*1046.5*t)*.045)*e*fade*32767);settleBytes.writeInt16LE(v,44+i*2);settlePeak=Math.max(settlePeak,Math.abs(v));}
const settleFile='quacks-settlement.wav';fs.writeFileSync(path.join(target,settleFile),settleBytes);manifest.settlement={file:settleFile,durationMs:settleMs,bytes:settleBytes.length,sha256:crypto.createHash('sha256').update(settleBytes).digest('hex'),peak:settlePeak,source:'Project-original synthesis: three warm sine tones and faded envelopes, no third-party sample',generator:'tools/generate-quacks-sounds.cjs'};fs.writeFileSync(path.join(target,'quacks-manifest.json'),JSON.stringify(manifest,null,2)+String.fromCharCode(10));
