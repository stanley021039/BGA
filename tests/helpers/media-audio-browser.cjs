const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {mediaHarness}=require('./media-browser.cjs');
function mediaAudioHarness(options={}){
 const events=[];
 const f=mediaHarness({...options,beforeLoad(context){
  const MockAudio=context.Audio;
  context.Audio=class EventAudio extends MockAudio{
   constructor(){super();this._eventsReady=true;this._muted=false;this.plays=0;this.pauses=0;this.pendingPlays=[];this.playingPromises=[];if(options.abortOnPause===false)this.readyState=3;}
   get volume(){return this._volume;}set volume(value){const changed=this._volume!==value;this._volume=value;if(changed&&this._eventsReady)events.push({clip:this,type:'volumechange'});}
   get muted(){return this._muted;}set muted(value){const changed=this._muted!==value;this._muted=value;if(changed&&this._eventsReady)events.push({clip:this,type:'volumechange'});}
   transition(paused){if(this.paused===paused)return;this.paused=paused;const taken=paused?this.pendingPlays.splice(0):[];events.push({clip:this,type:paused?'pause':'play',afterDispatch:()=>{for(const request of taken){const error=Error('interrupted by pause');error.name='AbortError';request.reject(error);}}});}
   play(){this.plays++;if(options.blockedAudio||this.blockedAudio){const error=Error('autoplay not allowed');error.name='NotAllowedError';return Promise.reject(error);}this.transition(false);if(options.pendingAudio)return new Promise((resolve,reject)=>{(options.abortOnPause===false?this.playingPromises:this.pendingPlays).push({resolve,reject});this.resolvePlay=()=>{for(const request of [...this.pendingPlays.splice(0),...this.playingPromises.splice(0)])request.resolve();};});return Promise.resolve();}
   pause(){this.pauses++;this.transition(true);}
   nativePlay(){this.transition(false);return Promise.resolve();}nativePause(){this.transition(true);}
  };
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../../public/shared/audio-settings.js'),'utf8'),context,{filename:'public/shared/audio-settings.js'});
  options.beforeLoad?.(context);
 }});
 // HTML media state changes immediately; its trusted events are separate queued tasks.
 // Programmatic and native transitions use the same trust value, so trust cannot identify intent.
 // abortOnPause:false models promises already taken by notify-playing, whose later resolve is unaffected by pause.
 return {...f,mediaEvents:events,async flushMediaEvents({limit=256}={}){let count=0;while(events.length&&count<limit){const{clip,type,afterDispatch}=events.shift();if(type==='pause')clip.dispatch('timeupdate',{type:'timeupdate',target:clip,currentTarget:clip,isTrusted:true});clip.dispatch(type,{type,target:clip,currentTarget:clip,isTrusted:true});afterDispatch?.();count++;await f.flush();}if(events.length&&limit===256)throw Error('media event loop');return count;}};
}
module.exports={mediaAudioHarness};
