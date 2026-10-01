const {HttpError}=require('../http/errors');

function displayNameOf(value){
 const name=String(value||'').trim();
 if(!name||[...name].length>16||/[\u0000-\u001f\u007f]/.test(name))throw new HttpError(400,'INVALID_DISPLAY_NAME','暱稱需為 1–16 字，且不能換行');
 return name;
}

module.exports={displayNameOf};
