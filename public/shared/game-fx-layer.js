/* Optional, local-only particles. Existing SVG/CSS remains the visual fallback. */
((root)=>{
 'use strict';
 const owners=new WeakMap(),contexts=new Set(),MAX_CONTEXTS=2,STRIDE=7;
 const kinds=new Set(['nitro','smoke','sparks']);
 const vertex=`attribute vec4 a_particle; attribute vec3 a_color;
 uniform vec2 u_view; uniform float u_scale; uniform float u_pointMax;
 varying mediump vec4 v_color;
 void main(){gl_Position=vec4(a_particle.x/u_view.x*2.0-1.0,1.0-a_particle.y/u_view.y*2.0,0.0,1.0);
 gl_PointSize=clamp(a_particle.z*u_scale,1.0,u_pointMax);v_color=vec4(a_color,a_particle.w);}`;
 const fragment=`precision mediump float; varying mediump vec4 v_color;
 void main(){float d=length(gl_PointCoord-vec2(0.5))*2.0;
 float alpha=(1.0-smoothstep(0.12,1.0,d))*v_color.a;
 gl_FragColor=vec4(v_color.rgb*alpha,alpha);}`;
 const bound=(value,fallback,min,max)=>Number.isFinite(value)?Math.max(min,Math.min(max,value)):fallback;
 function create(target,options={}){
  if(!target||!root.document)return inert('missing-host');
  if(owners.has(target))return owners.get(target);
  const doc=root.document,isCanvas=typeof target.getContext==='function',host=isCanvas?target.parentNode:target;
  const canvas=isCanvas?target:doc.createElement('canvas'),policy=options.policy||root.MotionPolicy;
  const maxParticles=Math.floor(bound(options.maxParticles,192,1,256)),maxEffects=Math.floor(bound(options.maxEffects,6,1,8));
  const maxDpr=bound(options.maxDpr,1.5,1,2),maxPixels=bound(options.maxPixels,1500000,1024,2000000);
  const now=options.now||(()=>root.performance.now()),request=options.requestFrame||(fn=>root.requestAnimationFrame(fn)),cancel=options.cancelFrame||(id=>root.cancelAnimationFrame(id));
  const media=root.matchMedia?.('(prefers-reduced-motion: reduce)'),seen=new Set(),effects=[];
  const data=new Float32Array(maxParticles*STRIDE);
  let gl=null,program=null,buffer=null,frame=null,destroyed=false,lost=false,failed=false,available=false,reason='uninitialized';
  let width=1,height=1,scale=1,pointMax=64,drawCalls=0,renderedParticles=0,activeKinds=[],unsubscribe=null,observer=null;
  const attributes={},uniforms={};
  canvas.classList?.add('game-fx-layer');canvas.setAttribute('aria-hidden','true');
  Object.assign(canvas.style,{position:'absolute',inset:'0',width:'100%',height:'100%',pointerEvents:'none',display:'block'});
  if(!isCanvas)host.appendChild(canvas);
  function notify(next,nextReason){available=next;reason=nextReason;try{options.onAvailability?.({available,reason});}catch{}}
  function activity(kinds){
   const next=[...kinds].sort();if(next.length===activeKinds.length&&next.every((kind,index)=>kind===activeKinds[index]))return;
   activeKinds=next;try{options.onActivity?.({active:next.length>0,kinds:[...next]});}catch{}
  }
  function connected(){return host?.isConnected!==false&&canvas.isConnected!==false;}
  function allowed(){try{return !destroyed&&!doc.hidden&&!media?.matches&&connected()&&(policy?.allowsMotion?policy.allowsMotion():policy?.get?.().enabled!==false);}catch{return false;}}
  function release(){
   try{if(buffer)gl?.deleteBuffer(buffer);if(program)gl?.deleteProgram(program);}catch{}
   buffer=program=null;
  }
  function blank(){try{if(gl&&!lost){gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);}}catch{}}
  function clear({resetSeen=false}={}){if(frame!==null){cancel(frame);frame=null;}effects.length=0;renderedParticles=0;if(resetSeen)seen.clear();blank();activity([]);}
  function fail(nextReason){failed=true;clear();release();notify(false,nextReason);}
  function resize(){
   if(destroyed)return false;
   try{
    const box=canvas.getBoundingClientRect();
    width=Math.max(1,Number.isFinite(box.width)?box.width:1);height=Math.max(1,Number.isFinite(box.height)?box.height:1);
    scale=Math.min(maxDpr,bound(root.devicePixelRatio,1,0.25,4),Math.sqrt(maxPixels/(width*height)),4096/width,4096/height);
    const w=Math.max(1,Math.floor(width*scale)),h=Math.max(1,Math.floor(height*scale));
    const changed=canvas.width!==w||canvas.height!==h;
    if(canvas.width!==w)canvas.width=w;if(canvas.height!==h)canvas.height=h;
    if(changed){renderedParticles=0;activity([]);}
    if(gl&&!lost)gl.viewport(0,0,w,h);
    return true;
   }catch{if(gl)fail('resize-failed');return false;}
  }
  function initialize(){
   if(destroyed||lost||failed)return false;
   if(available)return true;
   if(!contexts.has(canvas)&&contexts.size>=MAX_CONTEXTS){notify(false,'context-budget');return false;}
   const shaders=[];
   try{
    gl=canvas.getContext('webgl',{alpha:true,premultipliedAlpha:true,antialias:false,depth:false,stencil:false,preserveDrawingBuffer:false,powerPreference:'low-power'});
    if(!gl){fail('webgl-unavailable');return false;}
    contexts.add(canvas);
    program=gl.createProgram();if(!program)throw Error('program');
    for(const [type,source] of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragment]]){
     const shader=gl.createShader(type);if(!shader)throw Error('shader');shaders.push(shader);gl.shaderSource(shader,source);gl.compileShader(shader);gl.attachShader(program,shader);
    }
    gl.bindAttribLocation(program,0,'a_particle');gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('link');
    for(const shader of shaders)gl.deleteShader(shader);shaders.length=0;
    buffer=gl.createBuffer();if(!buffer)throw Error('buffer');
    gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,data.byteLength,gl.DYNAMIC_DRAW);
    attributes.particle=0;attributes.color=gl.getAttribLocation(program,'a_color');if(attributes.color<0)throw Error('attribute');
    for(const [index,size,offset]of [[attributes.particle,4,0],[attributes.color,3,16]]){gl.enableVertexAttribArray(index);gl.vertexAttribPointer(index,size,gl.FLOAT,false,STRIDE*4,offset);}
    for(const name of ['view','scale','pointMax'])uniforms[name]=gl.getUniformLocation(program,'u_'+name);
    pointMax=bound(Number(gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE)?.[1]),64,1,128);
    gl.disable(gl.DEPTH_TEST);gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
    resize();if(failed)return false;blank();notify(true,'ready');return true;
   }catch{for(const shader of shaders){try{gl?.deleteShader(shader);}catch{}}fail('initialization-failed');return false;}
  }
  function remember(id){if((typeof id!=='string'&&typeof id!=='number')||String(id).length===0||String(id).length>160||typeof id==='number'&&!Number.isFinite(id))return false;const key=String(id);if(seen.has(key))return false;seen.add(key);while(seen.size>256)seen.delete(seen.values().next().value);return true;}
  function point(anchor){try{const value=typeof anchor==='function'?anchor():anchor;return value&&Number.isFinite(value.x)&&Number.isFinite(value.y)?{x:value.x,y:value.y}:null;}catch{return null;}}
  function seedOf(id){let seed=2166136261;for(const char of String(id))seed=Math.imul(seed^char.charCodeAt(0),16777619);return seed>>>0;}
  function play(eventId,kind,anchor,settings={}){
   if(destroyed||!kinds.has(kind)||!remember(eventId))return false;
   const duration=bound(settings.durationMs,kind==='smoke'?1100:900,120,1800),elapsed=bound(settings.elapsedMs,0,0,120000);
   if(elapsed>=duration||!allowed()||!point(anchor)||!resize()||!initialize())return false;
   let seed=seedOf(eventId);const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
   const count=Math.min(maxParticles,Math.floor(bound(settings.count,kind==='nitro'?30:kind==='smoke'?24:36,1,48)));
   const direction=bound(settings.direction,Math.PI,-Math.PI*2,Math.PI*2),particles=[];
   for(let i=0;i<count;i++){
    const angle=direction+(random()-.5)*(kind==='sparks'?Math.PI*2:.85),speed=kind==='sparks'?55+random()*85:kind==='nitro'?55+random()*55:14+random()*20;
    particles.push({dx:Math.cos(angle)*speed,dy:Math.sin(angle)*speed,size:kind==='smoke'?15+random()*15:kind==='nitro'?7+random()*10:3+random()*4,delay:random()*duration*(kind==='sparks'?.12:.5),life:duration*(.45+random()*.35),jitter:(random()-.5)*8});
   }
   while(effects.length>=maxEffects||effects.reduce((sum,effect)=>sum+effect.particles.length,0)+count>maxParticles)effects.shift();
   effects.push({kind,anchor,duration,start:now()-elapsed,particles});
   if(frame===null)frame=request(tick);return true;
  }
  function tick(){
   frame=null;
   if(!allowed()||!available||lost){clear();return;}
   const time=now(),visibleKinds=new Set();let n=0;
   for(let i=effects.length-1;i>=0;i--){
    const effect=effects[i],age=Math.max(0,time-effect.start),at=point(effect.anchor);
    if(!at||age>=effect.duration){effects.splice(i,1);continue;}
    for(const particle of effect.particles){
     const active=age-particle.delay;if(active<0||active>=particle.life)continue;
     const t=active/1000,fraction=active/particle.life,offset=n*STRIDE,smoke=effect.kind==='smoke',nitro=effect.kind==='nitro';
     data[offset]=at.x+particle.dx*t;data[offset+1]=at.y+particle.dy*t+particle.jitter+(smoke?-15*t:0);
     data[offset+2]=particle.size*(smoke?1+fraction*.8:1-fraction*.5);data[offset+3]=(1-fraction)*(smoke?.3:.82);
     data[offset+4]=smoke?.68:nitro?.3:1;data[offset+5]=smoke?.72:nitro?.78:.62;data[offset+6]=smoke?.76:nitro?1:.18;n++;visibleKinds.add(effect.kind);
    }
   }
   renderedParticles=n;
   try{blank();if(n){gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferSubData(gl.ARRAY_BUFFER,0,data.subarray(0,n*STRIDE));gl.uniform2f(uniforms.view,width,height);gl.uniform1f(uniforms.scale,scale);gl.uniform1f(uniforms.pointMax,pointMax);gl.drawArrays(gl.POINTS,0,n);drawCalls++;}}
   catch{fail('render-failed');return;}
   // Queueing and GPU readiness do not mean a particle has reached a draw call.
   activity(n?visibleKinds:[]);
   if(frame===null&&effects.length&&allowed()&&available&&!lost)frame=request(tick);
  }
  function cancelIfBlocked(){if(!allowed())clear();}
  function onLost(event){event.preventDefault();lost=true;clear();release();notify(false,'context-lost');}
  function onRestored(){if(destroyed)return;lost=false;failed=false;available=false;initialize();}
  function destroy(){
   if(destroyed)return;destroyed=true;clear();unsubscribe?.();observer?.disconnect();
   doc.removeEventListener('visibilitychange',cancelIfBlocked);root.removeEventListener?.('pagehide',clear);
   media?.removeEventListener?.('change',cancelIfBlocked);canvas.removeEventListener('webglcontextlost',onLost);canvas.removeEventListener('webglcontextrestored',onRestored);
   release();try{gl?.getExtension('WEBGL_lose_context')?.loseContext();}catch{}contexts.delete(canvas);owners.delete(target);if(!isCanvas)canvas.remove();gl=null;notify(false,'destroyed');
  }
  const api={play,resize,clear,destroy,getState:()=>({available,reason,context:gl&&!lost?'webgl':null,renderer:available?'webgl':null,effects:effects.length,particles:renderedParticles,activeKinds:[...activeKinds],queuedParticles:effects.reduce((sum,effect)=>sum+effect.particles.length,0),seen:seen.size,frameScheduled:frame!==null,width:canvas.width,height:canvas.height,dpr:scale,drawCalls,destroyed})};
  owners.set(target,api);canvas.addEventListener('webglcontextlost',onLost);canvas.addEventListener('webglcontextrestored',onRestored);
  doc.addEventListener('visibilitychange',cancelIfBlocked);root.addEventListener?.('pagehide',clear);media?.addEventListener?.('change',cancelIfBlocked);
  unsubscribe=policy?.subscribe?.(cancelIfBlocked);
  if(root.ResizeObserver){observer=new root.ResizeObserver(()=>{resize();cancelIfBlocked();});observer.observe(canvas);}
  resize();return api;
 }
 function inert(reason){return {play:()=>false,resize:()=>false,clear(){},destroy(){},getState:()=>({available:false,reason,context:null,effects:0,particles:0,activeKinds:[],frameScheduled:false,destroyed:true})};}
 const api={create};if(typeof module==='object'&&module.exports)module.exports=api;else root.GameFxLayer=api;
})(typeof window==='object'?window:globalThis);
