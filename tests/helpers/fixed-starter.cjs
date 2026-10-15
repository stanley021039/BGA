'use strict';
// These integration fixtures exercise unrelated contracts with a known first seat.
// Random selection itself is exhaustively covered by random-starter.test.js.
module.exports=function fixedStarter(t,Engine){const start=Engine.prototype.start;t.mock.method(Engine.prototype,'start',function(...args){const rng=this.rng;let first=true;this.rng=n=>{if(first){first=false;return 0;}return rng.call(this,n);};try{return start.apply(this,args);}finally{this.rng=rng;}});};
