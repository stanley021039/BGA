'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { openDatabase } = require('../../src/db');
const { createApp } = require('../../src/app');

// Own only this newly allocated directory. Do not change process.env, cwd,
// global clocks or caller assertions. Domain data and HTTP helpers stay in tests.
async function appFixture(t, { config = {}, seed, appFactory = createApp } = {}) {
  const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'bga-app-fixture-'));
  const paths = Object.freeze({
    dbFile: path.join(root, 'app.sqlite'),
    historyDir: path.join(root, 'history'),
    communityDir: path.join(root, 'community'),
    musicDir: path.join(root, 'music'),
  });
  let app;
  let disposal;
  function dispose() {
    // One close/removal even if setup fails and node:test subsequently runs after.
    return disposal ||= (async () => {
      await app?.close();
      // A failed close is reported and retains data rather than deleting an open DB.
      fs.rmSync(root, { recursive: true, force: true, maxRetries: 5 });
    })();
  }
  try {
    // Register before config, database seeding, factory or listen can fail.
    t.after(dispose);
    const options = {
      ...(typeof config === 'function' ? config(paths) : config),
      ...paths,
      host: '127.0.0.1', port: 0,
      externalSideEffectsEnabled: false,
      githubClient: { configured: false },
    };
    if (seed) {
      const db = openDatabase(paths.dbFile);
      try { await seed(db); } finally { db.close(); }
    }
    app = appFactory(options);
    const { port } = await app.listen();
    return { root, config: options, app, base: `http://127.0.0.1:${port}`, dispose };
  } catch (error) {
    try { await dispose(); } catch (cleanupError) {
      throw new AggregateError([error, cleanupError], 'App fixture setup and cleanup failed');
    }
    throw error;
  }
}
module.exports = { appFixture };
