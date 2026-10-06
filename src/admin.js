const crypto=require('node:crypto');
const {loadEnv,settings}=require('./config');
const {openDatabase}=require('./db/index');
const {createAuth}=require('./auth/index');
const {acquireDataLocks}=require('./data/locks');

async function main(){
 loadEnv();
 const [command,username]=process.argv.slice(2);
 if(command!=='init'||!username)throw Error('用法：node admin.js init <管理者帳號>');
 const config=settings(),lock=acquireDataLocks(config);
 let db;
 try{
  db=openDatabase(config.dbFile);
  const initialPassword=crypto.randomBytes(24).toString('base64url');
  await createAuth(db).bootstrap(username,initialPassword);
  process.stdout.write(`管理者帳號：${username}\n一次顯示的初始密碼：${initialPassword}\n請登入後立即重設密碼。\n`);
 }finally{try{db?.close();}finally{lock.release();}}
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
