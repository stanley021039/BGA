/* Optional original 3D dice. DOM faces remain the authoritative, accessible fallback. */
((root)=>{
 'use strict';
 const owners=new WeakMap(),MAX_DICE=32,MAX_PIXELS=750000,ATLAS_SIZE=512,TILE=64;
 const vertex=`attribute vec3 a_position; attribute vec3 a_normal; attribute vec2 a_uv;
 uniform vec2 u_view; uniform vec2 u_center; uniform vec2 u_angle; uniform float u_size; uniform lowp float u_shadow;
 varying mediump vec2 v_uv; varying mediump vec3 v_normal;
 vec3 rotate(vec3 p){float sx=sin(u_angle.x),cx=cos(u_angle.x),sy=sin(u_angle.y),cy=cos(u_angle.y);
 p=vec3(p.x,p.y*cx-p.z*sx,p.y*sx+p.z*cx);return vec3(p.x*cy+p.z*sy,p.y,-p.x*sy+p.z*cy);}
 void main(){vec3 p=rotate(a_position);float depth=5.0-p.z;
 vec2 xy=u_center+vec2(p.x,-p.y)*u_size*4.0/depth;
 if(u_shadow>0.5){xy=u_center+a_position.xy*u_size*vec2(1.0,0.15);depth=7.8;}
 gl_Position=vec4(xy.x/u_view.x*2.0-1.0,1.0-xy.y/u_view.y*2.0,depth/8.0,1.0);
 v_uv=a_uv;v_normal=rotate(a_normal);}`;
 const fragment=`precision mediump float; varying mediump vec2 v_uv; varying mediump vec3 v_normal;
 uniform sampler2D u_atlas;uniform lowp float u_shadow;void main(){
 if(u_shadow>0.5){float d=length((v_uv-0.5)*2.0);float alpha=(1.0-smoothstep(0.15,1.0,d))*0.19;gl_FragColor=vec4(0.0,0.0,0.0,alpha);return;}
 vec3 n=normalize(v_normal),light=normalize(vec3(-0.45,0.7,1.0));vec4 c=texture2D(u_atlas,v_uv);
 float diffuse=0.75+0.25*max(0.0,dot(n,light));float shine=pow(max(0.0,dot(n,normalize(light+vec3(0.0,0.0,1.0)))),32.0)*0.21;
 gl_FragColor=vec4(min(vec3(1.0),c.rgb*diffuse+vec3(shine)),c.a);}`;
 // Each quad is bottom-left, bottom-right, top-right, top-left as seen from outside.
 const planes=[
  [[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1],[0,0,1]],
  [[1,-1,-1],[-1,-1,-1],[-1,1,-1],[1,1,-1],[0,0,-1]],
  [[1,-1,1],[1,-1,-1],[1,1,-1],[1,1,1],[1,0,0]],
  [[-1,-1,-1],[-1,-1,1],[-1,1,1],[-1,1,-1],[-1,0,0]],
  [[-1,1,1],[1,1,1],[1,1,-1],[-1,1,-1],[0,1,0]],
  [[-1,-1,-1],[1,-1,-1],[1,-1,1],[-1,-1,1],[0,-1,0]],
 ];
 // Concentrate subdivisions around the bevel, keeping the broad ivory faces flat.
 const GRID=[-1,-.97,-.91,-.82,0,.82,.91,.97,1],SUBDIVISIONS=GRID.length-1,CORNER_RADIUS=.18,mesh=[],meshIndices=[];
 for(let face=0;face<6;face++){
  const plane=planes[face],start=mesh.length;
  for(let y=0;y<=SUBDIVISIONS;y++)for(let x=0;x<=SUBDIVISIONS;x++){
   const u=(GRID[x]+1)/2,v=(GRID[y]+1)/2,raw=plane[0].map((p,i)=>p+(plane[1][i]-p)*u+(plane[3][i]-p)*v);
   const core=raw.map(p=>Math.max(-1+CORNER_RADIUS,Math.min(1-CORNER_RADIUS,p))),delta=raw.map((p,i)=>p-core[i]),length=Math.hypot(...delta),normal=delta.map(p=>p/length);
   mesh.push({face,u,v,position:core.map((p,i)=>p+normal[i]*CORNER_RADIUS),normal});
  }
  for(let y=0;y<SUBDIVISIONS;y++)for(let x=0;x<SUBDIVISIONS;x++){
   const a=start+y*(SUBDIVISIONS+1)+x,b=a+1,c=a+SUBDIVISIONS+2,d=a+SUBDIVISIONS+1;meshIndices.push(a,b,c,a,c,d);
  }
 }
 const CUBE_INDICES=meshIndices.length,SHADOW_OFFSET=CUBE_INDICES*2;
 for(let i=0;i<4;i++)mesh.push({face:-1,u:i===1||i===2?1:0,v:i>=2?1:0,position:[i===1||i===2?1:-1,i>=2?1:-1,0],normal:[0,0,1]});
 meshIndices.push(...[0,1,2,0,2,3].map(i=>mesh.length-4+i));const indices=new Uint16Array(meshIndices);
 const clamp=(value,fallback,min,max)=>Number.isFinite(value)?Math.max(min,Math.min(max,value)):fallback;
 const faceKey=value=>typeof value==='number'&&Number.isFinite(value)?String(value):typeof value==='string'?value.slice(0,48):'?';
 // Fit the current perspective silhouette, rather than shrinking every pose equally.
 function rollingSize(point,ax,ay){
  const sx=Math.sin(ax),cx=Math.cos(ax),sy=Math.sin(ay),cy=Math.cos(ay);let ex=0,ey=0;
  for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1]){
   const py=y*cx-z*sx,pz=y*sx+z*cx,px=x*cy+pz*sy,depth=5-(-x*sy+pz*cy);
   ex=Math.max(ex,Math.abs(px*4/depth));ey=Math.max(ey,Math.abs(py*4/depth));
  }
  return Math.max(1,Math.min(point.half,(point.faceWidth/2-1)/ex,(point.faceHeight/2-1)/ey));
 }
 function paintTile(ctx,index,label){
  const x=(index%8)*TILE,y=Math.floor(index/8)*TILE;ctx.save();ctx.translate(x,y);
  ctx.fillStyle='#f8f3e6';ctx.fillRect(0,0,TILE,TILE);
  ctx.fillStyle='#20302d';ctx.strokeStyle='#20302d';ctx.lineWidth=4;ctx.lineCap='round';ctx.lineJoin='round';
  const pips={1:[[32,32]],2:[[18,18],[46,46]],3:[[18,18],[32,32],[46,46]],4:[[18,18],[46,18],[18,46],[46,46]],5:[[18,18],[46,18],[32,32],[18,46],[46,46]],6:[[18,16],[46,16],[18,32],[46,32],[18,48],[46,48]]};
  if(pips[label]){for(const [px,py]of pips[label]){
   ctx.fillStyle='#d8d0bc';ctx.beginPath();ctx.arc(px,py,6,0,Math.PI*2);ctx.fill();
   ctx.fillStyle='#20302d';ctx.beginPath();ctx.arc(px,py-.6,4.9,0,Math.PI*2);ctx.fill();
  }}
  else if(/^(前|後|左|右|前方|後方|前左|前右|後左|後右)$/.test(label)){
   const dx=label.includes('左')?-1:label.includes('右')?1:0,dy=label.includes('前')?-1:label.includes('後')?1:0;
   ctx.translate(32,32);ctx.rotate(Math.atan2(dy,dx)+Math.PI/2);ctx.beginPath();ctx.moveTo(0,19);ctx.lineTo(0,-18);ctx.moveTo(-12,-6);ctx.lineTo(0,-18);ctx.lineTo(12,-6);ctx.stroke();
  }else if(label==='out'){
   ctx.beginPath();ctx.moveTo(32,13);ctx.bezierCurveTo(8,38,22,53,32,53);ctx.bezierCurveTo(47,53,54,36,32,13);ctx.stroke();ctx.strokeStyle='#a63b33';ctx.beginPath();ctx.moveTo(13,51);ctx.lineTo(51,13);ctx.stroke();
  }else if(label==='eliminate'){
   ctx.strokeStyle='#a63b33';ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(17,17);ctx.lineTo(47,47);ctx.moveTo(47,17);ctx.lineTo(17,47);ctx.stroke();
  }else{
   const short=label==='進入車'?'進入':label==='原位車'?'原位':label.length>4?label.slice(0,3)+'…':label;
   ctx.font=`700 ${short.length>=4?22:short.length>=3?26:32}px system-ui, sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(short,32,33,54);
  }
  ctx.restore();
 }
 function create(host,options={}){
  if(!host||!root.document)return inert();if(owners.has(host))return owners.get(host);
  const doc=root.document,canvas=doc.createElement('canvas'),atlas=doc.createElement('canvas'),policy=options.policy||root.MotionPolicy,media=root.matchMedia?.('(prefers-reduced-motion: reduce)');
  canvas.classList?.add('race-dice-webgl');canvas.setAttribute('aria-hidden','true');
  Object.assign(canvas.style,{position:'absolute',left:'0',top:'0',pointerEvents:'none',display:'none',zIndex:'1'});host.appendChild(canvas);
  atlas.width=atlas.height=ATLAS_SIZE;
  const seen=new Set(),data=new Float32Array(mesh.length*8),uniforms={};
  let gl=null,program=null,buffer=null,indexBuffer=null,texture=null,reserved=false,lost=false,failed=false,destroyed=false,retiring=false,frame=null,current=null,active=false,anchors=[],width=1,height=1,dpr=1,drawCalls=0,reason='uninitialized',atlasSignature='',unsubscribe=null,observer=null,lastGeometry='';
  const now=()=>root.performance.now();
  function activity(next,nextAnchors=[]){
   if(active===next&&anchors.length===nextAnchors.length&&anchors.every((a,i)=>a===nextAnchors[i]))return;
   active=next;anchors=nextAnchors;try{options.onActivity?.({active,anchors:[...anchors]});}catch{}
  }
  function allowed(){try{return !destroyed&&!doc.hidden&&!media?.matches&&host.isConnected!==false&&(policy?.allowsMotion?policy.allowsMotion():policy?.get?.().enabled!==false);}catch{return false;}}
  function cancel(){if(frame!==null){root.cancelAnimationFrame(frame);frame=null;}}
  function blank(){canvas.style.display='none';try{if(gl&&!lost){gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);}}catch{}activity(false);}
  function clear(){cancel();current=null;blank();}
  function release({keepSlot=false}={}){
   try{if(buffer)gl?.deleteBuffer(buffer);if(indexBuffer)gl?.deleteBuffer(indexBuffer);if(texture)gl?.deleteTexture(texture);if(program)gl?.deleteProgram(program);}catch{}
   buffer=indexBuffer=texture=program=null;atlasSignature='';
   // Retire the real context before giving its shared slot to another renderer.
   if(gl&&!lost){retiring=true;try{gl.getExtension('WEBGL_lose_context')?.loseContext();}catch{}retiring=false;}gl=null;
   if(reserved&&!keepSlot){root.GameFxLayer?.releaseContext?.(canvas);reserved=false;}
  }
  function fail(why){failed=true;reason=why;clear();release();}
  function size(){
   const box=host.getBoundingClientRect();width=Math.max(1,host.clientWidth||box.width||1);height=Math.max(1,host.clientHeight||box.height||1);
   dpr=Math.min(clamp(root.devicePixelRatio,1,.25,1.5),Math.sqrt(MAX_PIXELS/(width*height)),4096/width,4096/height);
   const w=Math.max(1,Math.floor(width*dpr)),h=Math.max(1,Math.floor(height*dpr)),changed=canvas.width!==w||canvas.height!==h;
   canvas.style.width=width+'px';canvas.style.height=height+'px';canvas.style.transform=`translate(${host.scrollLeft||0}px,${host.scrollTop||0}px)`;
   if(canvas.width!==w)canvas.width=w;if(canvas.height!==h)canvas.height=h;
   if(gl)gl.viewport(0,0,w,h);return {box,changed};
  }
  function initialize(){
   if(gl&&program)return true;if(destroyed||lost||failed)return false;
   if(!reserved&&!root.GameFxLayer?.acquireContext?.(canvas)){reason='context-budget';return false;}reserved=true;
   const shaders=[];
   try{
    gl=canvas.getContext('webgl',{alpha:true,antialias:true,depth:true,stencil:false,premultipliedAlpha:true,preserveDrawingBuffer:false,powerPreference:'low-power'});if(!gl)throw Error('context');
    program=gl.createProgram();if(!program)throw Error('program');
    for(const [type,source]of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragment]]){
     const shader=gl.createShader(type);if(!shader)throw Error('shader');shaders.push(shader);gl.shaderSource(shader,source);gl.compileShader(shader);
     if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error('compile');gl.attachShader(program,shader);
    }
    gl.bindAttribLocation(program,0,'a_position');gl.bindAttribLocation(program,1,'a_normal');gl.bindAttribLocation(program,2,'a_uv');gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('link');for(const shader of shaders)gl.deleteShader(shader);shaders.length=0;
    buffer=gl.createBuffer();indexBuffer=gl.createBuffer();texture=gl.createTexture();if(!buffer||!indexBuffer||!texture)throw Error('resource');
    gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,data.byteLength,gl.DYNAMIC_DRAW);
    for(const [i,n,offset]of [[0,3,0],[1,3,12],[2,2,24]]){gl.enableVertexAttribArray(i);gl.vertexAttribPointer(i,n,gl.FLOAT,false,32,offset);}
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,indexBuffer);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,indices,gl.STATIC_DRAW);
    for(const name of ['view','center','angle','size','atlas','shadow'])uniforms[name]=gl.getUniformLocation(program,'u_'+name);
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);
    for(const name of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,name,gl.CLAMP_TO_EDGE);
    for(const name of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,name,gl.LINEAR);
    gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.CULL_FACE);gl.disable(gl.BLEND);reason='ready';return true;
   }catch{for(const shader of shaders){try{gl?.deleteShader(shader);}catch{}}fail('initialization-failed');return false;}
  }
  function prepareAtlas(job){
   const labels=[...new Set(job.dice.flatMap(d=>d.shownFaces))];if(labels.length>64)throw Error('atlas-budget');
   const signature=JSON.stringify(labels);if(signature!==atlasSignature){
    const ctx=atlas.getContext('2d');if(!ctx)throw Error('atlas-context');ctx.clearRect(0,0,ATLAS_SIZE,ATLAS_SIZE);labels.forEach((label,index)=>paintTile(ctx,index,label));
    gl.bindTexture(gl.TEXTURE_2D,texture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,atlas);atlasSignature=signature;
   }return new Map(labels.map((label,i)=>[label,i]));
  }
  function vertices(die,map){
   if(die.geometry&&die.atlasSignature===atlasSignature){gl.bufferSubData(gl.ARRAY_BUFFER,0,die.geometry);return;}
   const faces=die.shownFaces;
   for(let i=0;i<mesh.length;i++){
    const item=mesh[i];let uv=[item.u,item.v];
    if(item.face>=0){const slot=map.get(faces[item.face]),col=slot%8,row=Math.floor(slot/8);uv=[(col*TILE+4+item.u*56)/ATLAS_SIZE,1-(row*TILE+60-item.v*56)/ATLAS_SIZE];}
    data.set([...item.position,...item.normal,...uv],i*8);
   }die.geometry=new Float32Array(data);die.atlasSignature=atlasSignature;gl.bufferSubData(gl.ARRAY_BUFFER,0,die.geometry);
  }
  function position(anchor,box){
   if(!anchor||anchor.isConnected===false)return null;
   // CSS fallback tumbling changes the face bounding rect; its parent slot is stable.
   const tile=anchor.parentElement||anchor,rect=tile.getBoundingClientRect(),faceWidth=anchor.offsetWidth||56,faceHeight=anchor.offsetHeight||56;
   if(!Number.isFinite(rect.left)||!Number.isFinite(rect.top)||!(rect.width>0)||!(rect.height>0))return null;
   const offsetParent=anchor.offsetParent,parentBox=offsetParent?.getBoundingClientRect?.();
   const x=rect.left+rect.width/2-box.left-(host.clientLeft||0);
   const top=parentBox?parentBox.top+(offsetParent.clientTop||0)+(anchor.offsetTop||0)-(offsetParent.scrollTop||0):rect.top+(anchor.offsetTop||0);
   const y=top+faceHeight/2-box.top-(host.clientTop||0);
   const half=Math.min(36,Math.max(24,Math.min(faceWidth,faceHeight)*.46));
   if(x+half*1.5<=0||x-half*1.5>=width||y+half*1.5<=0||y-half*1.5>=height)return null;
   return {x,y,half,faceWidth,faceHeight};
  }
  function draw(job){
   if(current!==job||!allowed()){clear();return false;}
   try{
    const {box}=size();if(!initialize())return false;
    gl.viewport(0,0,canvas.width,canvas.height);gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,indexBuffer);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);
    const map=prepareAtlas(job),elapsed=Math.max(0,now()-job.started),progress=Math.min(1,elapsed/job.duration),covered=[];
    gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.uniform2f(uniforms.view,width,height);gl.uniform1i(uniforms.atlas,0);
    for(let i=0;i<job.dice.length;i++){
     const die=job.dice[i],point=position(die.anchor,box);if(!point)continue;
     vertices(die,map);const phase=(i%7)*.19,ease=1-Math.pow(1-progress,3),roll=job.stage==='rolling';
     const settle=roll&&progress>.82?Math.sin((progress-.82)/.18*Math.PI*2)*(1-progress)*.42:0;
     const ax=roll?.22+(1-ease)*(Math.PI*3+phase)+settle:.22,ay=roll?-.3+(1-ease)*(Math.PI*4+phase)-settle*.65:-.3;
     const fitted=roll?rollingSize(point,ax,ay):point.half;
     gl.uniform1f(uniforms.shadow,1);gl.uniform2f(uniforms.center,point.x,point.y+point.faceHeight/2-5);gl.uniform1f(uniforms.size,Math.min(fitted,point.faceWidth/2-1));
     gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);gl.drawElements(gl.TRIANGLES,6,gl.UNSIGNED_SHORT,SHADOW_OFFSET);gl.depthMask(true);gl.disable(gl.BLEND);
     gl.uniform1f(uniforms.shadow,0);gl.uniform2f(uniforms.center,point.x,point.y);gl.uniform1f(uniforms.size,fitted);
     gl.uniform2f(uniforms.angle,ax,ay);
     gl.drawElements(gl.TRIANGLES,CUBE_INDICES,gl.UNSIGNED_SHORT,0);drawCalls++;covered.push(die.anchor);
    }
    // Error checks are synchronous driver queries; once per new job, never each rolling frame.
    if(!job.checked){if(gl.getError()!==gl.NO_ERROR)throw Error('draw');job.checked=true;}
    canvas.style.display=covered.length?'block':'none';lastGeometry=geometrySignature(job);activity(covered.length>0,covered);
    if(current!==job||destroyed)return false;
    if(job.stage==='rolling'&&progress<1){if(frame===null)frame=root.requestAnimationFrame(()=>{frame=null;draw(job);});}
    return covered.length>0;
   }catch{fail('render-failed');return false;}
  }
  function show(input={}){
   if(destroyed)return false;
   const key=typeof input.key==='string'||typeof input.key==='number'?String(input.key):'',stage=input.stage;
   if(!key||key.length>200||!['rolling','result'].includes(stage)||!Array.isArray(input.dice)||!input.dice.length||input.dice.length>MAX_DICE)return false;
   const id=key+'|'+stage;
   if(current?.id===id){
    // Rebuilt slots may be rebound; the original clock remains unchanged.
    const next=input.dice;if(next.length===current.dice.length&&next.some((die,i)=>die.anchor!==current.dice[i].anchor)){current.dice.forEach((die,i)=>{die.anchor=next[i].anchor;});return draw(current);}
    return active;
   }
   if(seen.has(id))return false;seen.add(id);while(seen.size>256)seen.delete(seen.values().next().value);
   clear();if(!allowed()||lost||failed)return false;
   // Snapshot only public possible faces while rolling. Do not even access value.
   const dice=[];
   for(const die of input.dice){
    if(!die?.anchor||!Array.isArray(die.faces)||!die.faces.length)return false;
    const possible=Array.from({length:6},(_,i)=>faceKey(die.faces[i%die.faces.length]));
    dice.push({anchor:die.anchor,shownFaces:stage==='result'?[faceKey(die.value),...possible.slice(1)]:possible});
   }
   const duration=clamp(input.durationMs,1000,100,2000),elapsed=clamp(input.elapsedMs,0,0,duration);
   current={id,key,stage,dice,duration,started:now()-elapsed};return draw(current);
  }
  function geometrySignature(job){const box=host.getBoundingClientRect();return JSON.stringify([host.clientWidth||box.width,host.clientHeight||box.height,host.scrollLeft||0,host.scrollTop||0,...job.dice.map(die=>{const rect=die.anchor.parentElement?.getBoundingClientRect?.();return rect?[rect.left,rect.top,rect.width,rect.height]:null;})]);}
  function refresh(){if(!current||!allowed())return;if(geometrySignature(current)!==lastGeometry&&(current.stage==='result'||frame===null))draw(current);}
  function motion(){if(!allowed())clear();}
  function contextLost(event){event.preventDefault?.();if(retiring||destroyed||failed)return;lost=true;reason='context-lost';clear();release({keepSlot:true});}
  function contextRestored(){if(!lost||failed||destroyed)return;lost=false;reason='restored-idle';}
  function destroy(){
   if(destroyed)return;clear();destroyed=true;unsubscribe?.();observer?.disconnect();
   for(const [target,type,fn]of listeners)target.removeEventListener?.(type,fn);release();canvas.remove();owners.delete(host);reason='destroyed';
  }
  const listeners=[[doc,'visibilitychange',motion],[root,'pagehide',clear],[host,'scroll',refresh],[root,'resize',refresh],[canvas,'webglcontextlost',contextLost],[canvas,'webglcontextrestored',contextRestored],[media,'change',motion]].filter(([target])=>target);
  for(const [target,type,fn]of listeners)target.addEventListener?.(type,fn);
  unsubscribe=policy?.subscribe?.(motion);if(root.ResizeObserver){observer=new root.ResizeObserver(refresh);observer.observe(host);}
  const api={show,clear,destroy,getState:()=>({renderer:'webgl',available:!!program&&!lost&&!failed,active,anchors:anchors.length,stage:current?.stage||null,key:current?.key||null,dice:current?.dice.length||0,frameScheduled:frame!==null,width,height,dpr,pixels:canvas.width*canvas.height,drawCalls,seen:seen.size,reason,destroyed})};owners.set(host,api);return api;
 }
 function inert(){return {show:()=>false,clear(){},destroy(){},getState:()=>({active:false,available:false,reason:'missing-host'})};}
 root.RaceDiceWebGL={create};
})(window);
