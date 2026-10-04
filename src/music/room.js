const {HttpError}=require('../http/errors');
class RoomMusic{
 constructor(now=Date.now,store=null,random=Math.random){this.now=now;this.store=store;this.random=random;this.track=null;this.position=0;this.startedAt=now();this.playing=false;this.loop=false;this.mode='none';this.version=0;}
 choose(direction,store=this.store){const tracks=store?.list()||[];if(!tracks.length)throw new HttpError(400,'NO_TRACK','音樂庫目前沒有歌曲');const index=tracks.findIndex(t=>t.id===this.track?.id);let next;if(this.mode==='shuffle'){const candidates=tracks.filter(t=>t.id!==this.track?.id);next=(candidates.length?candidates:tracks)[Math.floor(this.random()*(candidates.length||tracks.length))];}else next=tracks[(index<0?(direction===1?0:tracks.length-1):(index+direction+tracks.length)%tracks.length)];this.track={id:next.id,title:next.title,duration:next.duration};this.position=0;this.startedAt=this.now();this.playing=true;}
 snapshot(){const serverNow=this.now();let elapsed=this.position+(this.playing?(serverNow-this.startedAt)/1000:0);if(this.track&&this.playing&&this.mode==='shuffle'&&elapsed>=this.track.duration&&this.store?.list().length){this.choose(1);this.version++;elapsed=0;}const duration=this.track?.duration||0;return {track:this.track,playing:!!this.track&&this.playing&&(this.loop||elapsed<duration),position:duration?(this.loop?elapsed%duration:Math.min(duration,elapsed)):0,loop:this.loop,mode:this.mode,version:this.version,serverNow};}
 act(action,data,store){const view=this.snapshot();this.position=view.position;this.playing=view.playing;this.startedAt=this.now();
  if(action==='select'){const track=store.get(data.trackId);this.track={id:track.id,title:track.title,duration:track.duration};this.position=0;this.playing=true;}
  else if(action==='stop'){this.track=null;this.position=0;this.playing=false;}
  else if(action==='play'){if(!this.track)throw new HttpError(400,'NO_TRACK','請先選一首音樂');if(this.position>=this.track.duration)this.position=0;this.playing=true;}
  else if(action==='pause')this.playing=false;
  else if(action==='seek'){if(!this.track||!Number.isFinite(data.position)||data.position<0||data.position>this.track.duration)throw new HttpError(400,'INVALID_POSITION','播放進度不正確');this.position=data.position;}
  else if(action==='loop'){if(typeof data.loop!=='boolean')throw new HttpError(400,'INVALID_LOOP','循環設定不正確');this.loop=data.loop;this.mode=data.loop?'repeat':'none';}
  else if(action==='mode'){if(!['none','repeat','shuffle'].includes(data.mode))throw new HttpError(400,'INVALID_MODE','播放模式不正確');this.mode=data.mode;this.loop=data.mode==='repeat';}
  else if(action==='previous'||action==='next')this.choose(action==='next'?1:-1,store);
  else throw new HttpError(400,'INVALID_ACTION','不支援的音樂操作');
  this.version++;return this.snapshot();
 }
}
module.exports={RoomMusic};
