'use strict';
const {randomUUID}=require('node:crypto');
const {PartyRoom,fail,clone,text,normalize}=require('./party-base'),{SONGS,clip}=require('./musicquiz-catalog');
class MusicQuizRoom extends PartyRoom{
 constructor(code,name,rng,now){super('musicquiz',code,name,8,1,rng,now);this.sequence=[];this.songIndex=null;this.answers={};}
 start(){const pool=SONGS.map((_,i)=>i),sequence=[];while(pool.length){const index=this.rng(pool.length);if(!Number.isInteger(index)||index<0||index>=pool.length)throw Error('無效抽曲結果');sequence.push(pool.splice(index,1)[0]);}this.prepare();this.sequence=sequence;this.roundLimit=sequence.length;this.nextRound();}
 nextRound(){this.round++;this.roundId=randomUUID();this.songIndex=this.sequence[this.round-1];this.answers={};this.phase='answering';this.event('round','第 '+this.round+' 題，聽六秒旋律開頭猜歌名；每人一次作答。');}
 act(id,action,data={}){return this.command(id,action,data,p=>{
  if(action==='guess'){if(this.phase!=='answering')fail('INVALID_PHASE','這題已揭曉');if(this.answers[id])fail('ALREADY_SUBMITTED','已送出答案');const answer=text(data.text);if(!answer&&data.pass!==true)fail('INVALID_TEXT','請填歌名，或選擇略過',400);this.answers[id]={name:p.name,text:answer,pass:data.pass===true};this.event('answer',p.name+' 已作答');}
  else if(action==='reveal'){if(id!==this.host)fail('HOST_ONLY','只有房主可以揭曉',403);if(this.phase!=='answering')fail('INVALID_PHASE','已揭曉');if(this.activePlayers().some(q=>!this.answers[q.id]))fail('NOT_READY','還有人未作答');const song=SONGS[this.songIndex],answers=this.activePlayers().map(q=>{const a=this.answers[q.id],correct=!a.pass&&[song.title,...song.aliases].some(t=>normalize(t)===normalize(a.text));if(correct)q.score++;return {...a,correct};});this.results.push({round:this.round,title:song.title,answers});this.phase='reveal';this.event('reveal','答案：'+song.title+'，猜中 +1。');if(this.round===this.roundLimit)this.finish();}
  else if(action==='next'){if(id!==this.host)fail('HOST_ONLY','只有房主可以換題',403);if(this.phase!=='reveal')fail('INVALID_PHASE','先揭曉這題');this.nextRound();}
  else fail('INVALID_ACTION','不支援的操作',400);
 });}
 audio(id,roundId){if(!this.player(id))fail('NOT_SEATED','尚未入座',403);if(roundId!==this.roundId||this.songIndex==null||this.phase==='waiting')fail('STALE_ROUND','音訊只供目前這題');return clip(this.songIndex);}
 view(id){return clone({...this.baseView(id),clipSeconds:6,audioUrl:this.songIndex==null?null:'/api/musicquiz-clip?code='+this.code+'&roundId='+this.roundId,submitted:!!this.answers[id],myAnswer:this.answers[id]?.text||'',readyIds:Object.keys(this.answers),canReveal:this.phase==='answering'&&id===this.host&&this.activePlayers().every(q=>this.answers[q.id])});}
}
module.exports={MusicQuizRoom};
