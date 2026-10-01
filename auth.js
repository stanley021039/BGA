const crypto=require('node:crypto');
const {promisify}=require('node:util');
const {transaction}=require('./db');
const {HttpError}=require('./http-errors');
const scrypt=promisify(crypto.scrypt);
const SESSION_SECONDS=60*60*24*30;
const sha256=value=>crypto.createHash('sha256').update(value).digest('hex');
const now=()=>new Date().toISOString();
const after=seconds=>new Date(Date.now()+seconds*1000).toISOString();
const publicUser=user=>({id:user.id,username:user.username,displayName:user.display_name,role:user.role,appearance:user.appearance?JSON.parse(user.appearance):null});

function usernameOf(value){const name=String(value||'').trim().toLowerCase();if(!/^[a-z0-9_]{3,24}$/.test(name))throw new HttpError(400,'INVALID_USERNAME','帳號需為 3–24 個英文字母、數字或底線');return name;}
function displayNameOf(value){const name=String(value||'').trim();if(!name||name.length>16)throw new HttpError(400,'INVALID_DISPLAY_NAME','暱稱需為 1–16 字');return name;}
function passwordOf(value){if(typeof value!=='string'||value.length<10||value.length>128)throw new HttpError(400,'INVALID_PASSWORD','密碼需為 10–128 字');return value;}
async function hashPassword(password){const salt=crypto.randomBytes(16);const key=await scrypt(password,salt,64);return `scrypt:${salt.toString('hex')}:${key.toString('hex')}`;}
async function verifyPassword(password,encoded){const [algorithm,saltHex,keyHex]=encoded.split(':');if(algorithm!=='scrypt')return false;const expected=Buffer.from(keyHex,'hex'),actual=await scrypt(password,Buffer.from(saltHex,'hex'),expected.length);return crypto.timingSafeEqual(expected,actual);}
function token(){return crypto.randomBytes(32).toString('base64url');}

function createAuth(db,{secureCookies=false}={}){
 function issueSession(userId){const raw=token();db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').run(sha256(raw),userId,after(SESSION_SECONDS));return raw;}
 function setCookie(res,raw){res.setHeader('Set-Cookie',`ah-session=${raw}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_SECONDS}${secureCookies?'; Secure':''}`);}
 function clearCookie(res){res.setHeader('Set-Cookie',`ah-session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secureCookies?'; Secure':''}`);}
 function sessionFrom(req){const match=(req.headers.cookie||'').match(/(?:^|;\s*)ah-session=([^;]+)/);if(!match)return null;const tokenHash=sha256(match[1]);const user=db.prepare('SELECT users.*,sessions.token_hash AS session_hash FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token_hash=? AND sessions.revoked_at IS NULL AND sessions.expires_at>? AND users.disabled=0').get(tokenHash,now());return user||null;}
 function requireUser(req){const user=sessionFrom(req);if(!user)throw new HttpError(401,'LOGIN_REQUIRED','請先登入');return user;}
 function requireAdmin(req){const user=requireUser(req);if(user.role!=='admin')throw new HttpError(403,'ADMIN_REQUIRED','只有管理者可以操作');return user;}
 async function bootstrap(username,password){const name=usernameOf(username),secret=passwordOf(password),encoded=await hashPassword(secret),id=crypto.randomUUID();return transaction(db,()=>{if(db.prepare('SELECT COUNT(*) AS n FROM users').get().n)throw new HttpError(409,'ADMIN_EXISTS','已存在帳號，不能再次初始化管理者');db.prepare("INSERT INTO users(id,username,display_name,password_hash,role,created_at) VALUES(?,?,?,?,'admin',?)").run(id,name,name,encoded,now());return id;});}
 async function register(data,res){const name=usernameOf(data.username),display=displayNameOf(data.displayName||data.username),password=passwordOf(data.password),invite=String(data.invite||'');const encoded=await hashPassword(password),id=crypto.randomUUID();const raw=transaction(db,()=>{const valid=db.prepare('SELECT token_hash FROM invites WHERE token_hash=? AND used_by IS NULL AND revoked_at IS NULL AND expires_at>?').get(sha256(invite),now());if(!valid)throw new HttpError(400,'INVALID_INVITE','邀請碼無效或已使用');try{db.prepare("INSERT INTO users(id,username,display_name,password_hash,role,created_at) VALUES(?,?,?,?,'member',?)").run(id,name,display,encoded,now());}catch(error){if(error.code?.startsWith('ERR_SQLITE_CONSTRAINT'))throw new HttpError(409,'USERNAME_TAKEN','帳號已被使用');throw error;}db.prepare('UPDATE invites SET used_by=? WHERE token_hash=? AND used_by IS NULL').run(id,valid.token_hash);return issueSession(id);});setCookie(res,raw);return publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(id));}
 async function login(data,res){const name=usernameOf(data.username),password=String(data.password||''),user=db.prepare('SELECT * FROM users WHERE username=?').get(name);if(!user||user.disabled||!(await verifyPassword(password,user.password_hash)))throw new HttpError(401,'INVALID_CREDENTIALS','帳號或密碼不正確');const raw=issueSession(user.id);setCookie(res,raw);return publicUser(user);}
 function logout(req,res){const user=sessionFrom(req);if(user)db.prepare('UPDATE sessions SET revoked_at=? WHERE token_hash=?').run(now(),user.session_hash);clearCookie(res);}
 function createInvite(admin,{days=7}={}){if(!Number.isInteger(days)||days<1||days>90)throw new HttpError(400,'INVALID_EXPIRY','邀請碼期限需為 1–90 天');const raw=token();db.prepare('INSERT INTO invites(token_hash,created_by,expires_at) VALUES(?,?,?)').run(sha256(raw),admin.id,after(days*86400));return {code:raw,expiresAt:after(days*86400)};}
 function revokeInvite(code){const result=db.prepare('UPDATE invites SET revoked_at=? WHERE token_hash=? AND used_by IS NULL AND revoked_at IS NULL').run(now(),sha256(String(code||'')));if(!result.changes)throw new HttpError(404,'INVITE_NOT_FOUND','找不到可撤銷的邀請碼');}
 function createReset(admin,userId,{hours=24}={}){if(!Number.isInteger(hours)||hours<1||hours>72)throw new HttpError(400,'INVALID_EXPIRY','重設期限需為 1–72 小時');const user=db.prepare('SELECT id FROM users WHERE id=?').get(userId);if(!user)throw new HttpError(404,'USER_NOT_FOUND','找不到帳號');const raw=token();db.prepare('INSERT INTO password_resets(token_hash,user_id,created_by,expires_at) VALUES(?,?,?,?)').run(sha256(raw),userId,admin.id,after(hours*3600));return {token:raw,expiresAt:after(hours*3600)};}
 async function resetPassword(data){const encoded=await hashPassword(passwordOf(data.password)),hash=sha256(String(data.token||''));transaction(db,()=>{const reset=db.prepare('SELECT user_id FROM password_resets WHERE token_hash=? AND used_at IS NULL AND expires_at>?').get(hash,now());if(!reset)throw new HttpError(400,'INVALID_RESET','重設連結無效或已過期');db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(encoded,reset.user_id);db.prepare('UPDATE password_resets SET used_at=? WHERE token_hash=?').run(now(),hash);db.prepare('UPDATE sessions SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL').run(now(),reset.user_id);});}
 function disableUser(admin,userId,disabled){if(admin.id===userId)throw new HttpError(400,'CANNOT_DISABLE_SELF','不能停用自己的帳號');const result=db.prepare('UPDATE users SET disabled=? WHERE id=? AND role!=\'admin\'').run(disabled?1:0,userId);if(!result.changes)throw new HttpError(404,'USER_NOT_FOUND','找不到可更改的會員');if(disabled)db.prepare('UPDATE sessions SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL').run(now(),userId);}
 return {bootstrap,register,login,logout,sessionFrom,requireUser,requireAdmin,createInvite,revokeInvite,createReset,resetPassword,disableUser,publicUser};
}

module.exports={createAuth};
