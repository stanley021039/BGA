class HttpError extends Error{
 constructor(status,code,message){super(message);this.status=status;this.code=code;}
}

function writeError(res,error){
 const systemError=typeof error?.code==='string'&&/^(?:E[A-Z]+|SQLITE_)/.test(error.code);
 const status=error instanceof HttpError?error.status:systemError?500:400;
 const code=error instanceof HttpError?error.code:status===500?'INTERNAL_ERROR':'INVALID_REQUEST';
 const message=status===500?'伺服器暫時無法完成操作':error?.message||'請求不正確';
 if(status===500)console.error(error);
 res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});
 res.end(JSON.stringify({code,error:message}));
}

module.exports={HttpError,writeError};
