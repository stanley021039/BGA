'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {appFixture}=require('./helpers/app-fixture.cjs'),{createAuth}=require('../src/auth');
test('draw ending is validated at creation, persists in snapshots and survives old settings clients',async t=>{
 const {base}=await appFixture(t,{config:{achievementPurpose:'test',marketAutomationEnabled:false},seed:db=>createAuth(db).bootstrap('ending_owner','synthetic-ending-password')});
 const login=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'ending_owner',password:'synthetic-ending-password'})});await login.text();const cookie=login.headers.get('set-cookie').split(';')[0];
 async function post(route,data,status=200){const r=await fetch(base+'/api/'+route,{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify(data)}),s=await r.json();assert.equal(r.status,status,JSON.stringify(s));return s;}
 for(const ending of [{mode:'score',value:9},{mode:'rounds',value:65},{mode:'other',value:10},null])await post('create',{type:'draw',ending},400);
 for(const ending of [{mode:'score',value:100},{mode:'rounds',value:4}]){
  const {code}=await post('create',{type:'draw',ending});const response=await fetch(base+'/api/state?code='+code,{headers:{Cookie:cookie}}),state=await response.json();assert.deepEqual(state.options.ending,ending);
  const update=await post('settings',{code,seconds:60,topics:['animals']});assert.deepEqual(update.options.ending,ending);await post('bot',{code});const start=await post('start',{code});assert.equal(start.roundLimit,ending.mode==='score'?64:4);await post('settings',{code,seconds:60,ending:{mode:'rounds',value:1}},400);await post('leave',{code});
 }
 const page=await fetch(base+'/?game=draw',{headers:{Cookie:cookie}});const html=await page.text();assert.match(html,/drawEndMode/);assert.match(html,/固定輪數（總題數）/);
});
