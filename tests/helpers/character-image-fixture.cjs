const {deflateSync}=require('node:zlib');
const table=Uint32Array.from({length:256},(_,index)=>{let value=index;for(let bit=0;bit<8;bit++)value=value&1?0xedb88320^(value>>>1):value>>>1;return value>>>0;});
function crc32(bytes){let value=0xffffffff;for(const byte of bytes)value=table[(value^byte)&255]^(value>>>8);return(value^0xffffffff)>>>0;}
function chunk(type,data){const name=Buffer.from(type,'ascii'),bytes=Buffer.alloc(data.length+12);bytes.writeUInt32BE(data.length,0);name.copy(bytes,4);data.copy(bytes,8);bytes.writeUInt32BE(crc32(bytes.subarray(4,-4)),bytes.length-4);return bytes;}
// A real 1×1 RGBA image. A private ancillary chunk pads its byte length without
// changing pixels; every chunk has a valid CRC and IDAT contains a zlib scanline.
function characterImagePng(byteLength=4*1024*1024,{paddingByte=0xa5}={}){
 const signature=Buffer.from([137,80,78,71,13,10,26,10]),header=Buffer.alloc(13);header.writeUInt32BE(1,0);header.writeUInt32BE(1,4);header[8]=8;header[9]=6;
 const ihdr=chunk('IHDR',header),idat=chunk('IDAT',deflateSync(Buffer.from([0,64,144,96,255]))),iend=chunk('IEND',Buffer.alloc(0)),minimum=signature.length+ihdr.length+idat.length+iend.length+12;
 if(!Number.isSafeInteger(byteLength)||byteLength<minimum)throw new RangeError('PNG fixture needs an integer size of at least '+minimum+' bytes');
 if(!Number.isInteger(paddingByte)||paddingByte<0||paddingByte>255)throw new RangeError('PNG fixture paddingByte must be a byte');
 return Buffer.concat([signature,ihdr,chunk('npAD',Buffer.alloc(byteLength-minimum,paddingByte)),idat,iend]);
}
module.exports={characterImagePng};
