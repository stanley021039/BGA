'use strict';
const REWARD_TABLES = Object.freeze(['achievement_match_events', 'user_cosmetic_rewards']);
const REWARD_SQL = Object.freeze([
  "CREATE TABLE IF NOT EXISTS achievement_match_events(event_id TEXT PRIMARY KEY,game_type TEXT NOT NULL CHECK(game_type IN ('quacks','musicquiz','bluff','minimal','telephone','trpg')),completed_at TEXT NOT NULL,purpose TEXT NOT NULL CHECK(purpose IN ('production','test','tutorial')),fingerprint TEXT NOT NULL CHECK(length(fingerprint)=64),facts_json TEXT NOT NULL CHECK(length(facts_json)<=131072 AND json_valid(facts_json)))",
  'CREATE TABLE IF NOT EXISTS user_cosmetic_rewards(user_id TEXT NOT NULL REFERENCES users(id),frame_id TEXT NOT NULL,achievement_id TEXT NOT NULL,claimed_at TEXT NOT NULL,PRIMARY KEY(user_id,frame_id),FOREIGN KEY(user_id,achievement_id) REFERENCES user_achievements(user_id,achievement_id))',
]);
module.exports = { REWARD_TABLES, REWARD_SQL };
