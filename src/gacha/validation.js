'use strict';
const { createHash } = require('node:crypto');
const { validAt } = require('./ownership');
const digest = (v) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
function validateGachaDatabase(db) {
  const flag = db.prepare("SELECT value FROM gacha_settings WHERE name='legacy_imported_at'").get();
  if (!flag || !validAt(flag.value)) throw Error('Missing gacha migration receipt');
  require('./odds').read(db);
  for (const row of db.prepare('SELECT * FROM gacha_wallets').iterate()) {
    if (!validAt(row.updated_at)) throw Error('Invalid gacha wallet time');
    const totals = db
      .prepare(
        'SELECT COALESCE(SUM(coins_delta),0) coins,COALESCE(SUM(fragments_delta),0) fragments FROM gacha_ledger WHERE user_id=?',
      )
      .get(row.user_id);
    if (totals.coins !== row.coins || totals.fragments !== row.fragments)
      throw Error('Gacha wallet disagrees with ledger');
  }
  for (const row of db.prepare('SELECT * FROM gacha_ownership').iterate())
    if (!validAt(row.acquired_at)) throw Error('Invalid gacha ownership time');
  for (const row of db.prepare('SELECT * FROM gacha_ledger').iterate()) {
    if (!validAt(row.created_at) || !/^[0-9a-f]{64}$/.test(row.fingerprint))
      throw Error('Invalid gacha ledger');
    if (!db.prepare('SELECT 1 FROM gacha_wallets WHERE user_id=?').get(row.user_id))
      throw Error('Gacha ledger has no wallet');
  }
  for (const row of db.prepare('SELECT * FROM gacha_requests').iterate()) {
    const response = JSON.parse(row.response_json);
    if (
      response.requestId !== row.request_id ||
      !validAt(row.created_at) ||
      response.at !== row.created_at
    )
      throw Error('Invalid gacha operation receipt');
    const payload =
      row.operation === 'draw'
        ? {
            operation: 'draw',
            pool: response.pool,
            count: response.results?.length,
            ...(response.voucher === true ? { voucher: true } : {}),
            ...(response.thirdLogin === true ? { thirdLogin: true } : {}),
          }
        : { operation: 'exchange', key: response.item?.key };
    if (digest(payload) !== row.fingerprint) throw Error('Invalid gacha receipt fingerprint');
    const ledger = db
      .prepare('SELECT * FROM gacha_ledger WHERE event_id=?')
      .get('request:' + row.user_id + ':' + row.request_id);
    if (
      !ledger ||
      ledger.fingerprint !== row.fingerprint ||
      ledger.reason !== row.operation ||
      ledger.coins_delta !== (row.operation === 'draw' ? -response.cost : 0) ||
      ledger.fragments_delta !==
        (row.operation === 'draw' ? response.fragmentsGained : -response.cost)
    )
      throw Error('Gacha receipt disagrees with ledger');
    if (response.thirdLogin !== undefined) {
      const claim = 'third-login-epic-ten-claim:' + row.user_id;
      const use = 'third-login-epic-ten:' + row.user_id;
      const events = db
        .prepare(
          "SELECT event_id,fingerprint FROM gacha_ledger WHERE user_id=? AND reason='login' AND event_id IN (?,?)",
        )
        .all(row.user_id, claim, use);
      if (
        response.thirdLogin !== true ||
        response.voucher !== undefined ||
        row.operation !== 'draw' ||
        response.pool !== 'all' ||
        response.cost !== 0 ||
        response.results?.length !== 10 ||
        response.results[9]?.rarity !== 'epic' ||
        events.length !== 2 ||
        !events.some(
          (event) => event.event_id === claim && event.fingerprint === digest({ event: claim }),
        ) ||
        !events.some(
          (event) =>
            event.event_id === use && event.fingerprint === digest({ requestId: row.request_id }),
        )
      )
        throw Error('Invalid epic ten-draw voucher receipt');
    }
    if (response.voucher !== undefined) {
      const events = db
        .prepare(
          "SELECT event_id,fingerprint FROM gacha_ledger WHERE user_id=? AND reason='login' AND event_id IN (?,?)",
        )
        .all(
          row.user_id,
          'checkin-legendary-claim:' + row.user_id,
          'checkin-legendary-use:' + row.user_id,
        );
      if (
        response.voucher !== true ||
        row.operation !== 'draw' ||
        response.cost !== 0 ||
        response.results?.length !== 1 ||
        response.results[0]?.rarity !== 'legendary' ||
        events.length !== 2 ||
        !events.some(
          (event) =>
            event.event_id === 'checkin-legendary-use:' + row.user_id &&
            event.fingerprint === digest({ requestId: row.request_id }),
        )
      )
        throw Error('Invalid gacha check-in voucher receipt');
    }
  }
}
module.exports = { validateGachaDatabase };
