const crypto=require('node:crypto');
const {transaction}=require('../db/index');
const {HttpError}=require('../http/errors');

const games=new Set(['general','majority','thunder','poker','gift','draw']);
function issueUrl(value){
 if(typeof value!=='string')return null;
 try{
  const url=new URL(value);
  return url.protocol==='https:'&&url.hostname==='github.com'&&url.username===''&&url.password===''&&url.port===''&&/^\/stanley021039\/BGA\/issues\/[1-9][0-9]*$/.test(url.pathname)&&!url.search&&!url.hash?url.href:null;
 }catch{return null;}
}
function required(value,max,label){if(typeof value!=='string'||!value.trim()||value.trim().length>max)throw new HttpError(400,'INVALID_CONTENT',`${label}需為 1–${max} 字`);return value.trim();}

class BoardStore{
 constructor(db,legacy=[]){this.db=db;transaction(db,()=>{for(const old of legacy){db.prepare('INSERT OR IGNORE INTO board_issues(id,title,body,name,game,status,at) VALUES(?,?,?,?,?,?,?)').run(old.id,old.title,old.body,old.name,old.game,old.status,old.at);for(const comment of old.comments||[])db.prepare('INSERT OR IGNORE INTO board_comments(id,issue_id,name,body,at) VALUES(?,?,?,?,?)').run(comment.id,old.id,comment.name,comment.body,comment.at);}});}
 list(){return this.db.prepare('SELECT * FROM board_issues ORDER BY at DESC').all().map(row=>this.publicIssue(row));}
 get(id){const row=this.db.prepare('SELECT * FROM board_issues WHERE id=?').get(id);if(!row)throw new HttpError(404,'ISSUE_NOT_FOUND','找不到留言');return row;}
 publicIssue(row){return {id:row.id,title:row.title,body:row.body,name:row.name,game:row.game,status:row.status,at:row.at,githubUrl:issueUrl(row.github_url),comments:this.db.prepare('SELECT id,name,body,at FROM board_comments WHERE issue_id=? ORDER BY at').all(row.id)};}
 validateIssue(data){if(!games.has(data.game))throw new HttpError(400,'INVALID_GAME','請選擇遊戲標籤');return {id:crypto.randomUUID(),title:required(data.title,100,'標題'),body:required(data.body,3000,'內容'),game:data.game};}
 validateComment(data){return {id:crypto.randomUUID(),body:required(data.body,1000,'回覆')};}
 publishIssue(data,user,remote){const url=issueUrl(remote.html_url);if(!url||url!==`https://github.com/stanley021039/BGA/issues/${remote.number}`)throw Error('GitHub issue response has an invalid URL');const at=new Date().toISOString();this.db.prepare("INSERT INTO board_issues(id,author_id,title,body,name,game,status,at,github_number,github_url) VALUES(?,?,?,?,?,?,'open',?,?,?)").run(data.id,user.id,data.title,data.body,user.display_name,data.game,at,remote.number,url);return this.publicIssue(this.get(data.id));}
 publishComment(issueId,data,user,remote){const at=new Date().toISOString();this.db.prepare('INSERT INTO board_comments(id,issue_id,author_id,name,body,at,github_id) VALUES(?,?,?,?,?,?,?)').run(data.id,issueId,user.id,user.display_name,data.body,at,remote.id);return this.publicIssue(this.get(issueId));}
 updateStatus(issueId,status){this.db.prepare('UPDATE board_issues SET status=? WHERE id=?').run(status,issueId);return this.publicIssue(this.get(issueId));}
}

module.exports={BoardStore};
