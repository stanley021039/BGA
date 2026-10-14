/* Export immutable, already-public draw results; never use the live canvas. */
(()=>{
 'use strict';
 const encoder=new TextEncoder(),urls=new Set();
 const safeName=value=>String(value||'畫作').replace(/[\\/:*?"<>|\u0000-\u001f]/g,'_').slice(0,80);
 function download(blob,name){
  const url=URL.createObjectURL(blob),link=document.createElement('a');urls.add(url);
  link.href=url;link.download=safeName(name);document.body.append(link);link.click();link.remove();
  setTimeout(()=>{URL.revokeObjectURL(url);urls.delete(url);},30000);
 }
 async function png(snapshot){
  if(!snapshot?.result?.resultId||!Array.isArray(snapshot.canvas?.strokes))throw Error('這幅畫尚未公開');
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;
  const renderer=window.StrokeCanvas.createDrawingRenderer(canvas,{maxCheckpoints:2});
  try{await renderer.renderCooperatively(snapshot.canvas.strokes);return await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('畫作無法匯出')),'image/png'));}
  finally{renderer.reset();canvas.width=0;canvas.height=0;}
 }
 const crcTable=Uint32Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
 function crc32(bytes){let crc=0xffffffff;for(const byte of bytes)crc=crcTable[(crc^byte)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;}
 function header(size){const bytes=new Uint8Array(size);return {bytes,view:new DataView(bytes.buffer)};}
 async function zip(entries){
  if(!entries.length||entries.length>8)throw Error('可匯出最近八輪的公開畫作');
  const parts=[],directory=[];let offset=0,centralSize=0;
  const now=new Date(),date=((Math.max(1980,now.getFullYear())-1980)<<9)|((now.getMonth()+1)<<5)|now.getDate(),time=(now.getHours()<<11)|(now.getMinutes()<<5)|(now.getSeconds()>>1);
  for(const {name,blob}of entries){
   const file=encoder.encode(safeName(name)),data=new Uint8Array(await blob.arrayBuffer()),crc=crc32(data),local=header(30+file.length),central=header(46+file.length);
   local.view.setUint32(0,0x04034b50,true);local.view.setUint16(4,20,true);local.view.setUint16(6,0x800,true);
   local.view.setUint16(10,time,true);local.view.setUint16(12,date,true);
   local.view.setUint32(14,crc,true);local.view.setUint32(18,data.length,true);local.view.setUint32(22,data.length,true);local.view.setUint16(26,file.length,true);local.bytes.set(file,30);
   central.view.setUint32(0,0x02014b50,true);central.view.setUint16(4,20,true);central.view.setUint16(6,20,true);central.view.setUint16(8,0x800,true);
   central.view.setUint16(12,time,true);central.view.setUint16(14,date,true);
   central.view.setUint32(16,crc,true);central.view.setUint32(20,data.length,true);central.view.setUint32(24,data.length,true);central.view.setUint16(28,file.length,true);central.view.setUint32(42,offset,true);central.bytes.set(file,46);
   parts.push(local.bytes,data);directory.push(central.bytes);offset+=local.bytes.length+data.length;centralSize+=central.bytes.length;
  }
  const end=header(22);end.view.setUint32(0,0x06054b50,true);end.view.setUint16(8,entries.length,true);end.view.setUint16(10,entries.length,true);end.view.setUint32(12,centralSize,true);end.view.setUint32(16,offset,true);
  return new Blob([...parts,...directory,end.bytes],{type:'application/zip'});
 }
 function name(snapshot){return '第'+snapshot.result.round+'輪_'+safeName(snapshot.result.answer||'未選題')+'.png';}
 window.ArtworkExport={png,zip,download,name};
 window.addEventListener('pagehide',()=>{for(const url of urls)URL.revokeObjectURL(url);urls.clear();});
})();
