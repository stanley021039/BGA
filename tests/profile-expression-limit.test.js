const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {openDatabase}=require('../src/db'),{createAuth}=require('../src/auth');
const {createCharacter,addExpression}=require('../src/profiles/uploads');
test('custom character accepts fifteen expressions, preserves twenty characters, and rolls back over-limit writes',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'bga-expression-limit-')),db=openDatabase(path.join(root,'app.sqlite'));
 try{
  await createAuth(db).bootstrap('expressionadmin','test-password-123');
  const owner=db.prepare('SELECT id FROM users WHERE username=?').get('expressionadmin').id;
  const image={base64:fs.readFileSync(path.join(__dirname,'../public/assets/characters/traveler-neutral.png')).toString('base64')};
  const character=createCharacter(db,owner,{name:'表情容量',...image}),id=character.id.slice(5);
  const caption='一二三四五六七八九十一二三四五六七八九十';
  assert.equal([...caption].length,20);
  assert.throws(()=>addExpression(db,'other-owner',character.id,{name:'越權',...image}),error=>error.code==='CHARACTER_NOT_FOUND');
  assert.throws(()=>addExpression(db,owner,character.id,{name:caption+'多',...image}),error=>error.code==='INVALID_EXPRESSION_NAME');
  const first=addExpression(db,owner,character.id,{name:caption,...image});
  assert.equal(db.prepare('SELECT label FROM character_images WHERE character_id=? AND expression=?').get(id,first.expression).label,caption);
  assert.throws(()=>addExpression(db,owner,character.id,{name:caption,...image}),error=>error.code==='DUPLICATE_EXPRESSION_NAME');
  for(let i=2;i<=15;i++)addExpression(db,owner,character.id,{name:'表情'+i,...image});
  assert.throws(()=>addExpression(db,owner,character.id,{name:'第十六個',...image}),error=>error.code==='EXPRESSION_LIMIT');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM character_images WHERE character_id=?').get(id).n,16);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM character_images WHERE character_id=? AND label=?').get(id,'第十六個').n,0);
 }finally{db.close();fs.rmSync(root,{recursive:true,force:true});}
});
