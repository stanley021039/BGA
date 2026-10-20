'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {HttpError}=require('./errors');

// This is a document/asset adapter, not an SPA fallback. APIs and legacy pages
// keep their existing routing and authorization.
function createFrontend({enabled=false,root=path.join(__dirname,'../../frontend/dist')}={}){
 if(!enabled)return null;
 const pages=new Map(require('../../frontend/pages.json').map(page=>{
  if(!/^[a-z][a-z0-9-]*$/.test(page.id)||!/^[-a-z0-9]+\.html$/.test(page.document))throw Error('Invalid frontend document registry');
  return [page.document,`pages/${page.id}/index.html`];
 }));
 const documents=new Map();
 for(const [key,file]of pages)documents.set(key,fs.readFileSync(path.join(root,file)));
 const assetRoot=path.join(root,'frontend-assets'),assets=new Map();
 const mime={'.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.woff2':'font/woff2','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'};
 for(const name of fs.readdirSync(assetRoot)){
  if(!/^[A-Za-z0-9_.-]+$/.test(name)||!mime[path.extname(name)])continue;
  const location=path.join(assetRoot,name),stat=fs.lstatSync(location);
  if(stat.isFile()&&!stat.isSymbolicLink())assets.set('/frontend-assets/'+name,{location,mime:mime[path.extname(name)]});
 }
 return {
  readPage:file=>documents.get(file)||null,
  serveAsset(req,res,pathname){
   if(!pathname.startsWith('/frontend-assets/'))return false;
   if(!['GET','HEAD'].includes(req.method))throw new HttpError(405,'METHOD_NOT_ALLOWED','此操作不支援此方法');
   const asset=assets.get(pathname);
   if(!asset){res.writeHead(404);res.end();return true;}
   const bytes=fs.readFileSync(asset.location);
   res.setHeader('Content-Type',asset.mime);res.setHeader('Content-Length',bytes.length);
   if(req.method==='HEAD')res.end();else res.end(bytes);
   return true;
  },
 };
}
module.exports={createFrontend};
