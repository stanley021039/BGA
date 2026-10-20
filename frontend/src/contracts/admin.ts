import { array,record,text } from '../services/validation';
export interface AdminUser {id:string;username:string;displayName:string;role:'admin'|'member';disabled:boolean;createdAt:string}
export type AdminSubmissionState='pending'|'sending'|'needs_review'|'failed'|'done';
export interface AdminSubmission {id:string;kind:'issue'|'comment'|'status';state:AdminSubmissionState;createdAt:string;error:string}
export interface AdminSecret {kind:'invite'|'reset';value:string;href:string;expiresAt:string;recipient:string}
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
function id(value:unknown){if(typeof value!=='string'||!uuid.test(value))throw Error('管理資料識別碼格式不正確');return value;}
function timestamp(value:unknown){if(typeof value!=='string'||!Number.isFinite(Date.parse(value)))throw Error('管理資料日期格式不正確');return value;}
export function readAdminUsers(value:unknown):AdminUser[]{return array(value).map(value=>{const u=record(value);if(typeof u.username!=='string'||typeof u.displayName!=='string'||!['admin','member'].includes(String(u.role))||![0,1,true,false].includes(u.disabled as number|boolean))throw Error('會員資料格式不正確');return {id:id(u.id),username:u.username,displayName:u.displayName,role:u.role as AdminUser['role'],disabled:!!u.disabled,createdAt:timestamp(u.createdAt)};});}
function submissionState(value:unknown):AdminSubmissionState{if(!['pending','sending','needs_review','failed','done'].includes(String(value)))throw Error('提交狀態格式不正確');return value as AdminSubmissionState;}
export function readAdminSubmissions(value:unknown):AdminSubmission[]{return array(value).map(value=>{const s=record(value);if(!['issue','comment','status'].includes(String(s.kind)))throw Error('提交類型格式不正確');return {id:id(s.id),kind:s.kind as AdminSubmission['kind'],state:submissionState(s.state),createdAt:timestamp(s.createdAt),error:text(s.error)};});}
export function readAdminRetry(value:unknown){const s=record(value);return {id:id(s.submissionId),state:submissionState(s.state),error:text(s.error)};}
export function readAdminOK(value:unknown){if(record(value).ok!==true)throw Error('伺服器尚未確認操作完成');}
export function readAdminSecret(value:unknown,kind:AdminSecret['kind'],origin:string,recipient=''):AdminSecret{
 const s=record(value),token=kind==='invite'?s.code:s.token;if(typeof token!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(token))throw Error('一次性連結資料格式不正確，請重新確認操作結果');
 const link=new URL('/login',origin);link.searchParams.set(kind==='invite'?'invite':'reset',token);
 return {kind,value:token,href:link.href,expiresAt:timestamp(s.expiresAt),recipient};
}
export function readShareOrigin(value:unknown,currentOrigin:string){
 const info=record(value),addresses=Array.isArray(info.addresses)?info.addresses.filter((v):v is string=>typeof v==='string'):[];
 const preferred=typeof info.preferred==='string'&&info.preferred?info.preferred:addresses[0]||currentOrigin;
 let url:URL;try{url=new URL(preferred);}catch{throw Error('對外連線網址格式不正確，請確認 PUBLIC_URL。');}
 const hostname=url.hostname.toLowerCase();
 if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw Error('對外連線網址必須是沒有帳密的 HTTP 或 HTTPS 網址。');
 if(hostname==='localhost'||hostname.endsWith('.localhost')||/^127\./.test(hostname)||['[::1]','0.0.0.0','[::]'].includes(hostname))throw Error('找不到可分享的 IP，請確認 VPN 連線或設定 PUBLIC_URL。');
 return url.origin;
}
export const adminSubmissionLabels:Record<AdminSubmissionState,string>={pending:'等待同步',sending:'同步中',needs_review:'需要人工確認',failed:'同步失敗',done:'同步完成'};
export const adminSubmissionKinds:Record<AdminSubmission['kind'],string>={issue:'留言',comment:'回覆',status:'狀態更新'};
