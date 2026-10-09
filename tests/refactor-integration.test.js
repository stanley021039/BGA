'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {appFixture}=require('./helpers/app-fixture.cjs');
const {createAuth}=require('../src/auth');

test('integrated app serves both controller boundaries before their page entrypoints',async t=>{
 const {base}=await appFixture(t,{seed:db=>createAuth(db).bootstrap('integration_owner','test-password-123')});
 const login=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'integration_owner',password:'test-password-123'})});
 assert.equal(login.status,200);await login.text();
 const cookie=login.headers.get('set-cookie').split(';')[0];
 for(const game of ['draw','race']){
  const route='/shared/'+game+'-controller.js',response=await fetch(base+route);
  assert.equal(response.status,200,route);
  assert.match(response.headers.get('content-type'),/^text\/javascript/);
  assert.equal(await response.text(),fs.readFileSync(path.join(__dirname,'../public',route),'utf8'));
  const page=await fetch(base+'/'+game+'/ABCDEF',{headers:{Cookie:cookie}});
  assert.equal(page.status,200);const html=await page.text();
  const controller=html.indexOf('src="'+route+'"'),entry=html.indexOf('src="/'+game+'.js"');
  assert.ok(controller>=0&&entry>controller,game+' loads its controller first');
  const transport=html.indexOf('src="/shared/api.js"');
  assert.ok(transport>=0&&transport<entry,game+' loads transport before its entrypoint');
 }
 const version=await fetch(base+'/api/version');assert.equal(version.status,200);
 assert.deepEqual(await version.json(),{version:require('../package.json').version});
});
