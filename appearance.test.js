const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {builtinCharacters,defaults,validateAppearance,normalizeAppearance}=require('./src/profiles/appearance');
const {imageOf}=require('./src/profiles/uploads');

test('ten bundled image characters have neutral art and optional expressions',()=>{
 assert.equal(builtinCharacters.length,10);
 assert.equal(new Set(builtinCharacters.map(character=>character.id)).size,10);
 for(const character of builtinCharacters){
  assert.deepEqual(validateAppearance(character.appearance),character.appearance);
  assert.ok(character.expressions.neutral);
  for(const url of Object.values(character.expressions))assert.ok(fs.existsSync(path.join(__dirname,'public',url)));
 }
 assert.ok(Object.keys(builtinCharacters[0].expressions).length>Object.keys(builtinCharacters[9].expressions).length);
 assert.throws(()=>validateAppearance({...defaults,expression:'unknown'}),{code:'INVALID_APPEARANCE'});
});

test('old appearance versions migrate to image characters',()=>{
 const v1={version:1,hair:'long',face:'oval',outfit:'dress',skinColor:'#dca77c',hairColor:'#60432c',outfitColor:'#be665f'};
 const v2={version:2,gender:'masculine',species:'orc',skinColor:'#f6d6b8',hairColor:'#2b2020',topColor:'#557bb5',bottomColor:'#506773',shoeColor:'#60432c'};
 for(const old of [v1,v2,{...v2,version:3},{version:4,skinId:'builtin:traveler'}]){
  const migrated=normalizeAppearance(old);
  assert.equal(migrated.version,5);
  assert.equal(migrated.expression,'neutral');
  assert.ok(builtinCharacters.some(character=>character.id===migrated.characterId));
 }
 assert.equal(normalizeAppearance(v2).characterId,'builtin:traveler');
 assert.throws(()=>normalizeAppearance({...v1,outfitColor:'<script>'}),{code:'INVALID_APPEARANCE'});
});

test('uploads inspect image bytes and MIME without a pixel-size limit',()=>{
 for(const filename of ['traveler-neutral.png','traveler-happy.gif']){
  const bytes=fs.readFileSync(path.join(__dirname,'public/assets/characters',filename));
  const image=imageOf({base64:bytes.toString('base64')});
  assert.equal(image.width,256);assert.equal(image.height,256);
  assert.equal(image.mime,filename.endsWith('.gif')?'image/gif':'image/png');
 }
 const tinyGif=Buffer.from('R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=','base64');
 const tiny=imageOf({base64:tinyGif.toString('base64')});
 assert.deepEqual([tiny.width,tiny.height],[1,1]);
 const largeGif=Buffer.from(tinyGif);
 largeGif.writeUInt16LE(1024,6);largeGif.writeUInt16LE(768,8);
 const large=imageOf({base64:largeGif.toString('base64')});
 assert.deepEqual([large.width,large.height],[1024,768]);
 largeGif.writeUInt16LE(0,6);
 assert.throws(()=>imageOf({base64:largeGif.toString('base64')}),{code:'INVALID_CHARACTER_IMAGE'});
 assert.throws(()=>imageOf({base64:Buffer.from('<svg/>').toString('base64'),mime:'image/png'}),{code:'INVALID_CHARACTER_IMAGE'});
});
