const {legacyMarketSchema}=require('./helpers/market-legacy-schema.cjs');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {openDatabase,SCHEMA_VERSION}=require('../src/db');

for(const source of ['music-v11','collection-v12'])test(`integration upgrades ${source} without losing member collections`,()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'bga-collection-migration-'));
 const file=path.join(root,'app.sqlite');let db;
 try{
  db=openDatabase(file);
  db.prepare('INSERT INTO users(id,username,display_name,password_hash,role,created_at) VALUES(?,?,?,?,?,?)').run('owner','owner','Owner','fixture','member',new Date().toISOString());
  db.prepare('INSERT INTO user_artworks(id,owner_id,name,mime,bytes,created_at,shared) VALUES(?,?,?,?,?,?,?)').run('art','owner','Artwork','image/png',Buffer.from([1,2,3]),new Date().toISOString(),1);
  if(source==='music-v11'){
   legacyMarketSchema(db);db.exec('ALTER TABLE user_artworks DROP COLUMN shared; PRAGMA user_version=11');
   db.prepare('INSERT INTO music_tracks(id,owner_id,title,duration,size,mime,ext,created_at) VALUES(?,?,?,?,?,?,?,?)').run('song','owner','Song',60,100,'audio/mpeg','mp3',new Date().toISOString());
  }else db.exec('DROP TABLE music_tracks');
  db.close();db=openDatabase(file);
  assert.equal(db.prepare('PRAGMA user_version').get().user_version,SCHEMA_VERSION);
  assert.equal(db.prepare('SELECT name FROM user_artworks WHERE id=?').get('art').name,'Artwork');
  assert.equal(db.prepare('SELECT shared FROM user_artworks WHERE id=?').get('art').shared,source==='music-v11'?0:1);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM music_tracks').get().count,source==='music-v11'?1:0);
  db.close();db=openDatabase(file);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM users').get().count,1);
 }finally{db?.close();fs.rmSync(root,{recursive:true,force:true});}
});
