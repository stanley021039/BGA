/* Original ingredient illustrations and cauldron geometry. No game mutations. */
(function(root){
'use strict';
const names={white:'白色炸彈',orange:'南瓜',blue:'烏鴉頭骨',red:'毒蘑菇',yellow:'曼德拉草',green:'花園蜘蛛',black:'非洲骷髏天蛾',purple:'幽靈氣息',locoweed:'愚人草'};
const palette={white:['#d8eee8','#fffdf0','#314d4a'],orange:['#dc8c38','#ffd68c','#643c20'],blue:['#478ec1','#c4e4ef','#153e58'],red:['#c95e61','#f8c7b6','#662a33'],yellow:['#c2aa40','#f5e297','#51451b'],green:['#548f65','#c4e4b7','#234735'],black:['#485268','#b7b7b7','#172331'],purple:['#a676c0','#edd6f2','#553364'],locoweed:['#c9749c','#f7cde1','#6f3354']};
const icons={
 white:[['circle',{cx:22,cy:30,r:18,fill:'#ebf4df',stroke:'#61746b','stroke-width':2}],['ellipse',{cx:17,cy:23,rx:6,ry:8,fill:'#fffdf0'}],['path',{d:'M16 13h12v6H16Z',fill:'#5e6b62'}],['path',{d:'M23 13q7-9 13-6',stroke:'#d5b97c',fill:'none','stroke-width':3}],['path',{d:'m37 1 2 5 5-2-2 5 4 2-5 1 1 5-4-3-3 4v-6l-5-1 5-3Z',fill:'#f4c16d'}]],
 orange:[['path',{d:'M21 17q-1-9 5-12l4 3q-5 2-4 9',fill:'#708f4a'}],['ellipse',{cx:22,cy:31,rx:19,ry:16,fill:'#e98f34'}],['ellipse',{cx:22,cy:31,rx:10,ry:16,fill:'#f7b04f'}],['path',{d:'M22 17v29M8 23q-4 12 4 19M36 23q4 12-4 19',stroke:'#ae5d27',fill:'none','stroke-width':2}],['path',{d:'M25 13q10-6 14 2-10 5-14-2',fill:'#82924b'}]],
 blue:[['path',{d:'M10 31q-8-15 2-23 14-7 24 4 7 10-1 20l-5 3v8H14v-8Z',fill:'#f4efd8'}],['path',{d:'m34 23 9 4-10 6Z',fill:'#d4c49d'}],['ellipse',{cx:14,cy:23,rx:5,ry:6,fill:'#344f64'}],['ellipse',{cx:29,cy:23,rx:5,ry:6,fill:'#344f64'}],['path',{d:'m21 30-3 5h7ZM17 38v5M23 38v5M29 36v5',fill:'#536c76',stroke:'#536c76','stroke-width':2}]],
 red:[['path',{d:'M17 27h11l3 19H14Z',fill:'#f7e8c5'}],['path',{d:'M2 27q4-23 20-22 18 0 21 22-20 6-41 0',fill:'#e46d69'}],['ellipse',{cx:22,cy:28,rx:19,ry:3,fill:'#98434a'}],['circle',{cx:13,cy:17,r:3,fill:'#fff4d6'}],['circle',{cx:27,cy:12,r:3,fill:'#fff4d6'}],['circle',{cx:34,cy:21,r:2.5,fill:'#fff4d6'}],['path',{d:'m20 33-1 10M26 33l2 10',stroke:'#d9c597',fill:'none','stroke-width':2}]],
 yellow:[['path',{d:'M22 20Q9 15 5 6q14-2 17 14Q29 5 41 7q-2 13-19 13',fill:'#749b58'}],['path',{d:'M17 19q-4 7 0 16l-8 8 3 5 11-11 10 11 4-5-9-9q5-8-1-15Z',fill:'#debe75'}],['path',{d:'M17 28 8 34M29 27l10 6',fill:'none',stroke:'#debe75','stroke-width':5,'stroke-linecap':'round'}],['circle',{cx:20,cy:26,r:1.5,fill:'#7b6032'}],['circle',{cx:26,cy:26,r:1.5,fill:'#7b6032'}]],
 green:[['path',{d:'M17 23 5 16 1 7M17 27 4 25 0 18M17 32 5 35 1 43M18 36 11 43 11 49M27 23 39 16 43 7M27 27 40 25 44 18M27 32 39 35 43 43M26 36 33 43 33 49',stroke:'#c0dda1','stroke-width':3,fill:'none','stroke-linecap':'round'}],['ellipse',{cx:22,cy:30,rx:10,ry:14,fill:'#91b96d'}],['circle',{cx:22,cy:17,r:7,fill:'#bfd393'}],['circle',{cx:19,cy:15,r:2,fill:'#274a37'}],['circle',{cx:25,cy:15,r:2,fill:'#274a37'}],['path',{d:'m22 23-4 9 4 6 4-6Z',fill:'#46774e'}]],
 black:[['path',{d:'M20 23Q4 0 1 10q-5 24 15 27L6 47q10 4 15-10M24 23Q40 0 43 10q5 24-15 27l10 10q-10 4-15-10',fill:'#c3aa75',stroke:'#e4d3a2','stroke-width':1.5}],['path',{d:'M22 13q-6 4-4 19l4 16 4-16q2-15-4-19',fill:'#293849'}],['circle',{cx:22,cy:9,r:5,fill:'#dfcfac'}],['circle',{cx:20,cy:9,r:1.5,fill:'#25303d'}],['circle',{cx:24,cy:9,r:1.5,fill:'#25303d'}],['path',{d:'M18 4 12 0M26 4l6-4',stroke:'#cfbd8e',fill:'none','stroke-width':2}]],
 purple:[['path',{d:'M6 39q-8-16 4-22-4-10 5-14 12-6 20 6 8 12-1 18 13 8 5 18l-9-5-6 8-8-8Z',fill:'#ead1f0'}],['path',{d:'M10 38q-3-13 8-17M30 8q9 13 0 18',stroke:'#ba89c9',fill:'none','stroke-width':3}],['ellipse',{cx:19,cy:17,rx:3,ry:4,fill:'#654377'}],['ellipse',{cx:29,cy:17,rx:3,ry:4,fill:'#654377'}],['path',{d:'M19 28q5 4 10-1',stroke:'#866095',fill:'none','stroke-width':2}]],
 locoweed:[['path',{d:'M22 46V21M22 35q-14 0-15-11 12-3 15 11M22 40q15-1 16-12-14-1-16 12',fill:'#a8c488',stroke:'#80a76a','stroke-width':2}],['path',{d:'M22 6q9-10 12-1l-3 9q13-1 12 8-2 8-14 5-2 15-10 9-7-5-1-12-15 4-15-6 1-8 13-6-8-11 1-12Z',fill:'#ebabc8'}],['circle',{cx:23,cy:19,r:7,fill:'#f5d184'}]]
};
let serial=0;
const sv=(name,a={},text)=>{const n=document.createElementNS('http://www.w3.org/2000/svg',name);for(const [k,v]of Object.entries(a))n.setAttribute(k,String(v));if(text!==undefined)n.textContent=text;return n;};
function glyph(color,x=0,y=0,size=44){const g=sv('g',{transform:'translate('+x+' '+y+') scale('+size/44+')'});for(const [tag,attrs]of icons[color]||icons.white)g.append(sv(tag,attrs));return g;}
function token(c,{size=48,decorative=false,showValue=true}={}){
 const color=palette[c.color]?c.color:'white',p=palette[color],svg=sv('svg',{viewBox:'0 0 64 64',width:size,height:size,class:'ingredient-token','aria-hidden':decorative?'true':'false',role:'img','aria-label':names[color]+' '+c.value});
 svg.append(sv('title',{},names[color]+' · 數值 '+c.value),sv('circle',{cx:31,cy:30,r:27,fill:'#18241f',opacity:.26}),sv('circle',{cx:31,cy:28,r:26,fill:p[0],stroke:p[1],'stroke-width':2}),sv('circle',{cx:31,cy:28,r:22,fill:'none',stroke:p[1],opacity:.3}),glyph(color,13,5,36));if(showValue)svg.append(sv('circle',{cx:49,cy:49,r:13,fill:p[2],stroke:'#f6e8c6','stroke-width':2}),sv('text',{x:49,y:54,'text-anchor':'middle','font-family':'sans-serif','font-size':15,'font-weight':800,fill:'#fff7db'},c.value));
 return svg;
}
const position=i=>{const r=78+i*4.05,a=1.55+i*.50;return {x:360+r*Math.cos(a),y:326+r*Math.sin(a)*.87};};
function canInspect(s,p){return !!p&&(p.id===s.me||!p.hidden&&Array.isArray(p.pot));}
function selectRecipe(s,id){return s.recipes.find(p=>p.id===id&&canInspect(s,p))||s.recipes.find(p=>p.id===s.me);}
function lookup(s,color){return s.books.find(b=>b.color===color)||s.bookSelection?.find(b=>b.color===color)?.candidates.find(b=>b.set===s.options.books?.[color]);}
function info(s,p,tile,c){
 const text=c?names[c.color]+' · 數值 '+c.value:'第 '+tile.position+' 格 · 空格';
 let effect=!c?'這一格沒有藥材。':c.noEffect?'此片由強效碎片投入，不觸發藥材書效果。':c.color==='white'?'白色數值合計超過 '+p.threshold+' 時大釜爆炸；這片計入 '+c.value+'。':lookup(s,c.color)?.effect||'按數值前進，沒有特殊效果。';
 if(c&&!c.noEffect&&c.effectColor&&c.effectColor!==c.color)effect+=' 本片模仿'+names[c.effectColor]+'：'+(lookup(s,c.effectColor)?.effect||'按效果數值前進。');
 return {title:text,color:c?.color||'empty',effect,caption:'格位 '+tile.position+' · '+tile.coins+' 金幣 · '+tile.points+' 分'+(tile.ruby?' · 紅寶石':'')+(c?.effectColor&&c.effectColor!==c.color?' · 本次模仿'+names[c.effectColor]+'（'+c.effectValue+'）':'')};
}
function cauldron(s,p,onInspect){
 if(!canInspect(s,p)||!Array.isArray(p.pot))throw Error('大釜資料尚未公開');
 const tones=s.potColors?.[p.potColor]?.liquid||['#4f9876','#27684f','#10342d'];
 const id='quacks-art-'+(++serial),svg=sv('svg',{viewBox:s.options.witches?'0 0 720 780':'0 0 720 680',class:'cauldron',role:'group','aria-label':p.name+' 的大釜，進度 '+(p.position||0)+' 格'});
 const defs=sv('defs');
 const gradient=(name,type,attrs,stops)=>{const g=sv(type,{id:id+'-'+name,...attrs});for(const [offset,color]of stops)g.append(sv('stop',{offset,'stop-color':color}));defs.append(g);};
 gradient('copper','linearGradient',{x1:0,y1:0,x2:1,y2:1},[['0%','#f0d7a1'],['18%','#a57843'],['45%','#352f26'],['72%','#be995f'],['100%','#554332']]);
 gradient('liquid','radialGradient',{cx:'.42',cy:'.35',r:'.7'},[['0%',tones[0]],['45%',tones[1]],['100%',tones[2]]]);
 gradient('body','linearGradient',{x1:0,y1:0,x2:0,y2:1},[['0%','#594e3b'],['45%','#263630'],['100%','#111e1b']]);svg.append(defs);
 svg.append(sv('ellipse',{cx:360,cy:640,rx:255,ry:19,fill:'#000',opacity:.25}));
 for(const side of [-1,1])svg.append(sv('ellipse',{cx:360+side*316,cy:336,rx:29,ry:65,fill:'none',stroke:'#aa8a58','stroke-width':14}),sv('ellipse',{cx:360+side*316,cy:336,rx:29,ry:65,fill:'none',stroke:'#443b2b','stroke-width':5}));
 svg.append(sv('ellipse',{cx:360,cy:349,rx:315,ry:290,fill:'url(#'+id+'-body)',stroke:'#d0ae74','stroke-width':3}),sv('ellipse',{cx:360,cy:326,rx:316,ry:283,fill:'none',stroke:'url(#'+id+'-copper)','stroke-width':25}),sv('ellipse',{cx:360,cy:326,rx:297,ry:266,fill:'url(#'+id+'-liquid)',stroke:'#182f28','stroke-width':7}));
 // Soft still bubbles, not flashing decorative animations.
 for(const [x,y,r]of [[115,264,10],[558,178,8],[438,91,5],[254,557,6],[589,428,10],[346,175,7],[200,398,5],[493,506,4]])svg.append(sv('circle',{cx:x,cy:y,r,fill:'#9ec8a6',opacity:.18}),sv('path',{d:'M'+(x-r/2)+' '+(y-r/3)+'q'+r/3+' '+(-r/3)+' '+r/2+' 0',stroke:'#d3ead0',fill:'none',opacity:.5,'stroke-width':2}));
 const points=s.board.slice(0,-1).map((_,i)=>position(i));svg.append(sv('polyline',{points:points.map(p=>p.x+','+p.y).join(' '),fill:'none',stroke:'#d7d3a0','stroke-width':18,opacity:.06,'stroke-linejoin':'round'}),sv('polyline',{points:points.map(p=>p.x+','+p.y).join(' '),fill:'none',stroke:'#d0c78c','stroke-width':2,opacity:.32,'stroke-linejoin':'round'}));
 const placed=new Map(p.pot.map(c=>[c.position,c])),slots=[];let focused=Math.max(0,Math.min(52,p.position||0));
 for(const tile of s.board.slice(0,-1)){
  const i=tile.position,v=position(i),c=placed.get(i),details=info(s,p,tile,c),group=sv('g',{class:'pot-space'+(c?' occupied':''),transform:'translate('+v.x+' '+v.y+')',tabindex:i===focused?0:-1,role:'button','aria-label':details.title+'，'+details.caption,'data-position':i});
  group.append(sv('title',{},details.title+'。'+details.effect+' '+details.caption),sv('circle',{r:15,fill:i<=(p.position||0)?'#618861':'#24513e',stroke:'#a8bd85','stroke-width':1,opacity:.85}));
  if(c){const t=token(c,{size:42,decorative:true});t.setAttribute('x',-21);t.setAttribute('y',-23);group.append(t);}
  else{
   group.append(sv('text',{x:0,y:4,'text-anchor':'middle','font-family':'sans-serif','font-size':11,'font-weight':650,fill:'#e3e9c0'},tile.coins));
   if(tile.ruby)group.append(sv('path',{d:'M9-17 14-13 12-6 7-9Z',fill:'#e092a0',stroke:'#f7ccbe','stroke-width':1}));
  }
  const show=event=>{for(const n of slots)n.setAttribute('tabindex',n===group?'0':'-1');focused=i;onInspect?.(details,event,group);};
  group.addEventListener('pointerenter',show);group.addEventListener('focus',show);group.addEventListener('click',show);
  slots.push(group);svg.append(group);
 }
 svg.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key))return;event.preventDefault();const delta=['ArrowLeft','ArrowUp'].includes(event.key)?-1:1;focused=event.key==='Home'?0:event.key==='End'?52:Math.max(0,Math.min(52,focused+delta));slots[focused]?.focus();});
 const markers=markerPositions(p),drop=position(markers.droplet),start=position(markers.start),current=position(Math.max(0,p.position||0));
 const permanent=sv('g',{class:'pot-droplet','data-position':markers.droplet,'pointer-events':'none'});permanent.append(sv('title',{},'永久水滴：第 '+markers.droplet+' 格'),sv('path',{d:'M'+drop.x+' '+(drop.y-22)+'q-10-13 0-22 10 9 0 22Z',fill:'#8fcee0',stroke:'#d6f4e7','stroke-width':2}));svg.append(permanent);
 if(markers.start!==markers.droplet){const stone=sv('g',{class:'pot-rat-stone','data-position':markers.start,'pointer-events':'none'});stone.append(sv('title',{},'本輪老鼠石起點：第 '+markers.start+' 格'),sv('circle',{cx:start.x,cy:start.y-29,r:13,fill:'#ac8770',stroke:'#f2d9ae','stroke-width':2}),sv('path',{d:'M'+(start.x-6)+' '+(start.y-27)+'q-3-11 6-8q7 0 7 7q-4 7-10 3m8-1q13 10 17 0',fill:'#d7c3a0',stroke:'#563f30','stroke-width':2}));svg.append(stone);}
 svg.append(sv('circle',{cx:current.x,cy:current.y,r:25,fill:'none',stroke:p.exploded?'#ec8877':'#f1d391','stroke-width':3,'pointer-events':'none'}));
 const name=p.potName||p.name+'的好運釜',nameStyle={'font-size':15,...([...name].reduce((n,c)=>n+(/[\u0000-\u007f]/.test(c)?8:15),0)>300?{textLength:300,lengthAdjust:'spacingAndGlyphs'}:{})};
 svg.append(sv('rect',{x:180,y:615,width:360,height:37,rx:14,fill:'#1a2f28',stroke:'#b19262'}),sv('text',{x:360,y:640,'text-anchor':'middle','font-family':'sans-serif',fill:'#e9dbb8',class:'pot-name',...nameStyle},name));

 if(s.options.witches){
  const chips=p.overflow||[],sum=chips.reduce((n,c)=>n+(c.effectValue??c.value),0),points=Math.floor(sum/2),g=sv('g',{class:'overflow-basin',tabindex:0,role:'group','aria-label':'溢出盆，'+chips.length+' 片，'+points+' 分'});
  const details={title:'溢出盆 · '+chips.length+' 片 · '+points+' 分',effect:'到達第52格後，後續藥材進入溢出盆。盆內有效數值合計 '+sum+'，每2點值換1分，無條件捨去。',caption:'本輪若可領取分數，結算會加計 '+points+' 分。白色炸彈仍計入爆炸門檻。',color:'overflow'};
  g.append(sv('title',{},details.title+'。'+details.effect),sv('ellipse',{cx:551,cy:752,rx:128,ry:14,fill:'#0c1726',opacity:.35}),sv('path',{d:'M421 685q5 72 130 72t130-72Z',fill:'url(#'+id+'-body)',stroke:'#c5a570','stroke-width':3}),sv('ellipse',{cx:551,cy:685,rx:130,ry:33,fill:'url(#'+id+'-copper)',stroke:'#ebd6ac','stroke-width':3}),sv('ellipse',{cx:551,cy:685,rx:116,ry:23,fill:'url(#'+id+'-liquid)',stroke:'#293b44','stroke-width':2}));
  const reward=sv('g',{transform:'translate(443 724)'});reward.append(sv('path',{d:'m0-9 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z',fill:'#edc781'}),sv('text',{x:16,y:6,'font-size':20,'font-weight':800,fill:'#f8e1a1'},points));g.append(reward);
  for(const [i,c]of chips.slice(-6).entries()){const chip=sv('g',{class:'overflow-chip',transform:'translate('+(462+i*30)+' 667)',tabindex:0,role:'button','aria-label':names[c.color]+' '+c.value});chip.append(token(c,{size:32,decorative:true}));const d={title:names[c.color]+' · '+c.value,effect:lookup(s,c.color)?.effect||'白色炸彈數值仍會計入爆炸門檻。',caption:'溢出盆有效數值 '+(c.effectValue??c.value)+'；只計溢出值，不觸發一般藥材效果。',color:c.color};for(const type of ['pointerenter','focus','click'])chip.addEventListener(type,event=>{event.stopPropagation();onInspect?.(d,event,chip);});g.append(chip);}
  if(chips.length>6)g.append(sv('text',{x:645,y:735,'font-size':14,'text-anchor':'middle',fill:'#f4ddb1'},'+'+(chips.length-6)));
  for(const type of ['pointerenter','focus','click'])g.addEventListener(type,event=>onInspect?.(details,event,g));svg.append(g);
 }
 return svg;
}

function resource(kind,{size=42,decorative=false}={}){
 const labels={bag:'藥袋',ruby:'紅寶石',rat:'老鼠尾巴',droplet:'水滴',gold:'金女巫幣',copper:'銅女巫幣',silver:'銀女巫幣',potion:'藥水瓶',essence:'特效藥','draw-hand':'伸手抽藥材','stop-hands':'雙手食指交叉停止'},svg=sv('svg',{viewBox:'0 0 80 80',width:size,height:size,class:'quacks-resource '+kind,role:'img','aria-hidden':decorative?'true':'false','aria-label':labels[kind]||kind});
 if(kind==='bag'){svg.append(sv('path',{d:'M23 8Q40 1 58 8l-5 15Q78 40 68 66q-26 15-56 0Q1 40 28 23Z',fill:'#ac7642',stroke:'#ecd09a','stroke-width':2}),sv('path',{d:'M28 24Q5 48 23 65M53 24q20 28 3 42M34 23v39',stroke:'#80512e',fill:'none','stroke-width':4,opacity:.6}),sv('path',{d:'M23 20q16 8 33 0M25 26q16 4 31-2',stroke:'#ecbf73',fill:'none','stroke-width':4,'stroke-linecap':'round'}),sv('path',{d:'m42 24 18 10M40 25 22 37',stroke:'#ead29a','stroke-width':3,fill:'none'}),sv('ellipse',{cx:40,cy:8,rx:15,ry:4,fill:'#4e3328'}));}


else if(kind==='draw-hand'){
 const sack=resource('bag',{decorative:true}),bag=sv('g',{transform:'translate(-1 25) scale(.7)'});while(sack.firstChild)bag.append(sack.firstChild);svg.append(bag);
 const id='draw-skin-'+(++serial),defs=sv('defs'),shade=sv('linearGradient',{id,x1:'0%',y1:'0%',x2:'30%',y2:'100%'});shade.append(sv('stop',{offset:'0%','stop-color':'#f6d8b8'}),sv('stop',{offset:'100%','stop-color':'#dfab87'}));defs.append(shade);svg.append(defs);
 // Short pinching fingers attach to a compact palm; the bag is the largest mass.
 svg.append(sv('path',{d:'M76 9 61 8 51 16 42 17q-5 0-8 4l-4 5q-2 4 1 5t6-2l6-5 7 2-7 6q-4 3-2 6t6 0l12-9 15-3Z',fill:'url(#'+id+')',stroke:'#936d60','stroke-width':1.65,'stroke-linejoin':'round'}));
 svg.append(sv('circle',{cx:37,cy:31,r:7,fill:'#a7bd81',stroke:'#f2dfb1','stroke-width':1.6}),sv('path',{d:'M37 27v8m-3-6 3 3 3-3',fill:'none',stroke:'#56744e','stroke-width':1.6,'stroke-linecap':'round'}));
 svg.append(sv('path',{d:'M50 26 43 32q-4 3-2 6t6 0l8-6',fill:'url(#'+id+')',stroke:'#936d60','stroke-width':1.65,'stroke-linecap':'round','stroke-linejoin':'round'}),sv('path',{d:'M67 7 63 27 75 30 79 10Z',fill:'#7773a8',stroke:'#d7c8ea','stroke-width':1.8}),sv('path',{d:'m68 12-2 11M47 19l8-2',stroke:'#fff0d5','stroke-width':1.8,'stroke-linecap':'round',opacity:.65,fill:'none'}));
}
else if(kind==='stop-hands'){
 const defs=sv('defs'),id='cross-skin-'+(++serial),shade=sv('linearGradient',{id,x1:'0%',y1:'0%',x2:'80%',y2:'100%'});shade.append(sv('stop',{offset:'0%','stop-color':'#f6d8b8'}),sv('stop',{offset:'100%','stop-color':'#dfa584'}));defs.append(shade);svg.append(defs);
 // Both hands use the same proportions: 30-unit index, 25-unit folded palm.
 const hand=(mirror)=>{
  const g=sv('g',mirror?{transform:'translate(80 0) scale(-1 1)'}:{});
  g.append(sv('path',{d:'M16 71q-5-10-3-17q1-6 7-7l5 1 18-23q4-5 8-2t0 8L34 48q6 1 7 7l-2 10-6 7Z',fill:'url(#'+id+')',stroke:'#936d60','stroke-width':1.7,'stroke-linejoin':'round'}));
  g.append(sv('path',{d:'M20 49q-6 3-3 8l11 4q5 1 5-3t-5-5M17 62l10 3M19 67l8 2',fill:'none',stroke:'#a77a68','stroke-width':1.45,'stroke-linecap':'round'}),sv('path',{d:'M27 47 45 26',fill:'none',stroke:'#fff0d5','stroke-width':1.8,'stroke-linecap':'round',opacity:.7}),sv('path',{d:'M13 69 34 71l-1 7-20-2Z',fill:mirror?'#97617d':'#a26c89',stroke:'#e1b2cd','stroke-width':1.6}));
  return g;
 };svg.append(hand(false),hand(true));
}
 else if(kind==='essence'){svg.append(sv('path',{d:'M25 6h30v10H49v25l18 25q5 10-10 10H23Q8 76 13 66l18-25V16h-6Z',fill:'#bfdde3','fill-opacity':.25,stroke:'#d1edf1','stroke-width':3}),sv('path',{d:'M19 61q21-7 42 0l6 10H13Z',fill:'#cc83d2',stroke:'#eed1fb','stroke-width':1.5}),sv('path',{d:'M35 22v17M26 48l-6 11',stroke:'#f1fbff','stroke-width':3,'stroke-linecap':'round'}));}
 else if(kind==='potion'){svg.append(sv('path',{d:'M29 8h22v19l15 20q14 25-26 27Q0 72 14 47l15-20Z',fill:'#bdd9ef',opacity:.85,stroke:'#eaf7ff','stroke-width':2}),sv('path',{d:'M17 48q23 8 46 0l5 14q-2 10-28 10T12 62Z',fill:'#db64c7',stroke:'#f5b4ed','stroke-width':1.4}),sv('rect',{x:27,y:5,width:26,height:10,rx:3,fill:'#bc9461',stroke:'#f0d3a0','stroke-width':2}),sv('path',{d:'M22 37q-10 14-4 23M33 19v8',fill:'none',stroke:'#fff','stroke-width':4,'stroke-linecap':'round',opacity:.7}),sv('circle',{cx:45,cy:59,r:4,fill:'#f4c8ef',opacity:.8}));}
 else if(kind==='ruby')svg.append(sv('path',{d:'M19 13h42l15 23L40 73 4 36Z',fill:'#d95372',stroke:'#f6b3b0','stroke-width':2}),sv('path',{d:'m19 13 9 23H4m57-23-9 23h24M28 36l12 37 12-37Zm0 0 12-23 12 23',fill:'#f08ba0',stroke:'#932c50','stroke-width':1.6}),sv('path',{d:'m26 20 7-4-6 14-10-2Z',fill:'#fff0de',opacity:.65}));
 else if(kind==='droplet')svg.append(sv('path',{d:'M40 6Q26 28 17 42c-20 38 66 39 46 0Q52 25 40 6Z',fill:'#79bad4',stroke:'#ddf1ec','stroke-width':3}),sv('path',{d:'M27 37q-15 21 5 24',stroke:'#e1f8f1','stroke-width':4,fill:'none','stroke-linecap':'round'}));
 else if(kind==='rat')svg.append(sv('path',{d:'M35 43q-21-22-30 1-10 25 19 24 44 0 46-16',stroke:'#d39fa5','stroke-width':5,fill:'none','stroke-linecap':'round'}),sv('ellipse',{cx:47,cy:40,rx:23,ry:17,fill:'#b9a895'}),sv('circle',{cx:59,cy:27,r:9,fill:'#e0b1aa',stroke:'#9c8a78','stroke-width':3}),sv('path',{d:'m64 35 14 10-13 6',fill:'#b9a895'}),sv('circle',{cx:66,cy:39,r:2.4,fill:'#252d2b'}),sv('circle',{cx:76,cy:45,r:2.5,fill:'#ebabb0'}));
 else{const color={gold:'#d4ab54',copper:'#bc8258',silver:'#aebcca'}[kind]||'#d4ab54';svg.append(sv('circle',{cx:40,cy:40,r:34,fill:color,stroke:'#f7e5b8','stroke-width':2}),sv('circle',{cx:40,cy:40,r:28,fill:'none',stroke:'#5b463c','stroke-width':2,opacity:.55}),sv('path',{d:'M19 54h43l-10-9L40 16 30 45Z',fill:'#514334',stroke:'#f0d29d','stroke-width':2}),sv('path',{d:'m34 42 18 2-2 7-18-2Z',fill:'#e9c788'}));}
 return svg;
}


const scoreCells=[];for(let r=11;r>=0;r--)scoreCells.push({x:34,y:38+r*40});for(let c=1;c<15;c++)scoreCells.push({x:34+c*55,y:38});for(let r=1;r<12;r++)scoreCells.push({x:804,y:38+r*40});for(let c=13;c>0;c--)scoreCells.push({x:34+c*55,y:478});
const ratScores=Object.freeze(Array.from({length:25},(_,i)=>(i+1)*2));
function markerPositions(p){return {droplet:Math.max(0,p.droplet||0),start:Math.max(0,p.startPosition??p.droplet??0)};}
function scorePoint(score){return score<=0?{x:20,y:499}:scoreCells[(Math.floor(score)-1)%50];}
function pawn(color){const g=sv('g',{class:'score-pawn'});g.append(sv('ellipse',{cx:0,cy:5,rx:12,ry:4,fill:'#091719',opacity:.4}),sv('path',{d:'M-10 0-5-14h10L11 0Z',fill:color,stroke:'#f8e4b4','stroke-width':1.4}),sv('circle',{cx:0,cy:-20,r:6,fill:'#eacba3'}),sv('path',{d:'M-7-22 0-37 8-22Z',fill:color,stroke:'#f3d6a2','stroke-width':1.2}),sv('path',{d:'M-5 0-8 4M5 0l8 4',stroke:'#5b432d','stroke-width':3,'stroke-linecap':'round'}));return g;}
const roundMilestones={
 2:{color:'yellow',name:'黃色藥材解鎖',text:'從本回合起可購買黃色曼德拉草；不是直接放入藥袋。'},
 3:{color:'purple',name:'紫色藥材解鎖',text:'從本回合起可購買紫色幽靈氣息；不是直接放入藥袋。'},
 6:{color:'white',name:'白色炸彈＋1',text:'每人的藥袋加入一片數值1的白色炸彈。'},
 9:{name:'最終結算',text:'最後一回合：購物預算每5轉1分、紅寶石每2轉1分、未用女巫幣各2分；特效藥格數直接得分。'}
};
function scoreBoard(){
 const svg=sv('svg',{viewBox:'0 0 840 520',class:'score-track',role:'group','aria-label':'1 至 50 分環形記分板；超過 50 分繼續繞圈，總分見下方名單'});
 svg.append(sv('rect',{x:4,y:4,width:832,height:512,rx:26,fill:'#26392f',stroke:'#b69c70','stroke-width':5}),sv('rect',{x:65,y:69,width:710,height:374,rx:22,fill:'#152c29',stroke:'#7c8261','stroke-width':2}));
 for(let i=0;i<50;i++){const p=scoreCells[i],g=sv('g');g.append(sv('rect',{x:p.x-24,y:p.y-17,width:48,height:34,rx:5,fill:i%5===4?'#d0b477':'#d7d1b2',stroke:'#867c5d','stroke-width':1.2}),sv('text',{x:p.x,y:p.y+5,'text-anchor':'middle','font-family':'serif','font-size':19,'font-weight':i%5===4?'bold':'normal',fill:'#384636'},i+1));if(ratScores.includes(i+1)){const rat=sv('g',{class:'score-rat','aria-label':'第 '+(i+1)+' 分：老鼠尾巴','data-score':i+1,transform:'translate('+(p.x+14)+' '+(p.y-10)+')'});rat.append(sv('ellipse',{cx:0,cy:0,rx:5,ry:3,fill:'#856046'}),sv('circle',{cx:-3,cy:-3,r:2,fill:'#c3a379'}),sv('path',{d:'M4 1q8 8 11 1',fill:'none',stroke:'#856046','stroke-width':1.5}),sv('title',{},'第 '+(i+1)+' 分有一條老鼠尾巴'));g.append(rat);}svg.append(g);}
 for(let i=0;i<9;i++){const x=137+i*69,y=160+(i%2)*53;const lantern=sv('g',{'data-round':i+1,class:'round-lantern'});lantern.append(sv('path',{d:'M'+x+' 73v'+(y-90),stroke:'#a39163','stroke-width':2}),sv('ellipse',{cx:x,cy:y,rx:26,ry:32,fill:'#634e33',stroke:'#d0b378','stroke-width':2}),sv('text',{x,y:y+7,'text-anchor':'middle',fill:'#e7d49f','font-family':'serif','font-size':23},i+1));
 const event=roundMilestones[i+1];if(event){const badge=sv('g',{class:'round-event','data-milestone':i+1,transform:'translate('+(x-14)+' '+(y+32)+')'});
 if(event.color){const token=sv('svg',{x:0,y:0,width:28,height:28,viewBox:'0 0 64 64'});token.append(sv('circle',{cx:32,cy:32,r:30,fill:palette[event.color][0],stroke:palette[event.color][1],'stroke-width':2}),glyph(event.color,9,6,45));if(i===5)token.append(sv('text',{x:48,y:57,fill:'#fff7dc','font-size':18,'font-weight':800},'1'));badge.append(token);}
 else badge.append(sv('path',{d:'M8 2v27M8 3h20l-5 7 5 7H8',fill:'#dfc37f',stroke:'#f3e6bb','stroke-width':2}));
 badge.append(sv('title',{},event.name+'：'+event.text));lantern.append(badge);
 }svg.append(lantern);}
 svg.append(sv('text',{x:420,y:321,'text-anchor':'middle','font-size':30,'font-family':'serif',fill:'#dbc595'},'郎中闖江湖'),sv('text',{x:420,y:357,'text-anchor':'middle','font-size':17,'font-family':'sans-serif',fill:'#91afa1'},'九回合，煮出你的傳奇'));svg.append(sv('text',{x:420,y:395,'text-anchor':'middle','font-size':19,'font-family':'sans-serif',fill:'#f3de9e',class:'score-round-label'},'等待開局'));
 const flame=sv('g',{class:'round-flame',role:'img','aria-label':'目前回合指示物',visibility:'hidden'});flame.append(sv('path',{d:'M0 0c-18-9-15-22-6-31c-2 13 11 11 8-28c23 23 22 51-2 59Z',fill:'#f4bc57',stroke:'#fff0b4','stroke-width':2}),sv('path',{d:'M0-4c-8-7-6-15 1-23c5 11 9 17-1 23Z',fill:'#fff0b4'}));svg.append(flame);
 return svg;
}


function patientPortrait(id){
 const specs={nervous:['#b7a9d9','#e5c767'],earworm:['#84b9cb','#a47859'],carrot:['#87b082','#bd9662'],ears:['#c697a7','#c56873'],eyes:['#d6aa7d','#a96f52'],hump:['#83a995','#7a9271'],forgetful:['#a5b5ca','#d1bc85'],vampire:['#b592ba','#685879']};
 const [bg,hair]=specs[id]||specs.nervous,svg=sv('svg',{viewBox:'0 0 120 120',class:'patient-portrait',role:'img','aria-label':'原創病患插圖'});
 svg.append(sv('rect',{x:2,y:2,width:116,height:116,rx:24,fill:bg,stroke:'#d3b985','stroke-width':3}),sv('path',{d:'M16 117q2-32 44-30 44-2 44 30',fill:'#384b49'}),sv('ellipse',{cx:60,cy:55,rx:29,ry:36,fill:'#ead0a8'}),sv('path',{d:'M29 57Q12 10 52 13Q91-1 91 57L77 30 58 29 39 42Z',fill:hair}),sv('circle',{cx:49,cy:55,r:3,fill:'#354742'}),sv('circle',{cx:73,cy:55,r:3,fill:'#354742'}),sv('path',{d:'M50 76q11 6 22 0',fill:'none',stroke:'#935e55','stroke-width':3,'stroke-linecap':'round'}));
 if(id==='carrot')svg.append(sv('path',{d:'m60 58 40 8-41 5Z',fill:'#e89648'}));
 if(id==='ears')for(const x of [23,94])svg.append(sv('ellipse',{cx:x,cy:52,rx:15,ry:23,fill:'#eac0a3',stroke:'#b48274','stroke-width':2}));
 if(id==='earworm')svg.append(sv('path',{d:'M88 53q20-18 18 7q-5 16-16 8',stroke:'#cc995f','stroke-width':6,fill:'none'}));
 if(id==='vampire')svg.append(sv('path',{d:'m50 77 4 10 5-9m8 0 4 9 4-11',fill:'#fff9df'}));
 if(id==='nervous')svg.append(sv('path',{d:'m43 43 12-5m10 1 13 5',stroke:'#71506a','stroke-width':3}),sv('path',{d:'M21 19 12 26l9 6M101 17l9 8-8 8',fill:'none',stroke:'#f8efd1','stroke-width':4}));
 if(id==='eyes')svg.append(sv('ellipse',{cx:49,cy:55,rx:10,ry:12,fill:'none',stroke:'#ae7867','stroke-width':2}),sv('ellipse',{cx:73,cy:55,rx:10,ry:12,fill:'none',stroke:'#ae7867','stroke-width':2}));
 if(id==='hump')svg.append(sv('path',{d:'M10 104Q8 66 34 87l20 19',fill:'#547b60'}));
 if(id==='forgetful')svg.append(sv('text',{x:96,y:31,'font-size':27,fill:'#fff5d0','font-family':'serif'},'?'));
 return svg;
}
function essenceFlask(value){
 value=Math.max(0,Math.min(10,value||0));
 const svg=sv('svg',{viewBox:'0 0 620 170',class:'essence-flask',role:'img','aria-label':'特效藥燒瓶：第'+value+'格'});
 svg.append(sv('rect',{x:3,y:3,width:614,height:164,rx:19,fill:'#243e3a',stroke:'#c6a777','stroke-width':3}));const vessel=sv('g',{class:'essence-vessel'});vessel.append(sv('path',{d:'M31 18h50v15l-8 1v37l22 55q6 23-15 27H31q-21-4-15-27l23-55V34l-8-1Z',fill:'#b3dbd8','fill-opacity':.2,stroke:'#cee1cf','stroke-width':3}),sv('path',{d:'M23 128q15-7 28 0t35 0v12H23Z',fill:'#bd7da3'}),sv('rect',{x:44,y:142-value*9,width:26,height:value*9,rx:10,fill:'#cd97b8',opacity:.7}),sv('text',{x:56,y:144,'text-anchor':'middle','font-size':23,'font-weight':'bold',fill:'#fff8e0'},value));svg.append(vessel);
 for(let n=0;n<=10;n++){const x=126+(n%6)*85,y=n<6?47:121,g=sv('g',{'data-essence':n});
 g.append(sv('circle',{cx:x,cy:y,r:22,fill:n===value?'#d8b675':'#365c52',stroke:n===value?'#fff1bd':'#a99370','stroke-width':n===value?4:2}),sv('text',{x,y:y+6,'text-anchor':'middle','font-size':20,fill:n===value?'#23382f':'#e6dfc2'},n));svg.append(g);}
 return svg;
}

const api={roundMilestones,patientPortrait,essenceFlask,ratScores,markerPositions,scoreCells,scorePoint,pawn,scoreBoard,resource,names,palette,position,canInspect,selectRecipe,lookup,info,token,glyph,cauldron};
if(typeof module==='object'&&module.exports)module.exports=api;else root.QuacksArt=api;
})(typeof window==='object'?window:globalThis);
