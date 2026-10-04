const {HttpError}=require('../http/errors');
class RoomMusic{
 constructor(now=Date.now){this.now=now;this.track=null;this.position=0;this.startedAt=now();this.playing=false;this.loop=false;this.version=0;}
 snapshot(){const serverNow=this.now(),elapsed=this.position+(this.playing?(serverNow-this.startedAt)/1000:0),duration=this.track?.duration||0;return {track:this.track,playing:!!this.track&&this.playing&&(this.loop||elapsed<duration),position:duration?(this.loop?elapsed%duration:Math.min(duration,elapsed)):0,loop:this.loop,version:this.version,serverNow};}
 act(action,data,store){const view=this.snapshot();this.position=view.position;this.playing=view.playing;this.startedAt=this.now();
  if(action==='select'){const track=store.get(data.trackId);this.track={id:track.id,title:track.title,duration:track.duration};this.position=0;this.playing=true;}
  else if(action==='stop'){this.track=null;this.position=0;this.playing=false;}
  else if(action==='play'){if(!this.track)throw new HttpError(400,'NO_TRACK','請先選一首音樂');if(this.position>=this.track.duration)this.position=0;this.playing=true;}
  else if(action==='pause')this.playing=false;
  else if(action==='seek'){if(!this.track||!Number.isFinite(data.position)||data.position<0||data.position>this.track.duration)throw new HttpError(400,'INVALID_POSITION','播放進度不正確');this.position=data.position;}
  else if(action==='loop'){if(typeof data.loop!=='boolean')throw new HttpError(400,'INVALID_LOOP','循環設定不正確');this.loop=data.loop;}
  else throw new HttpError(400,'INVALID_ACTION','不支援的音樂操作');
  this.version++;return this.snapshot();
 }
}
module.exports={RoomMusic};
