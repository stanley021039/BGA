'use strict';
const GACHA_TABLES = Object.freeze([
  'gacha_wallets',
  'gacha_ownership',
  'gacha_ledger',
  'gacha_requests',
  'gacha_settings',
]);
const GACHA_SQL = Object.freeze([
  "CREATE TABLE IF NOT EXISTS gacha_wallets(user_id TEXT PRIMARY KEY REFERENCES users(id),coins INTEGER NOT NULL DEFAULT 0 CHECK(typeof(coins)='integer' AND coins BETWEEN 0 AND 9007199254740991),fragments INTEGER NOT NULL DEFAULT 0 CHECK(typeof(fragments)='integer' AND fragments BETWEEN 0 AND 9007199254740991),updated_at TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS gacha_ownership(user_id TEXT NOT NULL REFERENCES users(id),kind TEXT NOT NULL CHECK(kind IN ('attacks','entrances','backgrounds','frames','media','sounds','openings')),reward_id TEXT NOT NULL,source TEXT NOT NULL CHECK(source IN ('legacy','draw','exchange')),acquired_at TEXT NOT NULL,PRIMARY KEY(user_id,kind,reward_id))",
  "CREATE TABLE IF NOT EXISTS gacha_ledger(event_id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),reason TEXT NOT NULL CHECK(reason IN ('login','match','draw','exchange')),coins_delta INTEGER NOT NULL CHECK(typeof(coins_delta)='integer'),fragments_delta INTEGER NOT NULL CHECK(typeof(fragments_delta)='integer'),fingerprint TEXT NOT NULL CHECK(length(fingerprint)=64),created_at TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS gacha_requests(user_id TEXT NOT NULL REFERENCES users(id),request_id TEXT NOT NULL CHECK(length(request_id)=36),operation TEXT NOT NULL CHECK(operation IN ('draw','exchange')),fingerprint TEXT NOT NULL CHECK(length(fingerprint)=64),response_json TEXT NOT NULL CHECK(length(response_json)<=131072 AND json_valid(response_json)),created_at TEXT NOT NULL,PRIMARY KEY(user_id,request_id))",
  'CREATE TABLE IF NOT EXISTS gacha_settings(name TEXT PRIMARY KEY,value TEXT NOT NULL)',
]);
module.exports = { GACHA_TABLES, GACHA_SQL };
