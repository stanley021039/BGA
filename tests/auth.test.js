const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {openDatabase}=require('../src/db/index');
const {createAuth}=require('../src/auth/index');

test('single-use invite, session revocation, and one-time password reset survive reopening SQLite',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'bga-auth-')),file=path.join(root,'app.sqlite');
 let db=openDatabase(file),auth=createAuth(db);
 const headers={};const res={setHeader:(key,value)=>headers[key]=value};
 try{
  const adminId=await auth.bootstrap('Admin','first-password-123');
  assert.ok(adminId);
  const admin=auth.requireUser({headers:{cookie:(await auth.login({username:'admin',password:'first-password-123'},res),headers['Set-Cookie'])}});
  assert.equal(admin.role,'admin');
  const invite=auth.createInvite(admin,{days:1});
  await assert.rejects(auth.register({username:'Friend',displayName:'朋友',password:'88888888',confirmPassword:'different',invite:invite.code},res),{code:'PASSWORD_MISMATCH'});
  await assert.rejects(auth.register({username:'Friend',displayName:'朋友',password:'1234567',confirmPassword:'1234567',invite:invite.code},res),{code:'INVALID_PASSWORD'});
  const user=await auth.register({username:'Friend',displayName:'朋友',password:'88888888',confirmPassword:'88888888',invite:invite.code},res);
  assert.equal(user.username,'friend');
  const memberCookie=headers['Set-Cookie'];
  assert.equal(auth.requireUser({headers:{cookie:memberCookie}}).id,user.id);
  await assert.rejects(auth.register({username:'Other',password:'third-password-123',confirmPassword:'third-password-123',invite:invite.code},res),{code:'INVALID_INVITE'});
  assert.throws(()=>auth.requireAdmin({headers:{cookie:memberCookie}}),{code:'ADMIN_REQUIRED'});
  db.close();db=openDatabase(file);auth=createAuth(db);
  assert.equal(auth.requireUser({headers:{cookie:memberCookie}}).id,user.id);
  const reset=auth.createReset(db.prepare('SELECT * FROM users WHERE id=?').get(adminId),user.id);
  await assert.rejects(auth.resetPassword({token:reset.token,password:'new-pass-123',confirmPassword:'different'}),{code:'PASSWORD_MISMATCH'});
  await auth.resetPassword({token:reset.token,password:'changed-password-123',confirmPassword:'changed-password-123'});
  await assert.rejects(auth.resetPassword({token:reset.token,password:'another-password-123',confirmPassword:'another-password-123'}),{code:'INVALID_RESET'});
  assert.throws(()=>auth.requireUser({headers:{cookie:memberCookie}}),{code:'LOGIN_REQUIRED'});
  await assert.rejects(auth.login({username:'friend',password:'88888888'},res),{code:'INVALID_CREDENTIALS'});
  await auth.login({username:'friend',password:'changed-password-123'},res);
  auth.disableUser(db.prepare('SELECT * FROM users WHERE id=?').get(adminId),user.id,true);
  assert.throws(()=>auth.requireUser({headers:{cookie:headers['Set-Cookie']}}),{code:'LOGIN_REQUIRED'});
 }finally{db.close();fs.rmSync(root,{recursive:true,force:true});}
});

test('renaming persists the nickname without changing credentials, roles or live sessions',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'bga-auth-rename-')),file=path.join(root,'app.sqlite');
 let db=openDatabase(file),auth=createAuth(db);const headers={},res={setHeader:(key,value)=>headers[key]=value};
 try{
  const id=await auth.bootstrap('rename_owner','rename-password-123');
  await auth.login({username:'rename_owner',password:'rename-password-123'},res);
  const first=headers['Set-Cookie'];await auth.login({username:'rename_owner',password:'rename-password-123'},res);const second=headers['Set-Cookie'];
  const before=db.prepare('SELECT * FROM users WHERE id=?').get(id),user=auth.requireUser({headers:{cookie:first}});
  for(const displayName of ['', '   ', '一'.repeat(17), '名字\n換行', '名字\u0000', 42, {}, null, undefined]){
   assert.throws(()=>auth.rename(user,{displayName}),{code:'INVALID_DISPLAY_NAME'});
   assert.equal(db.prepare('SELECT display_name FROM users WHERE id=?').get(id).display_name,before.display_name);
  }
  const expected='😀'.repeat(16),result=auth.rename(user,{displayName:' '+expected+' ',id:'someone-else',username:'replaced',role:'member'});
  assert.equal(result.displayName,expected);assert.equal(result.id,id);assert.equal(result.username,'rename_owner');assert.equal(result.role,'admin');
  const after=db.prepare('SELECT * FROM users WHERE id=?').get(id);
  for(const key of Object.keys(before))if(key!=='display_name')assert.deepEqual(after[key],before[key]);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM sessions WHERE revoked_at IS NULL').get().n,2);
  assert.equal(auth.requireUser({headers:{cookie:first}}).display_name,expected);assert.equal(auth.requireUser({headers:{cookie:second}}).display_name,expected);
  db.close();db=openDatabase(file);auth=createAuth(db);
  assert.equal(auth.requireUser({headers:{cookie:first}}).display_name,expected);
  assert.equal((await auth.login({username:'rename_owner',password:'rename-password-123'},res)).displayName,expected);
  await assert.rejects(auth.login({username:'replaced',password:'rename-password-123'},res),{code:'INVALID_CREDENTIALS'});
 }finally{db.close();fs.rmSync(root,{recursive:true,force:true,maxRetries:5});}
});
