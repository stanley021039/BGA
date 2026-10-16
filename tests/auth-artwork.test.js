const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const vm=require('node:vm');
const sharp=require('sharp');
const {createApp}=require('../src/app');

function page(search=''){
 const image={dataset:{}},artwork={querySelector:()=>image};
 const forms=Object.fromEntries(['login','register','reset'].map(name=>[name,{elements:{invite:{}},querySelector:()=>({})}]));
 const nodes={'#authArtwork':artwork,'.auth-tabs':{},'#authTitle':{},'#authIntro':{},'#message':{}};
 for(const [name,form] of Object.entries(forms))nodes['#'+name+'Form']=form;
 const tabs=['login','register'].map(mode=>({dataset:{mode},setAttribute(key,value){this[key]=value;}}));
 const context={document:{querySelector:selector=>nodes[selector],querySelectorAll:()=>tabs},location:{search},URLSearchParams};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../public/login.js'),'utf8'),context);
 return {image,artwork,forms,nodes,tabs};
}

test('auth artwork follows tabs, preserves form drafts and uses responsive thumbnails',()=>{
 const {image,forms,tabs}=page();
 assert.match(image.src,/login-320.webp$/);
 assert.match(image.srcset,/login-864.webp 864w/);
 assert.equal(image.alt,'歡迎來到 Ave Mujica 的世界');
 forms.login.elements.username={value:'draft'};
 tabs[1].onclick();
 assert.match(image.src,/register-320.webp$/);
 assert.match(image.srcset,/register-576.webp 576w/);
 assert.doesNotMatch(image.srcset,/login|\.jpg/);
 assert.equal(image.alt,'又來了一個新人');
 assert.equal(forms.login.hidden,true);
 assert.equal(forms.register.hidden,false);
 tabs[0].onclick();
 assert.equal(forms.login.elements.username.value,'draft');
 assert.equal(tabs[0]['aria-selected'],'true');
});

test('invite and direct register start with register art; reset requests no artwork',()=>{
 for(const search of ['?invite=qa-invite','?mode=register'])assert.match(page(search).image.src,/register-320.webp$/);
 const invite=page('?invite=qa-invite');
 assert.equal(invite.forms.register.elements.invite.value,'qa-invite');
 const reset=page('?reset=qa-token&invite=qa-invite');
 assert.equal(reset.artwork.hidden,true);
 assert.equal(reset.image.src,undefined);
 assert.equal(reset.image.srcset,undefined);
 assert.equal(reset.forms.reset.hidden,false);
});

test('public auth artwork endpoints serve only the approved reduced WebP variants',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'bga-auth-art-'));
 const app=createApp({port:0,host:'127.0.0.1',historyDir:path.join(root,'history'),communityDir:path.join(root,'community'),dbFile:path.join(root,'app.sqlite'),externalSideEffectsEnabled:false,marketAutomationEnabled:false,achievementPurpose:'test'});
 try{
  const {port}=await app.listen(),base=`http://127.0.0.1:${port}`;
  for(const [mode,widths] of [['login',[320,480,576,864]],['register',[320,480,576]]]){
   for(const width of widths){
    const response=await fetch(`${base}/assets/auth/${mode}-${width}.webp`);
    assert.equal(response.status,200);
    assert.equal(response.headers.get('content-type'),'image/webp');
    const bytes=Buffer.from(await response.arrayBuffer()),meta=await sharp(bytes).metadata();
    assert.equal(meta.width,width);
    assert.equal(meta.height,width*9/16);
    assert.ok(bytes.length<30000);
   }
  }
  for(const name of ['stanley021039','x55662306','azrael04']){
   for(const width of [64,88,176]){
    const response=await fetch(`${base}/assets/auth/${name}-${width}.webp`);
    assert.equal(response.status,200);
    assert.equal(response.headers.get('content-type'),'image/webp');
    const bytes=Buffer.from(await response.arrayBuffer()),meta=await sharp(bytes).metadata();
    assert.equal(meta.width,width);
    assert.equal(meta.height,width);
    assert.ok(bytes.length<10000);
   }
  }
  for(const name of ['login-1280.webp','register-640.webp','login.jpg','register.jpg','../auth/source.jpg'])assert.equal((await fetch(`${base}/assets/auth/${name}`)).status,404);
 }finally{await app.close();fs.rmSync(root,{recursive:true,force:true});}
});
