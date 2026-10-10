const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {createApp}=require('../src/app');
test('playful presentation assets are public exact local bytes; arbitrary SVG paths remain unavailable',async()=>{
 const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'bga-playful-assets-'));
 const app=createApp({port:0,host:'127.0.0.1',dbFile:path.join(temporary,'app.sqlite'),historyDir:path.join(temporary,'history'),communityDir:path.join(temporary,'community'),musicDir:path.join(temporary,'music'),externalSideEffectsEnabled:false});
 try{const {port}=await app.listen(),base='http://127.0.0.1:'+port;
  for(const game of ['thunder','poker','majority','gift','draw','market','musicquiz','bluff','minimal','telephone','trpg']){const file='assets/playful/game-'+game+'.svg',response=await fetch(base+'/'+file);assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/svg+xml');assert.match(response.headers.get('content-security-policy'),/default-src 'none'; sandbox/);const svg=await response.text();assert.equal(svg,fs.readFileSync(path.join(__dirname,'../public',file),'utf8'));assert.doesNotMatch(svg,/<(?:script|foreignObject|image|iframe|use)\b|\son[a-z]+\s*=|\s(?:href|xlink:href)\s*=/i);}
  for(const file of ['playful-theme.css','game-card-carousel.js']){const response=await fetch(base+'/shared/'+file);assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');assert.match(response.headers.get('content-type'),file.endsWith('.css')?/^text\/css/:/^text\/javascript/);assert.equal(await response.text(),fs.readFileSync(path.join(__dirname,'../public/shared',file),'utf8'));}
  for(const url of ['/assets/playful/not-reviewed.svg','/assets/playful/game-draw.svg-extra','/shared/game-card-carousel.js-extra'])assert.equal((await fetch(base+url,{redirect:'manual'})).status,404);
 }finally{await app.close();fs.rmSync(temporary,{recursive:true,force:true});}
});
