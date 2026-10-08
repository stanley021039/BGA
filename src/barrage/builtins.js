const {HttpError}=require('../http/errors');

// These IDs describe local artwork only. No URL, CSS or caller-owned object is
// retained in the social event, so each confirmed message has a stable style.
const BUILTIN_FRAME_OPTIONS=Object.freeze([
 Object.freeze({id:'default',label:'預設'}),
 Object.freeze({id:'paper',label:'紙張'}),
 Object.freeze({id:'comic',label:'漫畫'}),
 Object.freeze({id:'pixel',label:'像素'}),
]);
const ids=new Set(BUILTIN_FRAME_OPTIONS.map(option=>option.id));
const descriptors=Object.freeze(Object.fromEntries(BUILTIN_FRAME_OPTIONS.map(({id})=>[id,Object.freeze({kind:'builtin',id,version:1})])));

function normalizeBuiltinFrameId(input){
 if(input===undefined||input===null)return 'default';
 if(typeof input!=='string'||input.length>7||!ids.has(input))
  throw new HttpError(400,'INVALID_BARRAGE_FRAME','請選擇有效的內建彈幕框');
 return input;
}
function builtinFrameDescriptor(input){return descriptors[normalizeBuiltinFrameId(input)];}

module.exports={BUILTIN_FRAME_OPTIONS,normalizeBuiltinFrameId,builtinFrameDescriptor};
