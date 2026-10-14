'use strict';
const fs=require('fs'),path=require('path');
const sampleRate=22050,count=Math.floor(sampleRate*.84),out=Buffer.alloc(44+count*2);
out.write('RIFF');out.writeUInt32LE(36+count*2,4);out.write('WAVEfmt ',8);out.writeUInt32LE(16,16);out.writeUInt16LE(1,20);out.writeUInt16LE(1,22);out.writeUInt32LE(sampleRate,24);out.writeUInt32LE(sampleRate*2,28);out.writeUInt16LE(2,32);out.writeUInt16LE(16,34);out.write('data',36);out.writeUInt32LE(count*2,40);
let seed=87126,brown=0;
for(let i=0;i<count;i++){seed=(1664525*seed+1013904223)>>>0;const t=i/sampleRate,noise=seed/2147483648-1;brown=.83*brown+.17*noise;const envelope=Math.min(1,t/.008)*Math.exp(-t*6.4),bass=Math.sin(2*Math.PI*(76*t-21*t*t));const v=Math.tanh((brown*3.2+bass*.7+noise*.18)*envelope)*.69;out.writeInt16LE(Math.round(v*32767),44+i*2);}
fs.writeFileSync(path.join(__dirname,'../public/assets/game-sounds/quacks-explosion.wav'),out);


// Deterministic short rustle/clink and paper/chime cues; no external recordings.
const crypto=require('node:crypto'),generated={};
for(const [kind,ms,initialSeed]of [['ingredient',210,13919],['card',460,83551]]){
 const rate=24000,frames=ms*24,bytes=Buffer.alloc(44+frames*2);bytes.write('RIFF');bytes.writeUInt32LE(bytes.length-8,4);bytes.write('WAVEfmt ',8);bytes.writeUInt32LE(16,16);bytes.writeUInt16LE(1,20);bytes.writeUInt16LE(1,22);bytes.writeUInt32LE(rate,24);bytes.writeUInt32LE(rate*2,28);bytes.writeUInt16LE(2,32);bytes.writeUInt16LE(16,34);bytes.write('data',36);bytes.writeUInt32LE(frames*2,40);
 let state=initialSeed,low=0,peak=0;
 for(let i=0;i<frames;i++){state=(1664525*state+1013904223)>>>0;const t=i/rate,noise=state/2147483648-1;low=.82*low+.18*noise;const attack=Math.min(1,t/.008),fade=Math.min(1,(frames-1-i)/(rate*.024));const wave=kind==='ingredient'?(low*.8*Math.exp(-t*16)+Math.sin(2*Math.PI*980*t)*Math.exp(-Math.max(0,t-.09)*65)*(t>.09?.12:0)):(low*.65*Math.exp(-t*9)+Math.sin(2*Math.PI*740*t)*Math.exp(-Math.max(0,t-.16)*12)*(t>.16?.18:0));const value=Math.round(wave*attack*Math.max(0,fade)*.55*32767);bytes.writeInt16LE(value,44+i*2);peak=Math.max(peak,Math.abs(value));}
 const file='quacks-'+kind+'.wav';fs.writeFileSync(path.join(__dirname,'../public/assets/game-sounds',file),bytes);generated[kind]={file,durationMs:ms,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),peak,seed:initialSeed,source:'Project-original synthesis; seeded filtered noise and sine tones, no third-party sample',generator:'tools/generate-quacks-sounds.cjs'};
}
fs.writeFileSync(path.join(__dirname,'../public/assets/game-sounds/quacks-manifest.json'),JSON.stringify(generated,null,2)+'\n');
