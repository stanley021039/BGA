const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const crypto=require('node:crypto');
const {openDatabase}=require('../src/db/index');
const {createAuth}=require('../src/auth/index');
const {BoardStore}=require('../src/community/board');
const {SubmissionService}=require('../src/integrations/github/submissions');

test('GitHub submissions publish once, preserve operation order, and reconcile an accepted timeout',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'bga-submissions-'));
 const db=openDatabase(path.join(root,'app.sqlite'));
 try{
  const userId=await createAuth(db).bootstrap('admin','test-password-123');
  const user=db.prepare('SELECT * FROM users WHERE id=?').get(userId);
  const old={id:crypto.randomUUID(),title:'舊留言',body:'保留',name:'舊作者',game:'general',status:'open',at:new Date().toISOString(),comments:[]};
  const board=new BoardStore(db,[old]);
  new BoardStore(db,[old]);
  assert.equal(board.list().length,1);
  const issues=[],comments=[];let acceptedThenTimedOut=false,failBeforeSend=false;
  const github={configured:true,
   async createIssue(payload,id){if(failBeforeSend)throw Error('network unavailable');const issue={number:issues.length+1,html_url:'https://github.com/stanley021039/BGA/issues/'+(issues.length+1),state:'open',marker:id};issues.push(issue);if(acceptedThenTimedOut){acceptedThenTimedOut=false;throw Error('response lost');}return issue;},
   async findIssue(id){return issues.find(issue=>issue.marker===id)||null;},
   async createComment(number,payload,id){const comment={id:comments.length+1,marker:id,number};comments.push(comment);return comment;},
   async findComment(number,id){return comments.find(comment=>comment.number===number&&comment.marker===id)||null;},
   async setStatus(number,status){const issue=issues[number-1];issue.state=status;return issue;},
   async getIssue(number){return issues[number-1];}
  };
  const submissions=new SubmissionService(db,board,github);
  acceptedThenTimedOut=true;
  const id=crypto.randomUUID(),input={submissionId:id,game:'general',title:'新建議',body:'請改善'};
  const created=await submissions.submit('issue',input,user);
  assert.equal(created.state,'done');
  assert.equal(created.issue.githubUrl,issues[0].html_url);
  assert.equal((await submissions.submit('issue',input,user)).issue.id,created.issue.id);
  assert.equal(issues.length,1);
  const commented=await submissions.submit('comment',{submissionId:crypto.randomUUID(),id:created.issue.id,body:'補充資訊'},user);
  assert.equal(commented.state,'done');assert.equal(comments.length,1);assert.equal(commented.issue.comments.length,1);
  const closed=await submissions.submit('status',{submissionId:crypto.randomUUID(),id:created.issue.id,status:'closed'},user);
  assert.equal(closed.issue.status,'closed');
  failBeforeSend=true;
  const uncertain=await submissions.submit('issue',{submissionId:crypto.randomUUID(),game:'general',title:'待確認',body:'稍後再試'},user);
  assert.equal(uncertain.state,'needs_review');assert.equal(board.list().length,2);
  failBeforeSend=false;
  const retried=await submissions.retry(uncertain.submissionId,user);
  assert.equal(retried.state,'done');assert.equal(issues.length,2);
 }finally{db.close();fs.rmSync(root,{recursive:true,force:true});}
});
