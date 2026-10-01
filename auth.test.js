const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {openDatabase}=require('./src/db/index');
const {createAuth}=require('./src/auth/index');

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
