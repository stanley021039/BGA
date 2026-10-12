const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
test('all ten room entry points load the common actions before their controllers',()=>{
 for(const type of ['poker','race','draw','gift','majority','telephone','trpg','musicquiz','minimal','bluff']){
  const html=fs.readFileSync(path.join(__dirname,'../public',type+'.html'),'utf8');
  for(const asset of ['room-controls.js','room-controls.css','chat.js','game-shell.js','table-media.js'])assert.equal(html.split('/shared/'+asset).length-1,1,type+' '+asset);
  assert.ok(html.indexOf('/shared/room-controls.js')<html.indexOf('/shared/game-shell.js'),type+' controls ready before shell');
 }
});
