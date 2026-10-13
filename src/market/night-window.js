const dateAt=now=>new Date(now+8*3600000).toISOString().slice(0,10);
const addDays=(date,count)=>new Date(Date.parse(date+'T00:00:00Z')+count*86400000).toISOString().slice(0,10);
const RETRY_MS=300000,WINDOW_MS=1800000;
const startFor=date=>Date.parse(date+'T23:59:00+08:00');
function nightWindow(now){
 let targetDate=dateAt(now),start=startFor(targetDate);
 const previous=addDays(targetDate,-1),prior=startFor(previous);
 if(now>=prior&&now<=prior+WINDOW_MS){targetDate=previous;start=prior;}
 const end=start+WINDOW_MS,active=now>=start&&now<=end;
 return {targetDate,start,end,active,slot:active?new Date(start+Math.floor((now-start)/RETRY_MS)*RETRY_MS).toISOString():null};
}
module.exports={nightWindow,startFor,RETRY_MS,WINDOW_MS,dateAt,addDays};
