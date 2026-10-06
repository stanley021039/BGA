const {parentPort,workerData}=require('node:worker_threads');
const {openDatabase}=require('../../src/db'),{MarketStore}=require('../../src/market/store');
const db=openDatabase(workerData.file),barrier=new Int32Array(workerData.barrier);parentPort.postMessage({ready:true});Atomics.wait(barrier,0,0);
try{const store=new MarketStore(db,()=>workerData.sharedTime?Number(Atomics.load(new BigInt64Array(workerData.sharedTime),0)):workerData.now),result=store[workerData.operation]({id:workerData.userId},workerData.input);parentPort.postMessage({ok:true,result});}catch(error){parentPort.postMessage({ok:false,code:error.code,message:error.message});}finally{db.close();}
