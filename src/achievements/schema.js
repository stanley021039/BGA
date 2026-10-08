const ACHIEVEMENT_TABLES=Object.freeze(['processed_unit_events','achievement_progress']);
const ACHIEVEMENT_SQL=Object.freeze([
 `CREATE TABLE IF NOT EXISTS processed_unit_events(
  unit_event_id TEXT PRIMARY KEY CHECK(length(unit_event_id)=36),
  match_id TEXT NOT NULL CHECK(length(match_id)=36),
  game_type TEXT NOT NULL CHECK(game_type IN ('draw','gift','majority','poker','thunder')),
  unit TEXT NOT NULL CHECK(unit IN ('round','hand','race')),
  unit_number INTEGER NOT NULL CHECK(typeof(unit_number)='integer' AND unit_number BETWEEN 1 AND 1000000),
  status TEXT NOT NULL CHECK(status IN ('rules_completed','interrupted','abandoned')),
  completed_at TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK(purpose IN ('production','test','tutorial')),
  source TEXT NOT NULL CHECK(source='game_server'),
  rule_version INTEGER NOT NULL CHECK(typeof(rule_version)='integer' AND rule_version=1),
  fingerprint TEXT NOT NULL CHECK(length(fingerprint)=64),
  facts_json TEXT NOT NULL CHECK(length(facts_json)<=131072 AND json_valid(facts_json) AND json_type(facts_json)='object'),
  UNIQUE(match_id,game_type,unit,unit_number)
 )`,
 `CREATE TABLE IF NOT EXISTS achievement_progress(
  user_id TEXT NOT NULL REFERENCES users(id),
  achievement_id TEXT NOT NULL CHECK(achievement_id='all-two-tables'),
  rule_version INTEGER NOT NULL CHECK(typeof(rule_version)='integer' AND rule_version=1),
  game_type TEXT NOT NULL CHECK(game_type IN ('draw','gift','majority','poker','thunder')),
  first_unit_event_id TEXT NOT NULL REFERENCES processed_unit_events(unit_event_id),
  first_completed_at TEXT NOT NULL,
  PRIMARY KEY(user_id,achievement_id,rule_version,game_type)
 )`,
]);
module.exports={ACHIEVEMENT_TABLES,ACHIEVEMENT_SQL};
