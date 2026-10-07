const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {mediaHarness}=require('./media-browser.cjs');
function mediaAudioHarness(options={}){
 const events=[];
 const f=mediaHarness({...options,beforeLoad(context){
  const MockAudio=context.Audio;
  context.Audio=class EventAudio extends MockAudio{
   constructor(){super();this._eventsReady=true;this._muted=false;this.plays=0;this.playCalls=0;this.pauses=0;this.pendingPlays=[];this.playingPromises=[];this.readyState=options.pendingAudio?(options.abortOnPause===false?3:1):4;}
   get volume(){return this._volume;}set volume(value){const changed=this._volume!==value;this._volume=value;if(changed&&this._eventsReady)events.push({clip:this,type:'volumechange'});}
   get muted(){return this._muted;}set muted(value){const changed=this._muted!==value;this._muted=value;if(changed&&this._eventsReady)events.push({clip:this,type:'volumechange'});}
   transition(paused){if(this.paused===paused)return;this.paused=paused;const taken=paused?this.pendingPlays.splice(0):[];events.push({clip:this,type:paused?'pause':'play',afterDispatch:()=>{for(const request of taken){const error=Error('interrupted by pause');error.name='AbortError';request.reject(error);}}});}
   notifyPlaying(type='playing'){const taken=this.pendingPlays.splice(0);this.playingPromises.push(...taken);events.push({clip:this,type,afterDispatch:()=>{for(const request of taken){const index=this.playingPromises.indexOf(request);if(index!==-1)this.playingPromises.splice(index,1);request.resolve();}}});}
   play(){this.playCalls++;if(this.paused)this.plays++;if(options.blockedAudio||this.blockedAudio){const error=Error('autoplay not allowed');error.name='NotAllowedError';return Promise.reject(error);}const changed=this.paused;this.transition(false);return new Promise((resolve,reject)=>{this.pendingPlays.push({resolve,reject});this.resolvePlay=()=>{if(this.pendingPlays.length){this.readyState=Math.max(this.readyState,3);this.notifyPlaying();}};if(this.readyState>=3)this.notifyPlaying(changed?'playing':null);});}
   pause(){this.pauses++;this.transition(true);}
   nativePlay(){const changed=this.paused;this.transition(false);if(this.readyState>=3){if(changed||this.pendingPlays.length)this.notifyPlaying(changed?'playing':null);}else if(changed)events.push({clip:this,type:'waiting'});return Promise.resolve();}nativePause(){this.transition(true);}
  };
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../../public/shared/audio-settings.js'),'utf8'),context,{filename:'public/shared/audio-settings.js'});
  options.beforeLoad?.(context);
 }});
 // HTML media state changes immediately; its trusted events are separate queued tasks.
 // Programmatic and native transitions use the same trust value, so trust cannot identify intent.
 // Successful nonpending play resolves in its later notify-playing media task, not a preceding microtask.
 // readyState 3 takes promises and queues notify-playing immediately: its task remains before a later pause.
 // resolvePlay supplies future data at readyState 1; it takes and queues promises without bypassing older tasks.
 // nativePlay models the UA internal action; its returned promise is only a test acknowledgement.
 // plays counts attempts from paused; playCalls also counts non-transition queue checkpoints.
 return {...f,mediaEvents:events,async flushMediaEvents({limit=256}={}){let count=0;while(events.length&&count<limit){const{clip,type,afterDispatch}=events.shift();if(type==='pause')clip.dispatch('timeupdate',{type:'timeupdate',target:clip,currentTarget:clip,isTrusted:true});if(type)clip.dispatch(type,{type,target:clip,currentTarget:clip,isTrusted:true});afterDispatch?.();count++;await f.flush();}if(events.length&&limit===256)throw Error('media event loop');return count;}};
}
module.exports={mediaAudioHarness};
