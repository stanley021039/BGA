// Reproducible import of the selected Noto Emoji gift illustrations.
// Run from the repository root with: node scripts/fetch-gift-art.js
'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');
const {GIFTS}=require('../src/games/gift-catalog');

const revision='e20cbc2bbec1926686be9f9bee7d1d2cfa1fea0e';
const source=`https://raw.githubusercontent.com/googlefonts/noto-emoji/${revision}/2D/png/72/`;
const folder=path.join(__dirname,'..','public','assets','gifts','noto');
const names=[...new Set(GIFTS.map(gift=>gift.image).filter(image=>image.includes('/noto/')).map(image=>path.basename(image)))];
const signature=Buffer.from([137,80,78,71,13,10,26,10]);
const valid=body=>body.length>=24&&body.length<=100000&&body.subarray(0,8).equals(signature);

async function download(name){
 const destination=path.join(folder,name);
 try{if(valid(await fs.readFile(destination)))return;}catch{}
 const response=await fetch(source+name);
 if(!response.ok)throw Error(`${name}: HTTP ${response.status}`);
 const body=Buffer.from(await response.arrayBuffer());
 if(!valid(body))throw Error(`${name}: unexpected PNG content`);
 await fs.writeFile(destination,body);
}

async function main(){
 await fs.mkdir(folder,{recursive:true});
 const failures=[];
 for(let offset=0;offset<names.length;offset+=8){
  const batch=await Promise.allSettled(names.slice(offset,offset+8).map(download));
  for(let index=0;index<batch.length;index++)if(batch[index].status==='rejected')failures.push(batch[index].reason.message);
 }
 if(failures.length)throw Error(failures.join('\n'));
 console.log(`Noto gift art ready: ${names.length} PNG files`);
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
