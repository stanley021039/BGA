const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {createApp}=require('../src/app');
const root=path.join(__dirname,'../public'),directory=path.join(root,'assets/streamline-freehand');
const manifest=JSON.parse(fs.readFileSync(path.join(directory,'manifest.json'),'utf8'));
test('vendored hand-drawn vectors retain exact provenance and contain no active or remote SVG content',()=>{
 assert.equal(manifest.publisher,'Streamline');assert.equal(manifest.license,'CC-BY-4.0');assert.match(manifest.commit,/^[a-f0-9]{40}$/);assert.ok(manifest.assets.length>0&&manifest.assets.length<=50);assert.equal(new Set(manifest.assets.map(a=>a.file)).size,manifest.assets.length);
 for(const asset of manifest.assets){assert.match(asset.file,/^[a-z0-9-]+\.svg$/);assert.equal(asset.commit,manifest.commit);assert.equal(asset.license,manifest.license);assert.ok(asset.sourceUrl.startsWith('https://raw.githubusercontent.com/webalys-hq/streamline-vectors/'+manifest.commit+'/freehand/duotone/'));assert.match(asset.originalSha256,/^[a-f0-9]{64}$/);assert.equal(asset.modified,true);assert.ok(asset.modifications.length>0);const bytes=fs.readFileSync(path.join(directory,asset.file));assert.equal(bytes.length,asset.bytes);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),asset.sha256);}
 for(const file of [...manifest.assets.map(a=>path.join(directory,a.file)),path.join(root,'assets/ui/gift.svg')]){const svg=fs.readFileSync(file,'utf8');assert.match(svg,/<svg\b[^>]*viewBox="0 0 24 24"/);assert.match(svg,/<\/svg>\s*$/);assert.doesNotMatch(svg,/<(?:script|foreignObject|image|iframe|style|use)\b|<!DOCTYPE|<!ENTITY|\son[a-z]+\s*=|\s(?:href|xlink:href)\s*=|url\s*\(/i,file);}
});
test('only reviewed local vectors are served as SVG, with restrictive CSP and exact immutable bytes',async()=>{
 const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'bga-freehand-assets-'));const app=createApp({port:0,host:'127.0.0.1',dbFile:path.join(temporary,'app.sqlite'),historyDir:path.join(temporary,'history'),communityDir:path.join(temporary,'community'),musicDir:path.join(temporary,'music'),externalSideEffectsEnabled:false});
 try{const {port}=await app.listen(),base='http://127.0.0.1:'+port;
  for(const file of [...manifest.assets.map(a=>'assets/streamline-freehand/'+a.file),'assets/ui/gift.svg']){const response=await fetch(base+'/'+file);assert.equal(response.status,200,file);assert.equal(response.headers.get('content-type'),'image/svg+xml');assert.equal(response.headers.get('cache-control'),'no-store');assert.match(response.headers.get('content-security-policy'),/default-src 'none'; sandbox/);assert.equal(await response.text(),fs.readFileSync(path.join(root,file),'utf8'));}
  for(const name of ['/assets/streamline-freehand/not-reviewed.svg','/assets/streamline-freehand/manifest.json','/assets/streamline-freehand/%2e%2e%2f%2e%2e%2findex.html','/assets/streamline-freehand/home.svg-extra','/assets/ui/gift.svg-extra'])assert.equal((await fetch(base+name,{redirect:'manual'})).status,404,name);
  const css=await fetch(base+'/shared/freehand-ui.css');assert.equal(css.status,200);assert.match(css.headers.get('content-type'),/^text\/css/);assert.equal(css.headers.get('cache-control'),'no-store');assert.equal(await css.text(),fs.readFileSync(path.join(root,'shared/freehand-ui.css'),'utf8'));
  assert.equal((await fetch(base+'/shared/freehand-ui.css-extra')).status,404);
  const credits=await fetch(base+'/credits',{redirect:'manual'});assert.equal(credits.status,302);assert.equal(credits.headers.get('location'),'/login');
 }finally{await app.close();fs.rmSync(temporary,{recursive:true,force:true});}
});
