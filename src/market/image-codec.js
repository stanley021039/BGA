const sharp=require('sharp');
const {PNG}=require('pngjs');
const {inflateSync}=require('node:zlib');
const {HttpError}=require('../http/errors');

const DEFAULT_IMAGE_LIMITS=Object.freeze({maxUploadBytes:2*1024*1024,maxImageBytes:4*1024*1024,maxDimension:4096,maxPixels:8000000,maxPerUser:100,maxImages:1000,maxStorageBytes:256*1024*1024,maxApprovalBatch:1000});
const MIME_FORMAT=Object.freeze({'image/png':'png','image/jpeg':'jpeg','image/webp':'webp'});
const SIGNATURE=Buffer.from([137,80,78,71,13,10,26,10]);
let activeDecodes=0;
function invalid(message='圖片需為有效的單張 PNG、JPEG 或 WebP，且大小及像素不可超限'){throw new HttpError(400,'INVALID_MARKET_IMAGE',message);}
function tooLarge(){throw new HttpError(413,'IMAGE_TOO_LARGE','圖片檔案超過大小限制');}
function imageLimits(overrides={}){
 const limits={...DEFAULT_IMAGE_LIMITS};
 for(const [key,value] of Object.entries(overrides)){
  if(!Object.hasOwn(limits,key)||!Number.isSafeInteger(value)||value<1||value>limits[key])throw Error('Invalid market image limits');
  limits[key]=value;
 }
 return Object.freeze(limits);
}
function dimensions(width,height,limits){if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1||width>limits.maxDimension||height>limits.maxDimension||width*height>limits.maxPixels)invalid();}
// Bounds and the first IHDR are inspected before either decoder can allocate
// pixel buffers. Canonical files contain only IHDR, contiguous IDAT and IEND.
function pngChunks(bytes,limits,canonical=false){
 if(bytes.length<45||!bytes.subarray(0,8).equals(SIGNATURE))invalid();
 const chunks=[];let offset=8,width,height,ended=false,sawData=false;
 while(offset<bytes.length){
  if(bytes.length-offset<12)invalid();
  const size=bytes.readUInt32BE(offset),end=offset+size+12;
  if(end>bytes.length)invalid();
  const type=bytes.toString('ascii',offset+4,offset+8);
  if(!chunks.length){
   if(type!=='IHDR'||size!==13)invalid();
   width=bytes.readUInt32BE(offset+8);height=bytes.readUInt32BE(offset+12);dimensions(width,height,limits);
   if(canonical&&(bytes[offset+16]!==8||bytes[offset+17]!==6||bytes[offset+18]!==0||bytes[offset+19]!==0||bytes[offset+20]!==0))invalid();
  }else if(type==='IHDR')invalid();
  if(['acTL','fcTL','fdAT'].includes(type))invalid('請上傳靜態圖片，不能使用動畫');
  if(canonical&&!['IHDR','IDAT','IEND'].includes(type))invalid();
  if(type==='IDAT'){if(!size||ended)invalid();sawData=true;}
  else if(sawData)ended=true;
  chunks.push({type,bytes:bytes.subarray(offset,end),data:bytes.subarray(offset+8,end-4)});
  offset=end;
  if(type==='IEND'){if(size||!sawData||offset!==bytes.length)invalid();return {width,height,chunks};}
 }
 invalid();
}
function staticWebp(bytes){
 if(bytes.length<20||bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WEBP'||bytes.readUInt32LE(4)!==bytes.length-8)invalid();
 let offset=12,pictures=0;
 while(offset<bytes.length){
  if(bytes.length-offset<8)invalid();
  const type=bytes.toString('ascii',offset,offset+4),size=bytes.readUInt32LE(offset+4),end=offset+8+size+(size%2);
  if(end>bytes.length)invalid();
  if(type==='ANIM'||type==='ANMF'||type==='VP8X'&&(size!==10||bytes[offset+8]&2))invalid('請上傳靜態圖片，不能使用動畫');
  if(type==='VP8 '||type==='VP8L')pictures++;
  offset=end;
 }
 if(offset!==bytes.length||pictures!==1)invalid();
}
function imageInput(input,limits=DEFAULT_IMAGE_LIMITS){
 const mime=input?.mime,base64=input?.base64;
 if(!Object.hasOwn(MIME_FORMAT,mime)||typeof base64!=='string'||!base64.length)invalid();
 if(base64.length>Math.ceil(limits.maxUploadBytes/3)*4)tooLarge();
 if(base64.length%4||!/^[A-Za-z0-9+/]+={0,2}$/.test(base64))invalid();
 const bytes=Buffer.from(base64,'base64');
 if(bytes.length>limits.maxUploadBytes)tooLarge();
 if(!bytes.length||bytes.toString('base64')!==base64)invalid();
 // Do not hand SVG or another sniffed format to a permissive decoder.
 if(mime==='image/png')pngChunks(bytes,limits);
 else if(mime==='image/webp')staticWebp(bytes);
 else if(bytes.length<4||bytes[0]!==255||bytes[1]!==216||bytes[2]!==255)invalid();
 return {mime,base64,bytes};
}
function inspectCanonicalImage(input,limits=DEFAULT_IMAGE_LIMITS){
 if(!(input instanceof Uint8Array)||!input.byteLength||input.byteLength>limits.maxImageBytes)invalid();
 const bytes=Buffer.isBuffer(input)?input:Buffer.from(input),{width,height,chunks}=pngChunks(bytes,limits,true);
 try{
  // pngjs bounds its inflater but may stop at the expected pixel count before
  // checking a zlib trailer. Check the entire stream, exact size and checksum
  // first, with a strict allocation ceiling, then fully decode with pngjs/CRC.
  const compressed=Buffer.concat(chunks.filter(chunk=>chunk.type==='IDAT').map(chunk=>chunk.data)),expected=(width*4+1)*height;
  const inflated=inflateSync(compressed,{maxOutputLength:expected+1,info:true});
  if(inflated.buffer.length!==expected||inflated.engine.bytesWritten!==compressed.length)invalid();
  const decoded=PNG.sync.read(bytes,{checkCRC:true});
  if(decoded.width!==width||decoded.height!==height||decoded.depth!==8||decoded.colorType!==6||decoded.data.length!==width*height*4)invalid();
 }catch{invalid();}
 return {mime:'image/png',bytes,width,height};
}
async function canonicalImage(input,limits=DEFAULT_IMAGE_LIMITS){
 const source=input.bytes?input:imageInput(input,limits);
 if(activeDecodes>=2)throw new HttpError(429,'IMAGE_BUSY','圖片處理中，請稍後再試');
 activeDecodes++;
 try{
  const decoder=sharp(source.bytes,{failOn:'warning',limitInputPixels:limits.maxPixels,limitInputChannels:4});
  const meta=await decoder.metadata();
  if(meta.format!==MIME_FORMAT[source.mime]||meta.pages>1||meta.pageHeight&&meta.pageHeight!==meta.height)invalid();
  dimensions(meta.width,meta.height,limits);
  const {data,info}=await decoder.rotate().toColourspace('srgb').ensureAlpha().raw({depth:'uchar'}).timeout({seconds:10}).toBuffer({resolveWithObject:true});
  dimensions(info.width,info.height,limits);
  if(info.channels!==4||data.length!==info.width*info.height*4)invalid();
  const encoded=await sharp(data,{raw:{width:info.width,height:info.height,channels:4}}).png({compressionLevel:9,adaptiveFiltering:true,palette:false}).timeout({seconds:10}).toBuffer();
  // sharp emits a default pHYs chunk even for a raw input. Retain only pixel
  // chunks so no density, text, ICC, EXIF or other input metadata is persisted.
  if(encoded.length>limits.maxImageBytes+1024)tooLarge();
  const chunks=pngChunks(encoded,limits).chunks.filter(chunk=>['IHDR','IDAT','IEND'].includes(chunk.type));
  const bytes=Buffer.concat([SIGNATURE,...chunks.map(chunk=>chunk.bytes)]);if(bytes.length>limits.maxImageBytes)tooLarge();
  return inspectCanonicalImage(bytes,limits);
 }catch(error){if(error instanceof HttpError)throw error;invalid();}
 finally{activeDecodes--;}
}
module.exports={DEFAULT_IMAGE_LIMITS,imageLimits,imageInput,canonicalImage,inspectCanonicalImage};
