const fs=require('node:fs'),path=require('node:path'),{randomUUID,timingSafeEqual}=require('node:crypto');
const {TOPICS}=require('../games/majority-questions');
const clean=(v,max,label)=>{if(typeof v!=='string'||!v.trim()||v.trim().length>max)throw Error(`${label}需為 1 至 ${max} 字`);return v.trim();};
function validateQuestion(data){const type=data.type;if(!['two','three','blank'].includes(type))throw Error('題型不正確');const prompt=clean(data.prompt,160,'題目');let options=[];if(type!=='blank'){const count=type==='two'?2:3;if(!Array.isArray(data.options)||data.options.length!==count)throw Error('選項數量不正確');options=data.options.map(v=>clean(v,60,'選項'));if(new Set(options.map(v=>v.normalize('NFKC').toLowerCase())).size!==count)throw Error('選項不可重複');}return {type,prompt,options,topic:TOPICS.some(t=>t.id===data.topic)?data.topic:'daily'};}
class CommunityStore{
 constructor(dir){this.dir=dir;this.file=path.join(dir,'community.json');fs.mkdirSync(dir,{recursive:true});this.data=fs.existsSync(this.file)?JSON.parse(fs.readFileSync(this.file,'utf8')):{issues:[],questions:[]};}
 save(){fs.writeFileSync(this.file+'.tmp',JSON.stringify(this.data));fs.renameSync(this.file+'.tmp',this.file);}
 question(data){if(this.data.questions.length>=5000)throw Error('共用題庫已達上限');const q={...validateQuestion(data),id:'shared-'+randomUUID(),pack:clean(data.pack||'朋友共編',40,'題庫名稱'),author:clean(data.name||'朋友',16,'暱稱'),shared:true,at:new Date().toISOString()};this.data.questions.push(q);this.save();return q;}
 publicIssue(i){const {owner,...out}=i;return out;}
 issues(){return this.data.issues.map(i=>this.publicIssue(i));}
 issue(data){if(this.data.issues.length>=1000)throw Error('留言板已達上限');if(!['general','majority','thunder','poker'].includes(data.game))throw Error('請選擇遊戲標籤');const i={id:randomUUID(),owner:randomUUID(),title:clean(data.title,100,'標題'),body:clean(data.body,3000,'內容'),name:clean(data.name||'朋友',16,'暱稱'),game:data.game,status:'open',comments:[],at:new Date().toISOString()};this.data.issues.unshift(i);this.save();return {...this.publicIssue(i),owner:i.owner};}
 updateIssue(data,{isAdmin=false}={}){const i=this.data.issues.find(i=>i.id===data.id);if(!i)throw Error('找不到留言');if(data.action==='comment'){if(i.comments.length>=200)throw Error('回覆已達上限');i.comments.push({id:randomUUID(),name:clean(data.name||'朋友',16,'暱稱'),body:clean(data.body,1000,'回覆'),at:new Date().toISOString()});}else if(data.action==='status'){if(!isAdmin)throw Error('只有管理者可以更改處理狀態');if(!['open','closed'].includes(data.status))throw Error('狀態不正確');i.status=data.status;}else throw Error('未知操作');this.save();return this.publicIssue(i);}
}
module.exports={CommunityStore,validateQuestion};
