const {randomUUID,randomInt,createHash}=require('node:crypto');
const {transaction}=require('../db');
const {HttpError}=require('../http/errors');
const R=require('../../public/market-rules');
const {DEFAULT_IMAGE_LIMITS,imageLimits,imageInput,canonicalImage,inspectCanonicalImage}=require('./image-codec');
const BUCKETS=Object.freeze(R.CONFIG.options.map(option=>option.id));
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REQUEST_ID=/^[A-Za-z0-9_-]{8,80}$/;
const COLUMNS='id,author_id,author_name,width,height,buckets_json,weekdays_json,version,status,created_at';
const fail=(status,code,message)=>{throw new HttpError(status,code,message);};
function rulesOf(input,optional=false){
 const group=(value,allowed)=>{
  if(optional&&value===undefined)return [];
  if(!Array.isArray(value)||!optional&&!value.length||value.length>allowed.length||new Set(value).size!==value.length||value.some(item=>!allowed.includes(item)))fail(400,'INVALID_IMAGE_RULES','請選擇有效且不重複的區間與星期');
  return allowed.filter(item=>value.includes(item));
 };
 return {buckets:group(input?.buckets,BUCKETS),weekdays:group(input?.weekdays,[0,1,2,3,4,5,6])};
}
function metadata(row){return {id:row.id,version:row.version,authorName:row.author_name,buckets:JSON.parse(row.buckets_json),weekdays:JSON.parse(row.weekdays_json),width:row.width,height:row.height,status:row.status,createdAt:row.created_at,url:`/api/market/images/${row.id}/media`};}
class MarketImageStore{
 constructor(db,clock=Date.now,options={}){this.db=db;this.clock=clock;this.limits=imageLimits(options.limits);}
 user(actor,admin=false){
  const user=this.db.prepare('SELECT id,display_name,role,disabled FROM users WHERE id=?').get(actor?.id||'');
  if(!user||user.disabled)fail(401,'UNAUTHORIZED','請重新登入');
  if(admin&&user.role!=='admin')fail(403,'ADMIN_REQUIRED','只有管理者可以操作');
  return user;
 }
 fingerprint(operation,data){if(typeof data.requestId!=='string'||!REQUEST_ID.test(data.requestId))fail(400,'INVALID_REQUEST_ID','缺少操作識別碼');return createHash('sha256').update(JSON.stringify({operation,...data})).digest('hex');}
 receipt(user,data,fingerprint){
  const old=this.db.prepare('SELECT fingerprint,response_json FROM market_requests WHERE user_id=? AND request_id=?').get(user.id,data.requestId);
  if(!old)return null;
  if(old.fingerprint!==fingerprint)fail(409,'REQUEST_ID_REUSED','操作識別碼已被使用');
  return {...JSON.parse(old.response_json),replayed:true};
 }
 write(actor,operation,data,fingerprint,run,admin=false){return transaction(this.db,()=>{
  const user=this.user(actor,admin),old=this.receipt(user,data,fingerprint);if(old)return old;
  // Mutation authorization, quota and frozen versions are all checked after
  // obtaining the SQLite write lock, including uploads decoded asynchronously.
  const {result,at}=run(user,this.clock());
  this.db.prepare('INSERT INTO market_requests(user_id,request_id,operation,fingerprint,response_json,created_at) VALUES(?,?,?,?,?,?)').run(user.id,data.requestId,operation,fingerprint,JSON.stringify(result),at);
  return result;
 });}
 counts(){return this.db.prepare('SELECT COUNT(*) AS count,COALESCE(SUM(length(bytes)),0) AS bytes FROM market_images').get();}
 boundedRows(where='',parameters=[]){
  if(this.counts().count>this.limits.maxImages)fail(503,'IMAGE_GALLERY_LIMIT','圖片庫已超過容量限制');
  return this.db.prepare(`SELECT ${COLUMNS} FROM market_images ${where} ORDER BY created_at DESC,id LIMIT ?`).all(...parameters,this.limits.maxImages);
 }
 async upload(actor,input){
  this.user(actor);
  const rules=rulesOf(input),source=imageInput(input,this.limits),data={requestId:input?.requestId,mime:source.mime,base64:source.base64,...rules},fingerprint=this.fingerprint('image-upload',data);
  // A retry already committed is cheap and does not consume a decoder slot.
  const replay=transaction(this.db,()=>this.receipt(this.user(actor),data,fingerprint));if(replay)return replay;
  const image=await canonicalImage(source,this.limits);
  return this.write(actor,'image-upload',data,fingerprint,(user,now)=>{
   const counts=this.counts(),owned=this.db.prepare('SELECT COUNT(*) n FROM market_images WHERE author_id=?').get(user.id).n;
   if(owned>=this.limits.maxPerUser||counts.count>=this.limits.maxImages||counts.bytes+image.bytes.length>this.limits.maxStorageBytes)fail(409,'IMAGE_QUOTA_EXCEEDED','圖片庫容量已滿，請聯絡管理者');
   const id=randomUUID(),at=new Date(now).toISOString();
   this.db.prepare("INSERT INTO market_images(id,author_id,author_name,mime,bytes,width,height,buckets_json,weekdays_json,version,status,created_at,approved_by,approved_at) VALUES(?,?,?,?,?,?,?,?,?,1,'pending',?,NULL,NULL)").run(id,user.id,user.display_name,image.mime,image.bytes,image.width,image.height,JSON.stringify(data.buckets),JSON.stringify(data.weekdays),at);
   return {result:{ok:true,image:metadata(this.db.prepare(`SELECT ${COLUMNS} FROM market_images WHERE id=?`).get(id))},at};
  });
 }
 listMine(actor){return transaction(this.db,()=>{const user=this.user(actor);return {images:this.boundedRows('WHERE author_id=?',[user.id]).map(metadata),limits:this.limits};});}
 pending(actor,filters={}){const rules=rulesOf(filters,true);return transaction(this.db,()=>{
  this.user(actor,true);
  const images=this.boundedRows("WHERE status='pending'").map(metadata).filter(image=>(!rules.buckets.length||rules.buckets.some(bucket=>image.buckets.includes(bucket)))&&(!rules.weekdays.length||rules.weekdays.some(day=>image.weekdays.includes(day))));
  return {images,total:images.length,limits:this.limits};
 });}
 approve(actor,input){
  if(input?.confirmed!==true)fail(400,'CONFIRM_REQUIRED','請確認這批圖片及張數');
  if(!Array.isArray(input.images)||!input.images.length||input.images.length>this.limits.maxApprovalBatch)fail(400,'INVALID_IMAGE_BATCH','請選擇有效的圖片批次');
  const images=input.images.map(image=>{if(!image||typeof image.id!=='string'||!UUID.test(image.id)||!Number.isSafeInteger(image.version)||image.version<1)fail(400,'INVALID_IMAGE_BATCH','請選擇有效的圖片批次');return {id:image.id,version:image.version};}).sort((a,b)=>a.id.localeCompare(b.id));
  if(new Set(images.map(image=>image.id)).size!==images.length)fail(400,'INVALID_IMAGE_BATCH','圖片批次不能重複');
  const data={requestId:input.requestId,confirmed:true,images},fingerprint=this.fingerprint('image-approve',data);
  return this.write(actor,'image-approve',data,fingerprint,(user,now)=>{
   const rows=images.map(image=>this.db.prepare(`SELECT ${COLUMNS} FROM market_images WHERE id=?`).get(image.id));
   if(rows.some((row,index)=>!row||row.status!=='pending'||row.version!==images[index].version))fail(409,'STALE_IMAGE_BATCH','圖片批次已變更，請重新載入並確認');
   const at=new Date(Math.max(now,...rows.map(row=>Date.parse(row.created_at)))).toISOString(),update=this.db.prepare("UPDATE market_images SET version=version+1,status='approved',approved_by=?,approved_at=? WHERE id=? AND status='pending' AND version=?");
   for(const [index,row] of rows.entries())if(update.run(user.id,at,row.id,images[index].version).changes!==1)fail(409,'STALE_IMAGE_BATCH','圖片批次已變更，請重新載入並確認');
   return {result:{ok:true,approved:rows.length,images:rows.map(row=>metadata({...row,version:row.version+1,status:'approved'}))},at};
  },true);
 }
 draw(actor,input){
  const targetDate=input?.targetDate;if(!R.validDate(targetDate))fail(400,'INVALID_DATE','交易日期格式不正確');
  return transaction(this.db,()=>{this.user(actor);const weekday=new Date(targetDate+'T00:00:00Z').getUTCDay(),pool=this.boundedRows("WHERE status='approved'").map(metadata).filter(image=>image.weekdays.includes(weekday));
   if(input.layout!==undefined&&input.layout!=='curve-five')fail(400,'INVALID_IMAGE_LAYOUT','圖片排列不正確');
   const slots=input.layout==='curve-five'?{crash:['crash'],fall:['fall'],center:['dip','rise'],rally:['rally'],surge:['surge']}:Object.fromEntries(BUCKETS.map(bucket=>[bucket,[bucket]]));
   const images={};for(const [slot,buckets] of Object.entries(slots)){const eligible=pool.filter(image=>buckets.some(bucket=>image.buckets.includes(bucket)));images[slot]=eligible.length?eligible[randomInt(eligible.length)]:null;}return {targetDate,images,...(input.layout?{layout:input.layout}:{})};
  });
 }
 media(actor,id){return transaction(this.db,()=>{
  const user=this.user(actor),row=this.db.prepare('SELECT author_id,status,mime,bytes FROM market_images WHERE id=?').get(typeof id==='string'?id:'');
  if(!row||row.status!=='approved'&&row.author_id!==user.id&&user.role!=='admin')fail(404,'IMAGE_NOT_FOUND','找不到圖片');
  return {mime:row.mime,bytes:row.bytes};
 });}
}
function validateMarketImagesDatabase(db){
 const check=value=>{if(!value)throw Error('Invalid market images');};
 const stamp=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
 const counts=db.prepare('SELECT COUNT(*) AS count,COALESCE(SUM(length(bytes)),0) AS bytes FROM market_images').get();
 check(counts.count<=DEFAULT_IMAGE_LIMITS.maxImages&&counts.bytes<=DEFAULT_IMAGE_LIMITS.maxStorageBytes);
 check(!db.prepare('SELECT author_id FROM market_images GROUP BY author_id HAVING COUNT(*)>? LIMIT 1').get(DEFAULT_IMAGE_LIMITS.maxPerUser));
 for(const row of db.prepare('SELECT * FROM market_images').iterate()){
  check(UUID.test(row.id)&&UUID.test(row.author_id)&&db.prepare('SELECT 1 FROM users WHERE id=?').get(row.author_id)&&stamp(row.created_at));
  // Bootstrap historically used username as display_name (up to 24 chars),
  // rather than the newer 16-character rename limit. Keep those snapshots valid.
  check(typeof row.author_name==='string'&&row.author_name.length>0&&row.author_name.trim()===row.author_name&&[...row.author_name].length<=64&&!/[\u0000-\u001f\u007f]/.test(row.author_name));
  check(typeof row.buckets_json==='string'&&row.buckets_json.length<=256&&typeof row.weekdays_json==='string'&&row.weekdays_json.length<=64);
  const rules=rulesOf({buckets:JSON.parse(row.buckets_json),weekdays:JSON.parse(row.weekdays_json)});
  check(JSON.stringify(rules.buckets)===row.buckets_json&&JSON.stringify(rules.weekdays)===row.weekdays_json);
  const image=inspectCanonicalImage(row.bytes);
  check(row.mime===image.mime&&Number.isSafeInteger(row.width)&&row.width===image.width&&Number.isSafeInteger(row.height)&&row.height===image.height);
  if(row.status==='pending')check(row.version===1&&row.approved_by===null&&row.approved_at===null);
  else check(row.status==='approved'&&row.version===2&&typeof row.approved_by==='string'&&UUID.test(row.approved_by)&&db.prepare('SELECT 1 FROM users WHERE id=?').get(row.approved_by)&&stamp(row.approved_at)&&Date.parse(row.approved_at)>=Date.parse(row.created_at));
 }
 // Receipts are durable references too. Do not apply today’s role/disabled
 // state to historical authors or reviewers, which can legitimately change.
 if(!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='market_requests'").get()){check(counts.count===0);return true;}
 for(const row of db.prepare("SELECT * FROM market_requests WHERE operation IN ('image-upload','image-approve')").iterate()){
  check(UUID.test(row.user_id)&&db.prepare('SELECT 1 FROM users WHERE id=?').get(row.user_id)&&REQUEST_ID.test(row.request_id)&&/^[0-9a-f]{64}$/.test(row.fingerprint)&&stamp(row.created_at));
  const response=JSON.parse(row.response_json);check(response?.ok===true&&!Object.hasOwn(response,'replayed'));
  const images=row.operation==='image-upload'?[response.image]:response.images;
  check(Array.isArray(images)&&images.length>=1&&images.length<=DEFAULT_IMAGE_LIMITS.maxApprovalBatch&&new Set(images.map(image=>image?.id)).size===images.length);
  if(row.operation==='image-approve')check(response.approved===images.length);
  for(const image of images){
   check(image&&UUID.test(image.id));const stored=db.prepare('SELECT * FROM market_images WHERE id=?').get(image.id);check(stored);
   const expected=metadata({...stored,version:row.operation==='image-upload'?1:2,status:row.operation==='image-upload'?'pending':'approved'});check(JSON.stringify(image)===JSON.stringify(expected));
   if(row.operation==='image-upload')check(stored.author_id===row.user_id&&stored.created_at===row.created_at);
   else check(stored.status==='approved'&&stored.approved_by===row.user_id&&stored.approved_at===row.created_at);
  }
 }
 return true;
}
module.exports={MarketImageStore,validateMarketImagesDatabase,inspectCanonicalImage,DEFAULT_IMAGE_LIMITS,BUCKETS};
