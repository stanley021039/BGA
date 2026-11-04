'use strict';

// Isolated local preview of the formal multiplayer candidate (#306 / #313).
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const { createApp } = require('../src/app');
const { openDatabase } = require('../src/db');
const { createAuth } = require('../src/auth');
const { unlockPlaytestRewards } = require('./playtest-rewards.cjs');

async function main() {
  const dir = path.resolve(__dirname, '../work', `multiplayer-preview-${Date.now()}`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, '.bga-playtest.json'),
    JSON.stringify({ purpose: 'isolated-playtest' }),
  );
  const dbFile = path.join(dir, 'app.sqlite');
  const password = randomBytes(18).toString('base64url');
  const db = openDatabase(dbFile);
  try {
    await createAuth(db).bootstrap('arenaadmin', password);
  } finally {
    db.close();
  }
  const app = createApp({
    host: '127.0.0.1',
    port: 51334,
    dbFile,
    communityDir: path.join(dir, 'community'),
    musicDir: path.join(dir, 'music'),
    frontendEnabled: true,
    externalSideEffectsEnabled: false,
    achievementPurpose: 'test',
    marketAutomationEnabled: false,
  });
  try {
    await app.listen();
    const base = 'http://127.0.0.1:51334';
    async function post(route, body, cookie) {
      const response = await fetch(`${base}/api/${route}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw Error(`Preview setup failed: ${route} (${response.status})`);
      return {
        data: await response.json(),
        cookie: response.headers.get('set-cookie')?.split(';')[0],
      };
    }
    const admin = await post('auth/login', { username: 'arenaadmin', password });
    const invite = await post('admin/invites', { days: 1 }, admin.cookie);
    await post('auth/register', {
      username: 'arenaguest',
      password,
      confirmPassword: password,
      invite: invite.data.code,
    });
    unlockPlaytestRewards(dbFile);
    console.log(`本次多人整合版：${base}`);
    console.log('兩個獨立瀏覽器／無痕視窗分別登入 arenaadmin 與 arenaguest。');
    console.log(`本次隨機測試密碼：${password}`);
    console.log(`隔離資料：${dir}`);
    for (const signal of ['SIGINT', 'SIGTERM']) {
      process.once(signal, async () => {
        await app.close();
        process.exit(0);
      });
    }
  } catch (error) {
    await app.close();
    throw error;
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
