const crypto=require('node:crypto');
const {transaction}=require('./db');
const {HttpError}=require('./http-errors');

class SubmissionService{
 constructor(db,board,github){this.db=db;this.board=board;this.github=github;this.inFlight=new Map();}
 row(id){const row=this.db.prepare('SELECT * FROM submissions WHERE id=?').get(id);if(!row)throw new HttpError(404,'SUBMISSION_NOT_FOUND','找不到送出紀錄');return row;}
 visible(id,user){const row=this.row(id);if(row.user_id!==user.id&&user.role!=='admin')throw new HttpError(403,'FORBIDDEN','無法查看這筆提交');return this.result(row);}
 result(row){const payload=JSON.parse(row.payload);return {submissionId:row.id,state:row.state,issue:row.state==='done'?this.board.publicIssue(this.board.get(payload.issueId)):null,error:row.error||null};}
 prepare(kind,input,user){
  if(kind==='issue'){const issue=this.board.validateIssue(input);return {...issue,name:user.display_name,issueId:issue.id};}
  const issue=this.board.get(input.id);
  if(!issue.github_number)throw new HttpError(409,'ISSUE_NOT_SYNCED','這則舊留言尚未連結 GitHub Issue');
  if(kind==='comment')return {...this.board.validateComment(input),name:user.display_name,issueId:issue.id,githubNumber:issue.github_number};
  if(kind==='status'){if(user.role!=='admin')throw new HttpError(403,'ADMIN_REQUIRED','只有管理者可以更改處理狀態');if(!['open','closed'].includes(input.status))throw new HttpError(400,'INVALID_STATUS','狀態不正確');return {issueId:issue.id,githubNumber:issue.github_number,status:input.status};}
  throw new HttpError(400,'INVALID_SUBMISSION','不支援的操作');
 }
 async submit(kind,input,user){
  if(!this.github.configured)throw new HttpError(503,'GITHUB_NOT_CONFIGURED','GitHub 同步尚未設定');
  const id=input.submissionId;
  if(typeof id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))throw new HttpError(400,'INVALID_SUBMISSION_ID','請重新送出表單');
  const existing=this.db.prepare('SELECT * FROM submissions WHERE id=?').get(id);
  if(existing){if(existing.user_id!==user.id||existing.kind!==kind)throw new HttpError(409,'SUBMISSION_CONFLICT','提交識別碼已被使用');return this.process(id);}
  const payload=this.prepare(kind,input,user),time=new Date().toISOString();
  if(payload.issueId&&kind!=='issue'&&this.db.prepare("SELECT id FROM submissions WHERE issue_id=? AND state IN ('pending','sending','needs_review') LIMIT 1").get(payload.issueId))throw new HttpError(409,'ISSUE_BUSY','這則留言仍有一筆操作待確認');
  this.db.prepare("INSERT INTO submissions(id,user_id,kind,issue_id,payload,state,created_at,updated_at) VALUES(?,?,?,?,?,'pending',?,?)").run(id,user.id,kind,payload.issueId,JSON.stringify(payload),time,time);
  return this.process(id);
 }
 async process(id){
  if(this.inFlight.has(id))return this.inFlight.get(id);
  const work=this.processOne(id).finally(()=>this.inFlight.delete(id));this.inFlight.set(id,work);return work;
 }
 async processOne(id){
  let row=this.row(id);
  if(['done','failed','needs_review'].includes(row.state))return this.result(row);
  const payload=JSON.parse(row.payload);
  if(row.state==='sending'){
   try{const found=await this.findRemote(row,payload);if(found)return this.finish(row,payload,found);}catch(error){console.error('GitHub submission reconciliation failed',id,error);}
   this.setState(id,'needs_review','GitHub 結果不明，請管理者確認後再重試');return this.result(this.row(id));
  }
  this.setState(id,'sending',null);row=this.row(id);
  try{const remote=await this.sendRemote(row,payload);return this.finish(row,payload,remote);}
  catch(error){
   if([400,401,403,404,422].includes(error.remoteStatus)){this.setState(id,'failed',error.message);return this.result(this.row(id));}
   try{const found=await this.findRemote(row,payload);if(found)return this.finish(row,payload,found);}catch(checkError){console.error('GitHub submission reconciliation failed',id,checkError);}
   this.setState(id,'needs_review','GitHub 結果不明，請管理者確認後再重試');return this.result(this.row(id));
  }
 }
 async sendRemote(row,payload){if(row.kind==='issue')return this.github.createIssue(payload,row.id);if(row.kind==='comment')return this.github.createComment(payload.githubNumber,payload,row.id);return this.github.setStatus(payload.githubNumber,payload.status);}
 async findRemote(row,payload){if(row.kind==='issue')return this.github.findIssue(row.id);if(row.kind==='comment')return this.github.findComment(payload.githubNumber,row.id);const issue=await this.github.getIssue(payload.githubNumber);return issue.state===payload.status?issue:null;}
 finish(row,payload,remote){return transaction(this.db,()=>{
  if(row.kind==='issue'){if(!Number.isInteger(remote.number)||!remote.html_url)throw Error('GitHub issue response missing number or URL');this.board.publishIssue(payload,{id:row.user_id,display_name:payload.name},remote);}
  else if(row.kind==='comment'){if(!Number.isInteger(remote.id))throw Error('GitHub comment response missing ID');this.board.publishComment(payload.issueId,payload,{id:row.user_id,display_name:payload.name},remote);}
  else this.board.updateStatus(payload.issueId,payload.status);
  this.db.prepare("UPDATE submissions SET state='done',remote_id=?,error=NULL,updated_at=? WHERE id=?").run(String(remote.number||remote.id||''),new Date().toISOString(),row.id);
  return this.result(this.row(row.id));
 });}
 setState(id,state,error){this.db.prepare('UPDATE submissions SET state=?,error=?,updated_at=? WHERE id=?').run(state,error,new Date().toISOString(),id);}
 retry(id,admin){if(admin.role!=='admin')throw new HttpError(403,'ADMIN_REQUIRED','只有管理者可以重試');const row=this.row(id);if(row.state!=='needs_review')throw new HttpError(409,'NOT_RETRYABLE','這筆提交無法重試');this.setState(id,'pending',null);return this.process(id);}
 pending(){return this.db.prepare("SELECT id,kind,state,created_at AS createdAt,error FROM submissions WHERE state IN ('pending','sending','needs_review','failed') ORDER BY created_at").all();}
 recover(){for(const row of this.db.prepare("SELECT id FROM submissions WHERE state IN ('pending','sending')").all())this.process(row.id).catch(error=>console.error('GitHub submission recovery failed',row.id,error));}
}

module.exports={SubmissionService};
