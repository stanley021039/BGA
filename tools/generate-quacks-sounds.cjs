'use strict';
const fs=require('fs'),path=require('path');
const sampleRate=22050,count=Math.floor(sampleRate*.84),out=Buffer.alloc(44+count*2);
out.write('RIFF');out.writeUInt32LE(36+count*2,4);out.write('WAVEfmt ',8);out.writeUInt32LE(16,16);out.writeUInt16LE(1,20);out.writeUInt16LE(1,22);out.writeUInt32LE(sampleRate,24);out.writeUInt32LE(sampleRate*2,28);out.writeUInt16LE(2,32);out.writeUInt16LE(16,34);out.write('data',36);out.writeUInt32LE(count*2,40);
let seed=87126,brown=0;
for(let i=0;i<count;i++){seed=(1664525*seed+1013904223)>>>0;const t=i/sampleRate,noise=seed/2147483648-1;brown=.83*brown+.17*noise;const envelope=Math.min(1,t/.008)*Math.exp(-t*6.4),bass=Math.sin(2*Math.PI*(76*t-21*t*t));const v=Math.tanh((brown*3.2+bass*.7+noise*.18)*envelope)*.69;out.writeInt16LE(Math.round(v*32767),44+i*2);}
fs.writeFileSync(path.join(__dirname,'../public/assets/game-sounds/quacks-explosion.wav'),out);
