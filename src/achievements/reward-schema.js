'use strict';
const REWARD_TABLES = Object.freeze(['achievement_match_events', 'user_cosmetic_rewards']);
const MATCH_EVENT_SQL =
  "CREATE TABLE IF NOT EXISTS achievement_match_events(event_id TEXT PRIMARY KEY,game_type TEXT NOT NULL CHECK(game_type IN ('quacks','musicquiz','bluff','minimal','telephone','trpg','brainwave','drama-bar','decrypto','second-wind','ceo','arena')),completed_at TEXT NOT NULL,purpose TEXT NOT NULL CHECK(purpose IN ('production','test','tutorial')),fingerprint TEXT NOT NULL CHECK(length(fingerprint)=64),facts_json TEXT NOT NULL CHECK(length(facts_json)<=131072 AND json_valid(facts_json)))";
// Schemas 20-22 stored a shorter game list; schema 23 rebuilds the table with
// MATCH_EVENT_SQL. Kept so an older database is recognised before that step.
const MATCH_EVENT_SQL_V22 =
  "CREATE TABLE IF NOT EXISTS achievement_match_events(event_id TEXT PRIMARY KEY,game_type TEXT NOT NULL CHECK(game_type IN ('quacks','musicquiz','bluff','minimal','telephone','trpg')),completed_at TEXT NOT NULL,purpose TEXT NOT NULL CHECK(purpose IN ('production','test','tutorial')),fingerprint TEXT NOT NULL CHECK(length(fingerprint)=64),facts_json TEXT NOT NULL CHECK(length(facts_json)<=131072 AND json_valid(facts_json)))";
const REWARD_SQL = Object.freeze([
  MATCH_EVENT_SQL,
  'CREATE TABLE IF NOT EXISTS user_cosmetic_rewards(user_id TEXT NOT NULL REFERENCES users(id),frame_id TEXT NOT NULL,achievement_id TEXT NOT NULL,claimed_at TEXT NOT NULL,PRIMARY KEY(user_id,frame_id),FOREIGN KEY(user_id,achievement_id) REFERENCES user_achievements(user_id,achievement_id))',
]);
module.exports = { REWARD_TABLES, REWARD_SQL, MATCH_EVENT_SQL, MATCH_EVENT_SQL_V22 };
