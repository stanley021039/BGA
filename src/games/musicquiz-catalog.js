'use strict';
// Our synthesized mono PCM recordings, no downloaded commercial recording or lyrics.
// Melody sources/attribution are documented in docs/specs/PARTY-GAMES-81-83.md.
const SONGS=Object.freeze([
 {title:'小星星',aliases:['Twinkle Twinkle Little Star','Ah vous dirai je maman'],notes:[60,60,67,67,69,69,67,65,65,64,64,62]},
 {title:'兩隻老虎',aliases:['Frère Jacques','Frere Jacques','兄弟雅各'],notes:[60,62,64,60,60,62,64,60,64,65,67,64]},
 {title:'歡樂頌',aliases:['快樂頌','Ode to Joy'],notes:[64,64,65,67,67,65,64,62,60,60,62,64]}
]);
const clips=new Map();
function clip(index){
 if(clips.has(index))return clips.get(index);const rate=16000,samples=rate*6,buffer=Buffer.alloc(44+samples*2);buffer.write('RIFF');buffer.writeUInt32LE(buffer.length-8,4);buffer.write('WAVEfmt ',8);buffer.writeUInt32LE(16,16);buffer.writeUInt16LE(1,20);buffer.writeUInt16LE(1,22);buffer.writeUInt32LE(rate,24);buffer.writeUInt32LE(rate*2,28);buffer.writeUInt16LE(2,32);buffer.writeUInt16LE(16,34);buffer.write('data',36);buffer.writeUInt32LE(samples*2,40);
 const notes=SONGS[index].notes;for(let i=0;i<samples;i++){const t=i/rate,position=t%0.5,freq=440*2**((notes[Math.floor(t/0.5)]-69)/12),envelope=Math.min(1,position/0.015)*Math.max(0,1-position/0.48);buffer.writeInt16LE(Math.round(9000*envelope*Math.sin(2*Math.PI*freq*position)),44+i*2);}clips.set(index,buffer);return buffer;
}
module.exports={SONGS,clip};
