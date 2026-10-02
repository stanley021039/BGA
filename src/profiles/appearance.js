const {HttpError}=require('../http/errors');

const expressionLabels={neutral:'平常',happy:'開心',sad:'難過',surprised:'驚訝',thinking:'思考',angry:'生氣'};
const slugs=['traveler','woods','mage','knight','sunny','harbor','bloom','ember','starlight','meadow'];
const names=['藍衣冒險者','綠衣旅人','城市旅人','街頭夥伴','小機器人','綠皮殭屍','飛躍少年','敏捷女孩','綠衫玩家','荒野士兵'];
const builtinCharacters=slugs.map((slug,index)=>{
 const expressions={};
 for(const expression of Object.keys(expressionLabels)){
  if(index>=6&&['surprised','thinking'].includes(expression))continue;
  const extension=expression==='happy'?'gif':'png';
  expressions[expression]=`/assets/characters/${slug}-${expression}.${extension}`;
 }
 return {id:`builtin:${slug}`,name:names[index],expressions,labels:expressionLabels,source:'Kenney',appearance:{version:5,characterId:`builtin:${slug}`,expression:'neutral'}};
});
const defaults={...builtinCharacters[0].appearance};
const legacyColors={skin:['#f6d6b8','#dca77c','#b87955','#8b583e','#5d392d','#9ab483','#a6acd0'],hair:['#2b2020','#60432c','#ab7043','#d3ae70','#5a4b72','#a74c55'],clothing:['#557bb5','#be665f','#6b9a74','#9a78ae','#c0934f','#506773','#60432c','#e4dfd0']};
const oldDesigns=[
 ['traveler','#f6d6b8','#2b2020','#557bb5','#506773','#60432c'],
 ['woods','#dca77c','#60432c','#6b9a74','#60432c','#60432c'],
 ['mage','#f6d6b8','#5a4b72','#9a78ae','#506773','#60432c'],
 ['knight','#dca77c','#2b2020','#506773','#506773','#60432c'],
 ['sunny','#f6d6b8','#d3ae70','#be665f','#e4dfd0','#60432c'],
 ['harbor','#b87955','#60432c','#557bb5','#506773','#60432c'],
 ['bloom','#dca77c','#ab7043','#6b9a74','#be665f','#60432c'],
 ['ember','#8b583e','#2b2020','#be665f','#60432c','#60432c'],
 ['starlight','#a6acd0','#5a4b72','#506773','#9a78ae','#60432c'],
 ['meadow','#9ab483','#a74c55','#c0934f','#6b9a74','#60432c']
];
function invalid(){throw new HttpError(400,'INVALID_APPEARANCE','角色設定不正確');}
function legacyId(input){
 const version=Number(input.version);
 const skin=input.skinColor,hair=input.hairColor,shirt=version===1?input.outfitColor:input.topColor,pants=input.bottomColor,boots=input.shoeColor;
 if(!legacyColors.skin.includes(skin)||!legacyColors.hair.includes(hair)||!legacyColors.clothing.includes(shirt))invalid();
 if(pants!==undefined&&!legacyColors.clothing.includes(pants))invalid();
 if(boots!==undefined&&!legacyColors.clothing.includes(boots))invalid();
 if(version===1&&!['hoodie','jacket','dress','shirt'].includes(input.outfit))invalid();
 const score=design=>Number(design[1]===skin)*5+Number(design[2]===hair)*2+Number(design[3]===shirt)*4+Number(design[4]===pants)*2+Number(design[5]===boots);
 return 'builtin:'+oldDesigns.reduce((best,design)=>score(design)>score(best)?design:best,oldDesigns[0])[0];
}
function normalizeAppearance(input){
 if(!input||typeof input!=='object'||Array.isArray(input))invalid();
 const version=Number(input.version);
 if(version===5)return {version:5,characterId:input.characterId,expression:input.expression};
 if(version===4)return {version:5,characterId:input.skinId,expression:'neutral'};
 if([1,2,3].includes(version))return {version:5,characterId:legacyId(input),expression:'neutral'};
 invalid();
}
function validateAppearance(input){
 const value=normalizeAppearance(input);
 if(typeof value.characterId!=='string'||!(/^(?:builtin:[a-z]+|user:[a-f0-9-]{36})$/.test(value.characterId))||typeof value.expression!=='string'||!(Object.hasOwn(expressionLabels,value.expression)||/^emote-[a-f0-9-]{36}$/.test(value.expression)))invalid();
 return value;
}
function characterFor(db,userId,id){
 const builtin=builtinCharacters.find(character=>character.id===id);
 if(builtin)return builtin;
 if(!/^user:[a-f0-9-]{36}$/.test(id||''))return null;
 const row=db.prepare('SELECT player_characters.id,player_characters.name,player_characters.owner_id,player_characters.shared,users.display_name FROM player_characters JOIN users ON users.id=player_characters.owner_id WHERE player_characters.id=? AND users.disabled=0 AND (player_characters.owner_id=? OR player_characters.shared=1)').get(id.slice(5),userId);
 if(!row)return null;
 const expressions={},labels={};
 for(const {expression,label} of db.prepare('SELECT expression,label FROM character_images WHERE character_id=?').all(row.id)){
  expressions[expression]=`/assets/characters/user/${row.id}/${expression}`;
  labels[expression]=label||expressionLabels[expression];
 }
 return {id,name:row.name,expressions,labels,source:row.owner_id===userId?'我的作品':`由 ${row.display_name} 分享`,owned:row.owner_id===userId,shared:!!row.shared,appearance:{version:5,characterId:id,expression:'neutral'}};
}
function galleryFor(db,userId){
 const own=db.prepare('SELECT id FROM player_characters WHERE owner_id=? ORDER BY created_at DESC').all(userId);
 const shared=db.prepare('SELECT player_characters.id FROM player_characters JOIN users ON users.id=player_characters.owner_id WHERE player_characters.owner_id!=? AND player_characters.shared=1 AND users.disabled=0 ORDER BY player_characters.created_at DESC').all(userId);
 return [...builtinCharacters,...own.map(row=>characterFor(db,userId,'user:'+row.id)),...shared.map(row=>characterFor(db,userId,'user:'+row.id))].filter(Boolean);
}
function selectedImage(db,userId,input){
 const appearance=validateAppearance(input),character=characterFor(db,userId,appearance.characterId);
 if(!character)invalid();
 const expression=character.expressions[appearance.expression]?appearance.expression:'neutral';
 return {appearance:{...appearance,expression},url:character.expressions[expression],label:character.labels[expression]};
}
module.exports={expressionLabels,builtinCharacters,defaults,normalizeAppearance,validateAppearance,characterFor,galleryFor,selectedImage};
