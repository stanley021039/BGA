const {HttpError}=require('../http/errors');

const MAX_SOUND_BYTES=480044;
const MAX_SOUND_DURATION_MS=10000;
const SOUND_SAMPLE_RATE=24000;
const SOUND_EXPRESSION=/^(?:happy|sad|surprised|thinking|angry|emote-[a-f0-9-]{36})$/;
function invalid(){throw new HttpError(400,'INVALID_EXPRESSION_SOUND','音效需為 10 秒內的有效 WAV 音檔');}
function inspectExpressionSound(input){
 if(!(input instanceof Uint8Array)||input.byteLength<46||input.byteLength>MAX_SOUND_BYTES)invalid();
 const bytes=Buffer.isBuffer(input)?input:Buffer.from(input);
 const tag=(offset,value)=>bytes.subarray(offset,offset+value.length).equals(Buffer.from(value));
 if(!tag(0,'RIFF')||bytes.readUInt32LE(4)!==bytes.length-8||!tag(8,'WAVE')||!tag(12,'fmt ')||bytes.readUInt32LE(16)!==16||
    bytes.readUInt16LE(20)!==1||bytes.readUInt16LE(22)!==1||bytes.readUInt32LE(24)!==SOUND_SAMPLE_RATE||
    bytes.readUInt32LE(28)!==SOUND_SAMPLE_RATE*2||bytes.readUInt16LE(32)!==2||bytes.readUInt16LE(34)!==16||!tag(36,'data'))invalid();
 const dataLength=bytes.readUInt32LE(40);
 if(dataLength!==bytes.length-44||dataLength<2||dataLength%2||dataLength/2>SOUND_SAMPLE_RATE*10)invalid();
 return {mime:'audio/wav',durationMs:Math.ceil(dataLength/2/(SOUND_SAMPLE_RATE/1000)),bytes};
}
function soundOf(data){
 const base64=data?.base64;
 if(typeof base64!=='string'||base64.length>Math.ceil(MAX_SOUND_BYTES/3)*4||!/^[A-Za-z0-9+/]+={0,2}$/.test(base64))invalid();
 const bytes=Buffer.from(base64,'base64');
 if(bytes.toString('base64')!==base64)invalid();
 return inspectExpressionSound(bytes);
}
function ownedExpression(db,ownerId,uuid,expression){
 const owned=db.prepare('SELECT player_characters.id FROM player_characters JOIN users ON users.id=player_characters.owner_id WHERE player_characters.id=? AND owner_id=? AND users.disabled=0').get(uuid,ownerId);
 if(!owned)throw new HttpError(404,'CHARACTER_NOT_FOUND','找不到你的角色');
 if(typeof expression!=='string'||!SOUND_EXPRESSION.test(expression)||!db.prepare('SELECT 1 FROM character_images WHERE character_id=? AND expression=?').get(uuid,expression))throw new HttpError(400,'INVALID_EXPRESSION','音效只能設定於已存在的表情');
}
function setExpressionSound(db,ownerId,uuid,expression,data){
 ownedExpression(db,ownerId,uuid,expression);
 const sound=soundOf(data);
 db.prepare('INSERT INTO character_sounds(character_id,expression,mime,bytes,duration_ms) VALUES(?,?,?,?,?) ON CONFLICT(character_id,expression) DO UPDATE SET mime=excluded.mime,bytes=excluded.bytes,duration_ms=excluded.duration_ms').run(uuid,expression,sound.mime,sound.bytes,sound.durationMs);
 return {url:`/assets/characters/sounds/${uuid}/${expression}`,durationMs:sound.durationMs};
}
function removeExpressionSound(db,ownerId,uuid,expression){
 ownedExpression(db,ownerId,uuid,expression);
 db.prepare('DELETE FROM character_sounds WHERE character_id=? AND expression=?').run(uuid,expression);
 return {ok:true};
}

module.exports={MAX_SOUND_BYTES,MAX_SOUND_DURATION_MS,inspectExpressionSound,setExpressionSound,removeExpressionSound};
