(function(root,factory){
  const rules=factory();
  if(typeof module==='object'&&module.exports)module.exports=rules;
  else root.MarketCurve=rules;
})(typeof globalThis==='object'?globalThis:this,()=>{
  'use strict';
  const CURVE_RULE_VERSION=3, POINT_UNITS=1000000;
  const FORECAST_MIN_TICK=-100, FORECAST_MAX_TICK=100;
  const KERNEL_SIGMA=2, HISTORY_LIMIT=252, MIN_OBSERVATIONS=30;
  const MAD_FACTOR=1.4826, SCALE_MIN=1, SCALE_MAX=5, FALLBACK_SCALE=2;
  const GRID=Object.freeze(Array.from({length:201},(_,i)=>(i-100)/10));
  const validated=new WeakSet();

  function fail(message){const error=new Error(message);error.code='INVALID_CURVE_RULES';throw error;}
  function validDate(value){
    return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&
      Number(value.slice(0,4))>=2000&&Number(value.slice(0,4))<=2199&&
      Number.isFinite(Date.parse(value+'T00:00:00Z'))&&
      new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
  }
  function instant(value){
    if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value))return NaN;
    if(!validDate(value.slice(0,10)))return NaN;
    return Date.parse(value);
  }
  function deepFreeze(value){
    if(value&&typeof value==='object'&&!Object.isFrozen(value)){
      Object.values(value).forEach(deepFreeze);Object.freeze(value);
    }
    return value;
  }
  function sum(values){
    let result=0,correction=0;
    for(const value of values){const adjusted=value-correction,next=result+adjusted;correction=(next-result)-adjusted;result=next;}
    return result;
  }
  function median(values){
    const sorted=values.slice().sort((a,b)=>a-b),middle=Math.floor(sorted.length/2);
    return sorted.length%2?sorted[middle]:sorted[middle-1]/2+sorted[middle]/2;
  }
  function kernel(x,y){const distance=(x-y)/KERNEL_SIGMA;return Math.exp(-0.5*distance*distance);}
  function meanKernel(y,probabilities){return sum(GRID.map((x,i)=>probabilities[i]*kernel(x,y)));}
  function forecastFromTick(tick){
    if(!Number.isInteger(tick)||tick<FORECAST_MIN_TICK||tick>FORECAST_MAX_TICK)fail('預測須為 -10% 到 +10%，每格 0.1%');
    return tick/10;
  }

  // Only completed sessions whose evidence was already available at the freeze
  // enter the estimate. 14:00 Taipei is a conservative completion boundary.
  // For duplicate sessions use the latest already-available record, then a
  // deterministic lexical tie-break; later corrections never alter a snapshot.
  function priorObservations(observations,targetDate,freezeMillis){
    if(!Array.isArray(observations))fail('歷史資料格式不正確');
    const byDate=new Map();
    for(const row of observations){
      if(!row||!validDate(row.targetDate)||row.targetDate>=targetDate||
        typeof row.returnPct!=='number'||!Number.isFinite(row.returnPct))continue;
      const fetched=instant(row.fetchedAt),completed=Date.parse(row.targetDate+'T14:00:00+08:00');
      if(!Number.isFinite(fetched)||fetched>freezeMillis||completed>freezeMillis||fetched<completed)continue;
      const record={targetDate:row.targetDate,returnPct:Object.is(row.returnPct,-0)?0:row.returnPct,
        fetchedAt:new Date(fetched).toISOString(),sourceUrl:typeof row.sourceUrl==='string'?row.sourceUrl:'',
        fingerprint:typeof row.fingerprint==='string'?row.fingerprint:'',
        evidence:typeof row.evidence==='string'?row.evidence:''};
      const old=byDate.get(record.targetDate);
      if(!old||record.fetchedAt>old.fetchedAt||record.fetchedAt===old.fetchedAt&&JSON.stringify(record)>JSON.stringify(old))byDate.set(record.targetDate,record);
    }
    return [...byDate.values()].sort((a,b)=>a.targetDate.localeCompare(b.targetDate)).slice(-HISTORY_LIMIT);
  }

  function createCurveSnapshot({frozenAt,targetDate,observations=[]}={}){
    const freezeMillis=instant(frozenAt);
    if(!validDate(targetDate)||!Number.isFinite(freezeMillis))fail('凍結時間或交易日期格式不正確');
    const history=priorObservations(observations,targetDate,freezeMillis);
    const enough=history.length>=MIN_OBSERVATIONS;
    let mad=null,scaleTau=FALLBACK_SCALE;
    if(enough){
      const returns=history.map(row=>row.returnPct),center=median(returns);
      mad=median(returns.map(value=>Math.abs(value-center)));
      // Finite input differences can overflow for physically impossible values;
      // saturating the estimator still yields a finite, disclosed scale.
      if(!Number.isFinite(mad))mad=Number.MAX_VALUE;
      scaleTau=Math.max(SCALE_MIN,Math.min(SCALE_MAX,MAD_FACTOR*mad));
    }
    const weights=GRID.map(x=>Math.exp(-0.5*(x/scaleTau)**2)),total=sum(weights);
    const probabilities=weights.map(weight=>weight/total);
    const normalizationD=1-Math.min(...GRID.map(x=>meanKernel(x,probabilities)));
    const snapshot={version:CURVE_RULE_VERSION,kind:'accuracy-curve',timeZone:'Asia/Taipei',
      cutoffTime:'23:59',cutoffExclusive:'target-midnight',settlementTime:'13:30',
      frozenAt:new Date(freezeMillis).toISOString(),targetDate,
      grid:{minTick:FORECAST_MIN_TICK,maxTick:FORECAST_MAX_TICK,tickSize:0.1},
      kernelSigma:KERNEL_SIGMA,distributionCenter:0,scaleTau,
      estimation:{method:enough?'bounded-prior-history-mad':'fixed-prior',
        reason:enough?null:'insufficient-history',sampleCount:history.length,
        historyLimit:HISTORY_LIMIT,minObservations:MIN_OBSERVATIONS,madFactor:MAD_FACTOR,
        mad,scaleMin:SCALE_MIN,scaleMax:SCALE_MAX,fallbackScale:FALLBACK_SCALE,
        sessionCompletedTime:'14:00',historyStart:history[0]?.targetDate||null,
        historyEnd:history.at(-1)?.targetDate||null},
      observations:history,probabilities,normalizationD,pointUnits:POINT_UNITS,
      rounding:'nearest-ties-away-from-zero',zeroOutcome:'score',outsideOutcome:'unclamped',
      expectation:'frozen-distribution-random-guess-conditional-on-actual'};
    deepFreeze(snapshot);validated.add(snapshot);return snapshot;
  }

  function validateCurveSnapshot(rules){
    if(!rules||typeof rules!=='object')fail('缺少曲線規則');
    if(validated.has(rules))return rules;
    if(rules.version!==CURVE_RULE_VERSION||!Array.isArray(rules.observations)||rules.observations.length>HISTORY_LIMIT)fail('無效的曲線規則版本或歷史');
    const expected=createCurveSnapshot({frozenAt:rules.frozenAt,targetDate:rules.targetDate,observations:rules.observations});
    for(const key of Object.keys(expected)){
      if(key==='probabilities'||key==='normalizationD')continue;
      if(JSON.stringify(rules[key])!==JSON.stringify(expected[key]))fail('曲線規則與凍結資料不一致：'+key);
    }
    if(!Array.isArray(rules.probabilities)||rules.probabilities.length!==GRID.length||
      rules.probabilities.some((p,i)=>!Number.isFinite(p)||p<0||Math.abs(p-expected.probabilities[i])>1e-14)||
      Math.abs(sum(rules.probabilities)-1)>1e-12||!Number.isFinite(rules.normalizationD)||
      Math.abs(rules.normalizationD-expected.normalizationD)>1e-12)fail('曲線機率或倍率不正確');
    deepFreeze(rules);validated.add(rules);return rules;
  }

  function scorePrediction(tick,actualPct,rules){
    const x=forecastFromTick(tick),snapshot=validateCurveSnapshot(rules);
    if(typeof actualPct!=='number'||!Number.isFinite(actualPct))fail('實際漲跌幅須為有限數值');
    const mu=meanKernel(actualPct,snapshot.probabilities);
    // The same actual-dependent denominator applies to EVERY guess, preserving
    // sum(p_i * score_i)=0. This is not per-player score clipping.
    // denominator >= 1-mu and K<=1 imply score<=100 for every finite outcome.
    const denominator=Math.max(snapshot.normalizationD,1-mu);
    const score=100*(kernel(x,actualPct)-mu)/denominator;
    return Object.is(score,-0)?0:score;
  }
  function pointsToUnits(points){
    if(typeof points!=='number'||!Number.isFinite(points))fail('分數格式不正確');
    const units=Math.sign(points)*Math.round(Math.abs(points)*POINT_UNITS);
    if(!Number.isSafeInteger(units))fail('分數超出安全整數範圍');
    return units===0?0:units;
  }
  function unitsToPoints(units){
    if(!Number.isSafeInteger(units))fail('微分值須為安全整數');
    return units===0?0:units/POINT_UNITS;
  }
  function scorePredictionUnits(tick,actualPct,rules){return pointsToUnits(scorePrediction(tick,actualPct,rules));}
  return Object.freeze({CURVE_RULE_VERSION,POINT_UNITS,FORECAST_MIN_TICK,FORECAST_MAX_TICK,
    createCurveSnapshot,validateCurveSnapshot,forecastFromTick,scorePrediction,scorePredictionUnits,pointsToUnits,unitsToPoints});
});
