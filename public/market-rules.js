(function(root,factory){const rules=factory();if(typeof module==='object'&&module.exports)module.exports=rules;else root.MarketRules=rules;})(typeof globalThis==='object'?globalThis:this,()=>{
 'use strict';
 const curve=()=>typeof module==='object'&&module.exports?require('./market-curve'):globalThis.MarketCurve;
 const CONFIG=Object.freeze({version:2,timeZone:'Asia/Taipei',cutoffTime:'23:59',cutoffExclusive:'target-midnight',settlementTime:'13:30',thresholds:[-5,-2,0,2,5],hit:5,miss:-1,tie:0,maxReturn:100,options:[
  {id:'crash',name:'崩盤預言',color:'#c8d7eb'},{id:'fall',name:'空軍出擊',color:'#c4dedb'},{id:'dip',name:'小跌怡情',color:'#d8dfbd'},
  {id:'rise',name:'微光上漲',color:'#eedbad'},{id:'rally',name:'多軍進場',color:'#edc4b9'},{id:'surge',name:'噴出宇宙',color:'#d9c6e8'}]});
 const snapshot=()=>JSON.parse(JSON.stringify(CONFIG));
 function validDate(s){return typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number(s.slice(0,4))>=2000&&Number(s.slice(0,4))<=2199&&Number.isFinite(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;}
 function cutoffFor(s,r=CONFIG){if(!validDate(s))throw Error('交易日期格式不正確');return r.version>=2?new Date(s+'T00:00:00+08:00').toISOString():new Date(Date.parse(s+'T'+r.cutoffTime+':00+08:00')-86400000).toISOString();}
 function settlementFor(s,r=CONFIG){if(!validDate(s))throw Error('交易日期格式不正確');return new Date(s+'T'+r.settlementTime+':00+08:00').toISOString();}
 function parseReturn(value,r=CONFIG){if(typeof value!=='number'&&!(typeof value==='string'&&/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value.trim())))throw Error('請輸入有效漲跌幅');const n=Number(value);if(!Number.isFinite(n)||r.version!==3&&Math.abs(n)>r.maxReturn)throw Error('漲跌幅須介於 -'+r.maxReturn+'% 與 '+r.maxReturn+'%');return Object.is(n,-0)?0:n;}
 function classify(value,r=CONFIG){const n=parseReturn(value,r);if(r.version===3)return 'curve';const [a,b,z,c,d]=r.thresholds;return n===z?'tie':n<=a?r.options[0].id:n<=b?r.options[1].id:n<z?r.options[2].id:n<c?r.options[3].id:n<d?r.options[4].id:r.options[5].id;}
 const outcome=(option,bucket)=>bucket==='tie'?'tie':option===bucket?'hit':'miss';
 const points=(option,bucket,r=CONFIG)=>r[outcome(option,bucket)];
 function labels(r=CONFIG){const [a,b,,c,d]=r.thresholds;return ['≤ '+a+'%','> '+a+'% 且 ≤ '+b+'%','> '+b+'% 且 < 0%','> 0% 且 < '+c+'%','≥ '+c+'% 且 < '+d+'%','≥ '+d+'%'];}
 function validate(r){if(r?.version===3){curve().validateCurveSnapshot(r);if(r.timeZone!=='Asia/Taipei'||r.cutoffTime!=='23:59'||r.cutoffExclusive!=='target-midnight'||r.settlementTime!=='13:30')throw Error('無效的曲線日期規則');return r;}if(!r||![1,2].includes(r.version)||r.version===2&&(r.cutoffTime!=='23:59'||r.cutoffExclusive!=='target-midnight')||r.timeZone!=='Asia/Taipei'||!/^\d{2}:\d{2}$/.test(r.cutoffTime)||!/^\d{2}:\d{2}$/.test(r.settlementTime)||r.thresholds?.length!==5||r.thresholds[2]!==0||!r.thresholds.every((v,i)=>Number.isFinite(v)&&(!i||v>r.thresholds[i-1]))||r.options?.length!==6||r.options.some((v,i)=>v.id!==CONFIG.options[i].id)||![r.hit,r.miss,r.tie].every(Number.isSafeInteger)||r.tie!==0||!Number.isFinite(r.maxReturn)||r.maxReturn<=0)throw Error('無效的股市冥燈規則');return r;}
 return {CONFIG,snapshot,validDate,cutoffFor,settlementFor,parseReturn,classify,outcome,points,labels,validate};
});
