const {isIP}=require('node:net');

const loopback=new Set(['127.0.0.1','::1','::ffff:127.0.0.1']);

function clientAddress(req,trustCloudflare=false){
 const peer=req.socket.remoteAddress||'unknown';
 const forwarded=req.headers['cf-connecting-ip'];
 if(trustCloudflare&&loopback.has(peer)&&typeof forwarded==='string'&&isIP(forwarded))return forwarded;
 return peer;
}

function setSecurityHeaders(res,publicUrl){
 res.setHeader('Cache-Control','no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('X-Frame-Options','DENY');
 res.setHeader('Referrer-Policy','same-origin');
 res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
 res.setHeader('Content-Security-Policy',"frame-ancestors 'none'; base-uri 'none'; object-src 'none'");
 res.setHeader('X-Robots-Tag','noindex, nofollow, noarchive');
 if(publicUrl?.startsWith('https://'))res.setHeader('Strict-Transport-Security','max-age=31536000');
}

module.exports={clientAddress,setSecurityHeaders};
