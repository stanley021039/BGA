const {HttpError}=require('../../http/errors');

function createGitHubClient({token,repository='stanley021039/BGA',fetchImpl=fetch,baseUrl='https://api.github.com'}={}){
 if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository))throw Error('Invalid GitHub repository');
 const root=`${baseUrl}/repos/${repository}`;
 async function request(method,route,body){
  if(!token)throw new HttpError(503,'GITHUB_NOT_CONFIGURED','GitHub 同步尚未設定');
  const response=await fetchImpl(root+route,{method,headers:{Accept:'application/vnd.github+json',Authorization:`Bearer ${token}`,'User-Agent':'Afterhours-board',...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(10000)});
  if(!response.ok){const error=new HttpError(502,'GITHUB_ERROR',`GitHub 暫時無法完成操作（HTTP ${response.status}）`);error.remoteStatus=response.status;throw error;}
  return response.json();
 }
 const marker=id=>`<!-- afterhours-submission:${id} -->`;
 async function findInPages(route,id){for(let page=1;page<=10;page++){const rows=await request('GET',`${route}${route.includes('?')?'&':'?'}per_page=100&page=${page}`);const found=rows.find(row=>!row.pull_request&&row.body?.includes(marker(id)));if(found)return found;if(rows.length<100)return null;}return null;}
 return {
  configured:!!token,marker,
  createIssue:(payload,id)=>request('POST','/issues',{title:payload.title,body:`${payload.body}\n\n遊戲分類：${payload.game}\n留言者：${payload.name}\n\n${marker(id)}`}),
  findIssue:id=>findInPages('/issues?state=all',id),
  createComment:(number,payload,id)=>request('POST',`/issues/${number}/comments`,{body:`${payload.body}\n\n回覆者：${payload.name}\n\n${marker(id)}`}),
  findComment:(number,id)=>findInPages(`/issues/${number}/comments`,id),
  setStatus:(number,status)=>request('PATCH',`/issues/${number}`,{state:status}),
  getIssue:number=>request('GET',`/issues/${number}`)
 };
}

module.exports={createGitHubClient};
