'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const C=require('../public/market-curve');
const frozenAt='2026-10-08T07:00:00.000Z',targetDate='2026-10-09';
const snapshot=(observations=[])=>C.createCurveSnapshot({frozenAt,targetDate,observations});
const clone=value=>JSON.parse(JSON.stringify(value));
function history(count,value=i=>i%2?-1:1){
  return Array.from({length:count},(_,i)=>{
    const date=new Date(Date.UTC(2026,9,7)-86400000*(count-1-i)).toISOString().slice(0,10);
    return {targetDate:date,returnPct:value(i),fetchedAt:date+'T06:00:00.000Z',
      sourceUrl:'https://example.test/official/'+date,fingerprint:'fixture-'+i,evidence:'completed official fixture'};
  });
}
function near(actual,expected,tolerance=1e-8){assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} ≠ ${expected}`);}

test('curve snapshots publish a fixed 201-point symmetric reference distribution and explicit prior',()=>{
  const r=snapshot();assert.equal(r.version,3);assert.equal(r.kernelSigma,2);assert.equal(r.scaleTau,2);
  assert.equal(r.estimation.method,'fixed-prior');assert.equal(r.estimation.reason,'insufficient-history');
  assert.equal(r.estimation.sampleCount,0);assert.equal(r.probabilities.length,201);
  near(r.probabilities.reduce((a,b)=>a+b,0),1,1e-14);
  r.probabilities.forEach((p,i)=>{assert.ok(p>0);assert.equal(p,r.probabilities[200-i]);});
  assert.ok(r.probabilities[100]>r.probabilities[0]);assert.equal(r.zeroOutcome,'score');
  assert.equal(r.outsideOutcome,'unclamped');assert.equal(r.pointUnits,1000000);
  assert.equal(r.expectation,'frozen-distribution-random-guess-conditional-on-actual');
  assert.equal(r.cutoffExclusive,'target-midnight');assert.equal(r.timeZone,'Asia/Taipei');
});

test('historical scale requires 30 observations and uses bounded robust MAD, not the latest result',()=>{
  assert.equal(snapshot(history(29)).scaleTau,2);
  const enough=snapshot(history(30));near(enough.scaleTau,1.4826);
  assert.equal(enough.estimation.method,'bounded-prior-history-mad');assert.equal(enough.estimation.mad,1);
  assert.equal(snapshot(history(30,()=>3)).scaleTau,1);
  assert.equal(snapshot(history(30,i=>i%2?100:-100)).scaleTau,5);
  assert.equal(snapshot(history(31,i=>i===30?1000000:0)).scaleTau,1);
  assert.equal(enough.distributionCenter,0);
});

test('at most the latest 252 distinct completed and available sessions enter the snapshot',()=>{
  const rows=history(300),r=snapshot(rows);
  assert.equal(r.observations.length,252);assert.equal(r.estimation.historyStart,rows[48].targetDate);
  assert.equal(r.estimation.historyEnd,rows.at(-1).targetDate);
  assert.deepEqual(snapshot([...rows].reverse()),r);
});

test('freeze excludes future fetched evidence, target-session outcomes, invalid and incomplete sessions',()=>{
  const rows=history(29),last=rows.at(-1);
  const extra=[
    {...last,targetDate:'2026-10-08',fetchedAt:'2026-10-08T06:00:00Z',returnPct:2},
    {...last,targetDate:'2026-10-08',fetchedAt:'2026-10-08T07:00:01Z',returnPct:100},
    {...last,targetDate:'2026-10-09',fetchedAt:'2026-10-09T06:00:00Z'},
    {...last,targetDate:'2026-10-08',fetchedAt:'2026-10-08T05:00:00Z'},
    {...last,targetDate:'2026-10-10',fetchedAt:'2026-10-07T07:00:00Z'},
    {...last,targetDate:'2026-02-30'}, {...last,returnPct:Infinity}, {...last,fetchedAt:'not-a-date'},
    {...last,targetDate:'2026-10-06',fetchedAt:'2026-10-08T08:00:00Z',returnPct:999},
  ];
  const r=snapshot([...rows,...extra]);assert.equal(r.estimation.sampleCount,30);
  assert.equal(r.observations.at(-1).returnPct,2);
  assert.ok(!r.observations.some(row=>row.returnPct===999));
  const earlier=C.createCurveSnapshot({frozenAt:'2026-10-08T05:59:59Z',targetDate,observations:[...rows,...extra]});
  assert.equal(earlier.estimation.sampleCount,29);
});

test('duplicate-date correction is deterministic, only prior evidence qualifies, provenance is frozen',()=>{
  const first=history(1)[0];
  const revised={...first,returnPct:3,fetchedAt:'2026-10-08T06:30:00Z',fingerprint:'revised'};
  const future={...first,returnPct:100,fetchedAt:'2026-10-08T08:00:00Z'};
  const r=snapshot([future,first,revised]);
  assert.deepEqual(r,snapshot([revised,first,future]));assert.equal(r.observations.length,1);
  assert.equal(r.observations[0].returnPct,3);assert.equal(r.observations[0].fingerprint,'revised');
  assert.equal(r.observations[0].sourceUrl,first.sourceUrl);assert.equal(r.observations[0].evidence,first.evidence);
  revised.returnPct=999;assert.equal(r.observations[0].returnPct,3);
  assert.ok(Object.isFrozen(r)&&Object.isFrozen(r.probabilities)&&Object.isFrozen(r.observations[0]));
  assert.throws(()=>{r.probabilities[0]=1;});
  assert.throws(()=>{r.observations[0].returnPct=100;});
});

test('historical backfill fetched next-day 08:00 Taipei qualifies; same-session 13:00 does not',()=>{
  const base={targetDate:'2026-10-07',returnPct:1.2,sourceUrl:'https://example.test/official/2026-10-07',fingerprint:'backfill'};
  const nextMorning={...base,fetchedAt:'2026-10-08T08:00:00+08:00'};
  const duringSession={...base,fetchedAt:'2026-10-07T13:00:00+08:00'};
  const backfill=snapshot([nextMorning]);
  assert.equal(backfill.estimation.sampleCount,1);
  assert.equal(backfill.observations[0].fetchedAt,'2026-10-08T00:00:00.000Z');
  assert.equal(snapshot([duringSession]).estimation.sampleCount,0);
  assert.equal(snapshot([duringSession,nextMorning]).estimation.sampleCount,1);
});

test('weighted random-guess expectation is zero before rounding, within half a micropoint after rounding',()=>{
  const rules=[snapshot(),snapshot(history(30,()=>0)),snapshot(history(30,i=>i%2?20:-20))];
  const actuals=[-Number.MAX_VALUE,-100,-13,-10.00677,-10,-8,-2,-0.05,0,0.05,2,8,10,10.00677,13,100,1000,Number.MAX_VALUE];
  for(const r of rules)for(const y of actuals){
    let rawEV=0,unitEV=0;
    for(let tick=-100;tick<=100;tick++){
      const raw=C.scorePrediction(tick,y,r),units=C.scorePredictionUnits(tick,y,r),p=r.probabilities[tick+100];
      assert.ok(Number.isFinite(raw));assert.ok(raw<=100+1e-10,`${tick},${y}: ${raw}`);
      assert.ok(Number.isSafeInteger(units)&&units<=100000000);
      rawEV+=p*raw;unitEV+=p*units;
    }
    near(rawEV,0,1e-10);
    // 0.5 is the quantization bound; 0.0001 micro is only floating test tolerance.
    near(unitEV,0,0.5001);
  }
});

test('for the same actual outcome score is monotone in error, symmetric, and equal for equal error',()=>{
  const r=snapshot();
  for(const y of [-13,-10,-2.05,-0.05,0,0.05,2.05,10,13,1e200]){
    const pairs=Array.from({length:201},(_,i)=>({tick:i-100,distance:Math.abs((i-100)/10-y)}))
      .sort((a,b)=>a.distance-b.distance);
    let last=Infinity;
    for(const {tick} of pairs){
      const score=C.scorePrediction(tick,y,r);assert.ok(score<=last+1e-10);last=score;
      near(score,C.scorePrediction(-tick,-y,r),1e-10);
    }
  }
  near(C.scorePrediction(0,2,r),C.scorePrediction(40,2,r));
  near(C.scorePrediction(-1,0,r),C.scorePrediction(1,0,r));
});

test('documented default examples, central outcome, extreme hits, and true out-of-range actuals',()=>{
  const r=snapshot();
  for(const [tick,y,expected] of [[0,0,29.3293149050314],[20,2,44.9918455458399],[80,8,98.839796402269],
    [100,10,100],[-100,-10,100],[100,0,-70.8069780180486],[100,13,32.464018841509]])near(C.scorePrediction(tick,y,r),expected);
  assert.ok(C.scorePrediction(100,10.00677,r)<100);
  assert.notEqual(C.scorePrediction(100,13,r),C.scorePrediction(100,10,r));
  assert.ok(C.scorePrediction(0,0,r)>0);assert.ok(C.scorePrediction(100,0,r)<0);
  assert.equal(C.scorePrediction(0,Number.MAX_VALUE,r),0);
  assert.equal(Object.is(C.scorePrediction(0,-0,r),-0),false);
});

test('uniform random guessing and fixed strategies are not falsely guaranteed zero expectation',()=>{
  const r=snapshot();
  const uniform=Array.from({length:201},(_,i)=>C.scorePrediction(i-100,0,r)).reduce((a,b)=>a+b,0)/201;
  assert.ok(Math.abs(uniform)>1);
  const fixedStrategyEV=r.probabilities.reduce((total,p,i)=>total+p*C.scorePrediction(0,(i-100)/10,r),0);
  assert.ok(Math.abs(fixedStrategyEV)>1);
});

test('micropoints round ties away from zero, reverse exactly, and do not reinterpret legacy points',()=>{
  for(const [points,units] of [[0,0],[-0,0],[0.0000005,1],[-0.0000005,-1],[1.2345674,1234567],[-1.2345674,-1234567],[5,5000000],[-1,-1000000]]){
    assert.equal(C.pointsToUnits(points),units);assert.equal(C.pointsToUnits(-points),-units||0);
    assert.equal(units+(-units),0);assert.equal(C.unitsToPoints(units),units/1000000||0);
  }
  assert.equal(C.unitsToPoints(C.pointsToUnits(5)),5);
  for(const bad of [NaN,Infinity,-Infinity,'1',null,Number.MAX_VALUE])assert.throws(()=>C.pointsToUnits(bad));
  for(const bad of [1.1,NaN,Infinity,'100',Number.MAX_SAFE_INTEGER+1])assert.throws(()=>C.unitsToPoints(bad));
});

test('snapshot validation recomputes frozen parameters and rejects corruption or version substitution',()=>{
  const r=snapshot(history(30)),copy=clone(r);assert.equal(C.validateCurveSnapshot(copy),copy);assert.ok(Object.isFrozen(copy));
  for(const mutate of [v=>v.version=2,v=>v.scaleTau=2,v=>v.kernelSigma=3,v=>v.normalizationD=0,
    v=>v.probabilities[0]=1,v=>v.estimation.sampleCount=999,v=>v.zeroOutcome='void',
    v=>v.frozenAt='2026-10-01T00:00:00Z',v=>v.observations.forEach(row=>{row.returnPct*=5;}),
    v=>v.pointUnits=1000,v=>v.cutoffTime='21:00',v=>v.grid.tickSize=0.01]){
    const bad=clone(r);mutate(bad);assert.throws(()=>C.validateCurveSnapshot(bad),e=>e.code==='INVALID_CURVE_RULES');
  }
  assert.deepEqual(C.validateCurveSnapshot(clone(r)),r);
});

test('invalid tick and actual inputs fail, no silent rounding or outcome clamping occurs',()=>{
  const r=snapshot();
  for(const tick of [-101,101,0.5,'0',null,NaN,Infinity])assert.throws(()=>C.scorePrediction(tick,0,r));
  for(const actual of [NaN,Infinity,-Infinity,'2',null])assert.throws(()=>C.scorePrediction(0,actual,r));
  assert.equal(C.forecastFromTick(-100),-10);assert.equal(C.forecastFromTick(99),9.9);
  assert.throws(()=>C.createCurveSnapshot({frozenAt:'2026-02-30T00:00:00Z',targetDate}));
  assert.throws(()=>C.createCurveSnapshot({frozenAt,targetDate:'2026-02-30'}));
  assert.throws(()=>C.createCurveSnapshot({frozenAt,targetDate,observations:null}));
});

test('the browser and CommonJS share identical math without browser globals or external dependencies',()=>{
  const context={};vm.createContext(context);
  vm.runInContext(fs.readFileSync(require.resolve('../public/market-curve'),'utf8'),context);
  const browser=context.MarketCurve,r=browser.createCurveSnapshot({frozenAt,targetDate});
  assert.equal(browser.scorePredictionUnits(20,2,r),C.scorePredictionUnits(20,2,snapshot()));
  assert.equal(browser.CURVE_RULE_VERSION,3);
});
