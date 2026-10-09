'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {createAuth}=require('../src/auth');
const {appFixture}=require('./helpers/app-fixture.cjs');
test('TRPG authenticated create/join/action/reconnect/leave and finished history use existing server contracts',async t=>{
 const password='synthetic-trpg-test-password';const {base}=await appFixture(t,{config:{achievementPurpose:'test',marketAutomationEnabled:false},seed:db=>createAuth(db).bootstrap('trpg_owner',password)});
 async function post(route,cookie,data={},status=200){const r=await fetch(base+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(data)});const body=await r.json();assert.equal(r.status,status,JSON.stringify(body));return {body,cookie:r.headers.get('set-cookie')?.split(';')[0]};}
 const owner=(await post('auth/login',null,{username:'trpg_owner',password})).cookie;
 const invite=(await post('admin/invites',owner)).body.code;const peer=(await post('auth/register',null,{username:'trpg_peer',displayName:'隊友',password,confirmPassword:password,invite})).cookie;
 await post('create',null,{type:'trpg'},401);const {code,type}=(await post('create',owner,{type:'trpg'})).body;assert.equal(type,'trpg');await post('join',peer,{code});
 const state=async cookie=>{const r=await fetch(base+'/api/state?code='+code,{headers:{Cookie:cookie}});assert.equal(r.status,200);return r.json();};
 let s=await state(owner);const ids=[s.me,(await state(peer)).me];assert.equal(s.players.length,2);assert.equal(s.botSupport.supported,true);
 await post('start',peer,{code},403);s=(await post('start',owner,{code})).body;
 const action=async(cookie,action,data={},status=200)=>post('action',cookie,{code,action,sceneId:s.sceneId,requestId:randomUUID(),...data},status);
 await action(peer,'resolve',{},403);await action(owner,'resolve',{},409);
 const draft=await action(peer,'plan',{stance:'recover',note:'<script>alert(1)</script>'});assert.equal(draft.body.myPlan.note,'<script>alert(1)</script>');assert.ok(!JSON.stringify(await state(owner)).includes('<script>'));
 for(let round=1;round<=6;round++){
  s=await state(owner);const leaderCookie=s.leaderId===ids[0]?owner:peer;
  for(const cookie of [owner,peer])await action(cookie,'plan',{stance:'recover',approach:'connect',note:'一起走下去'});
  const req={code,action:'resolve',sceneId:s.sceneId,requestId:randomUUID()};s=(await post('action',leaderCookie,req)).body;const duplicated=(await post('action',leaderCookie,req)).body;assert.equal(duplicated.results.length,round);assert.equal(duplicated.version,s.version);
  await post('reconnect',peer,{code});assert.equal((await state(peer)).results.length,round);
  if(round<6){const stale=s.sceneId;s=(await action(leaderCookie,'next')).body;await action(owner,'plan',{sceneId:stale,approach:'bold',stance:'assist',note:''},409);}
 }
 assert.equal(s.phase,'finished');const h=await fetch(base+'/api/history',{headers:{Cookie:owner}}),matches=await h.json(),match=matches.find(m=>m.type==='trpg');assert.equal(match.status,'finished');
 const archive=await fetch(base+'/api/history/'+match.id,{headers:{Cookie:owner}}),rows=await archive.json();assert.match(rows.find(r=>r.kind==='header').engine.source,/class TrpgRoom/);assert.equal(rows.filter(r=>r.kind==='result').at(-1).after.results.length,6);
 const list=await fetch(base+'/api/rooms',{headers:{Cookie:owner}});assert.equal((await list.json()).rooms.find(r=>r.code===code).maxPlayers,6);
 await post('leave',peer,{code});assert.equal((await post('leave',owner,{code})).body.deleted,true);
});
test('TRPG pages preserve login return, serve dependencies and expose safe text rendering',async t=>{
 const fs=require('node:fs'),path=require('node:path');const {base}=await appFixture(t,{seed:db=>createAuth(db).bootstrap('trpg_ui','synthetic-ui-password')});
 for(const route of ['/trpg/ABCDEF','/trpg?learn=1']){const r=await fetch(base+route,{redirect:'manual'});assert.equal(r.status,302);assert.match(r.headers.get('location'),/^\/login\?next=/);}
 const login=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'trpg_ui',password:'synthetic-ui-password'})});await login.text();const cookie=login.headers.get('set-cookie').split(';')[0];
 const page=await fetch(base+'/trpg/ABCDEF',{headers:{Cookie:cookie}}),html=await page.text();assert.equal(page.status,200);assert.match(html,/不連接 AI/);assert.ok(html.indexOf('/shared/api.js')<html.indexOf('/trpg.js'));assert.match(html,/site-account-menu/);
 for(const file of ['trpg.js','trpg.css']){const r=await fetch(base+'/'+file);assert.equal(r.status,200);assert.equal(await r.text(),fs.readFileSync(path.join(__dirname,'../public',file),'utf8'));}
 const source=fs.readFileSync(path.join(__dirname,'../public/trpg.js'),'utf8');assert.ok(!source.includes('.innerHTML'));assert.match(source,/textContent/);assert.match(source,/pagehide/);
});
