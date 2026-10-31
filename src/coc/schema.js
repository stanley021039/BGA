'use strict';

// Separate, server-owned COC data. No provider secrets or Keeper documents are
// included in a room snapshot or any public history projection.
const COC_SQL = [
  `CREATE TABLE coc_characters(
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL REFERENCES users(id),
    name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 80),
    status TEXT NOT NULL CHECK(status IN ('draft','ready')),
    revision INTEGER NOT NULL CHECK(revision>=1),
    rules_version TEXT NOT NULL,
    draft_json TEXT NOT NULL CHECK(json_valid(draft_json) AND length(draft_json)<=131072),
    sheet_json TEXT CHECK(sheet_json IS NULL OR (json_valid(sheet_json) AND length(sheet_json)<=131072)),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    CHECK((status='draft' AND sheet_json IS NULL) OR (status='ready' AND sheet_json IS NOT NULL))
  )`,
  `CREATE INDEX coc_character_owner ON coc_characters(owner_id,updated_at)`,
  `CREATE TABLE coc_character_rolls(
    character_id TEXT NOT NULL REFERENCES coc_characters(id) ON DELETE CASCADE,
    slot TEXT NOT NULL,
    result_json TEXT NOT NULL CHECK(json_valid(result_json)),
    PRIMARY KEY(character_id,slot)
  )`,
  `CREATE TABLE coc_campaigns(
    id TEXT PRIMARY KEY,
    room_code TEXT NOT NULL UNIQUE,
    host_user_id TEXT NOT NULL REFERENCES users(id),
    status TEXT NOT NULL CHECK(status IN ('waiting','playing','paused','finished')),
    revision INTEGER NOT NULL CHECK(revision>=1),
    state_json TEXT NOT NULL CHECK(json_valid(state_json) AND length(state_json)<=4194304),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE coc_members(
    campaign_id TEXT NOT NULL REFERENCES coc_campaigns(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id),
    seat_id TEXT NOT NULL,
    character_id TEXT REFERENCES coc_characters(id) ON DELETE SET NULL,
    character_json TEXT CHECK(character_json IS NULL OR json_valid(character_json)),
    active INTEGER NOT NULL CHECK(active IN (0,1)),
    joined_at TEXT NOT NULL,
    PRIMARY KEY(campaign_id,user_id),
    UNIQUE(campaign_id,seat_id)
  )`,
  `CREATE TABLE coc_receipts(
    user_id TEXT NOT NULL REFERENCES users(id),
    request_id TEXT NOT NULL,
    scope TEXT NOT NULL,
    fingerprint TEXT NOT NULL,
    response_json TEXT NOT NULL CHECK(json_valid(response_json) AND length(response_json)<=262144),
    created_at TEXT NOT NULL,
    PRIMARY KEY(user_id,request_id)
  )`,
  `CREATE TABLE coc_events(
    campaign_id TEXT NOT NULL REFERENCES coc_campaigns(id) ON DELETE CASCADE,
    sequence INTEGER NOT NULL CHECK(sequence>=1),
    kind TEXT NOT NULL,
    actor_id TEXT REFERENCES users(id),
    event_json TEXT NOT NULL CHECK(json_valid(event_json) AND length(event_json)<=131072),
    created_at TEXT NOT NULL,
    PRIMARY KEY(campaign_id,sequence)
  )`,
  `CREATE TABLE coc_ai_calls(
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL REFERENCES coc_campaigns(id) ON DELETE CASCADE,
    operation_id TEXT NOT NULL,
    stage TEXT NOT NULL CHECK(stage IN ('intent','narration')),
    provider TEXT NOT NULL CHECK(provider IN ('openai','anthropic')),
    model TEXT NOT NULL,
    payer_id TEXT REFERENCES users(id),
    key_scope TEXT NOT NULL CHECK(key_scope IN ('station','user')),
    status TEXT NOT NULL CHECK(status IN ('reserved','completed','failed','uncertain')),
    reserved_tokens INTEGER NOT NULL CHECK(reserved_tokens>=0),
    input_tokens INTEGER NOT NULL DEFAULT 0 CHECK(input_tokens>=0),
    output_tokens INTEGER NOT NULL DEFAULT 0 CHECK(output_tokens>=0),
    request_json TEXT NOT NULL CHECK(json_valid(request_json) AND length(request_json)<=262144),
    result_json TEXT CHECK(result_json IS NULL OR json_valid(result_json)),
    error_code TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(campaign_id,operation_id,stage)
  )`,
  `CREATE TABLE coc_provider_keys(
    owner_id TEXT NOT NULL REFERENCES users(id),
    scope TEXT NOT NULL CHECK(scope IN ('station','user')),
    provider TEXT NOT NULL CHECK(provider IN ('openai','anthropic')),
    model TEXT NOT NULL CHECK(length(model) BETWEEN 1 AND 100),
    encrypted_key TEXT NOT NULL,
    suffix TEXT NOT NULL,
    enabled INTEGER NOT NULL CHECK(enabled IN (0,1)),
    updated_at TEXT NOT NULL,
    PRIMARY KEY(owner_id,scope,provider)
  )`,
  `CREATE TABLE coc_settings(
    name TEXT PRIMARY KEY,
    value_json TEXT NOT NULL CHECK(json_valid(value_json)),
    updated_at TEXT NOT NULL
  )`,
];

const COC_TABLES = Object.freeze(
  COC_SQL.map((sql) => sql.match(/^CREATE TABLE (coc_\w+)/)?.[1]).filter(Boolean),
);

module.exports = { COC_SQL, COC_TABLES };
