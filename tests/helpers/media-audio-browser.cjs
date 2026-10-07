const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {mediaHarness}=require('./media-browser.cjs');
function mediaAudioHarness(options={}){
 const events=[];
 const f=mediaHarness({...options,beforeLoad(context){
  const MockAudio=context.Audio;
  context.Audio=class EventAudio extends MockAudio{
   constructor(){super();this._eventsReady=true;this._muted=false;this.plays=0;this.pauses=0;}
   get volume(){return this._volume;}set volume(value){const changed=this._volume!==value;this._volume=value;if(changed&&this._eventsReady)events.push({clip:this,type:'volumechange'});}
   get muted(){return this._muted;}set muted(value){const changed=this._muted!==value;this._muted=value;if(changed&&this._eventsReady)events.push({clip:this,type:'volumechange'});}
   transition(paused){if(this.paused===paused)return;this.paused=paused;events.push({clip:this,type:paused?'pause':'play'});}
   play(){this.plays++;if(options.blockedAudio)return Promise.reject(Error('blocked'));this.transition(false);if(options.pendingAudio)return new Promise(resolve=>{this.resolvePlay=resolve;});return Promise.resolve();}
   pause(){this.pauses++;this.transition(true);}
   nativePlay(){this.transition(false);return Promise.resolve();}nativePause(){this.transition(true);}
  };
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../../public/shared/audio-settings.js'),'utf8'),context,{filename:'public/shared/audio-settings.js'});
  options.beforeLoad?.(context);
 }});
 // HTML media state changes immediately; its trusted events are separate queued tasks.
 // Programmatic and native transitions use the same trust value, so trust cannot identify intent.
 return {...f,mediaEvents:events,async flushMediaEvents({limit=256}={}){let count=0;while(events.length&&count<limit){const{clip,type}=events.shift();clip.dispatch(type,{type,target:clip,currentTarget:clip,isTrusted:true});count++;await f.flush();}if(events.length&&limit===256)throw Error('media event loop');return count;}};
}
module.exports={mediaAudioHarness};
