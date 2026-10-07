const {parentPort,workerData}=require('node:worker_threads');
const {openDatabase}=require('../../src/db'),{MarketStore}=require('../../src/market/store'),{MarketAutomationStore}=require('../../src/market/automation-store');
const db=openDatabase(workerData.file),market=new MarketStore(db,()=>workerData.now),store=new MarketAutomationStore(db,market,{clock:()=>workerData.now});
parentPort.postMessage({ready:true});Atomics.wait(new Int32Array(workerData.barrier),0,0);
try{const result=workerData.manual?market.settle(workerData.actor,workerData.input):store.recordClose(workerData.input);parentPort.postMessage({ok:true,result});}
catch(error){parentPort.postMessage({ok:false,code:error.code,message:error.message});}finally{db.close();}
