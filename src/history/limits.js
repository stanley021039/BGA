const ENV_LIMITS=Object.freeze({HISTORY_MAX_TOTAL_BYTES:'maxTotalBytes',HISTORY_MAX_MATCH_BYTES:'maxMatchBytes',HISTORY_MAX_SESSION_BYTES:'maxSessionBytes',HISTORY_MAX_ARCHIVES:'maxArchives',HISTORY_MAX_FILES:'maxFiles',HISTORY_RETENTION_DAYS:'retentionDays'});
function historyLimits(env){
 const limits={};
 for(const [name,key]of Object.entries(ENV_LIMITS)){
  if(env[name]===undefined)continue;
  const raw=env[name],value=Number(raw);
  if(typeof raw!=='string'||!/^\d+$/.test(raw)||!Number.isSafeInteger(value)||value<1)throw Error(name+' must be a positive integer');
  limits[key]=value;
 }
 return limits;
}
module.exports={historyLimits};
