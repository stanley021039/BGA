const {HttpError}=require('../http/errors');

function displayNameOf(value){
 const name=String(value||'').trim();
 if(!name||name.length>16)throw new HttpError(400,'INVALID_DISPLAY_NAME','暱稱需為 1–16 字');
 return name;
}

module.exports={displayNameOf};
