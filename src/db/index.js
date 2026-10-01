const fs=require('node:fs');
const path=require('node:path');
const {DatabaseSync}=require('node:sqlite');

function openDatabase(file){
 fs.mkdirSync(path.dirname(file),{recursive:true});
 const db=new DatabaseSync(file,{timeout:5000});
 db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000');
 const version=db.prepare('PRAGMA user_version').get().user_version;
 if(version>3)throw Error(`Unsupported database version ${version}`);
 if(version<1){
  db.exec('BEGIN IMMEDIATE');
  try{
   db.exec(`
    CREATE TABLE users(id TEXT PRIMARY KEY,username TEXT NOT NULL UNIQUE,display_name TEXT NOT NULL,password_hash TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('member','admin')),disabled INTEGER NOT NULL DEFAULT 0,appearance TEXT,created_at TEXT NOT NULL);
    CREATE TABLE sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires_at TEXT NOT NULL,revoked_at TEXT);
    CREATE TABLE invites(token_hash TEXT PRIMARY KEY,created_by TEXT NOT NULL REFERENCES users(id),expires_at TEXT NOT NULL,used_by TEXT UNIQUE REFERENCES users(id),revoked_at TEXT);
    CREATE TABLE password_resets(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),created_by TEXT NOT NULL REFERENCES users(id),expires_at TEXT NOT NULL,used_at TEXT);
    CREATE INDEX sessions_user ON sessions(user_id);
    CREATE INDEX invites_created_by ON invites(created_by);
    PRAGMA user_version=1;
   `);
   db.exec('COMMIT');
  }catch(error){db.exec('ROLLBACK');db.close();throw error;}
 }
 if(version<2){
  db.exec('BEGIN IMMEDIATE');
  try{
   db.exec(`
    CREATE TABLE board_issues(id TEXT PRIMARY KEY,author_id TEXT REFERENCES users(id),title TEXT NOT NULL,body TEXT NOT NULL,name TEXT NOT NULL,game TEXT NOT NULL,status TEXT NOT NULL,at TEXT NOT NULL,github_number INTEGER UNIQUE,github_url TEXT);
    CREATE TABLE board_comments(id TEXT PRIMARY KEY,issue_id TEXT NOT NULL REFERENCES board_issues(id),author_id TEXT REFERENCES users(id),name TEXT NOT NULL,body TEXT NOT NULL,at TEXT NOT NULL,github_id INTEGER);
    CREATE TABLE submissions(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),kind TEXT NOT NULL,issue_id TEXT,payload TEXT NOT NULL,state TEXT NOT NULL,remote_id TEXT,error TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
    CREATE INDEX board_comments_issue ON board_comments(issue_id);
    CREATE INDEX submissions_user ON submissions(user_id);
    PRAGMA user_version=2;
   `);
   db.exec('COMMIT');
  }catch(error){db.exec('ROLLBACK');db.close();throw error;}
 }
 if(version<3){
  db.exec('BEGIN IMMEDIATE');
  try{
   db.exec(`
    CREATE TABLE player_characters(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES users(id),name TEXT NOT NULL,created_at TEXT NOT NULL);
    CREATE TABLE character_images(character_id TEXT NOT NULL REFERENCES player_characters(id) ON DELETE CASCADE,expression TEXT NOT NULL,mime TEXT NOT NULL,bytes BLOB NOT NULL,PRIMARY KEY(character_id,expression));
    CREATE INDEX player_characters_owner ON player_characters(owner_id);
    PRAGMA user_version=3;
   `);
   db.exec('COMMIT');
  }catch(error){db.exec('ROLLBACK');db.close();throw error;}
 }
 return db;
}

function transaction(db,run){
 db.exec('BEGIN IMMEDIATE');
 try{const result=run();db.exec('COMMIT');return result;}
 catch(error){db.exec('ROLLBACK');throw error;}
}

module.exports={openDatabase,transaction};
