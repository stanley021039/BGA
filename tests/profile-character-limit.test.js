const { test } = require('node:test'),
  assert = require('node:assert/strict');
const fs = require('node:fs'),
  os = require('node:os'),
  path = require('node:path');
const { openDatabase } = require('../src/db'),
  { createAuth } = require('../src/auth');
const { createCharacter } = require('../src/profiles/uploads');

test('each account can upload twenty characters and the twenty-first is rejected', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bga-character-limit-')),
    db = openDatabase(path.join(root, 'app.sqlite'));
  try {
    await createAuth(db).bootstrap('characteradmin', 'test-password-123');
    const owner = db.prepare('SELECT id FROM users WHERE username=?').get('characteradmin').id;
    const image = {
      base64: fs
        .readFileSync(path.join(__dirname, '../public/assets/characters/traveler-neutral.png'))
        .toString('base64'),
    };
    for (let i = 1; i <= 20; i++) createCharacter(db, owner, { name: '角色' + i, ...image });
    assert.throws(
      () => createCharacter(db, owner, { name: '第二十一位', ...image }),
      (error) => error.code === 'CHARACTER_LIMIT' && /20/.test(error.message),
    );
    assert.equal(
      db.prepare('SELECT COUNT(*) AS n FROM player_characters WHERE owner_id=?').get(owner).n,
      20,
    );
  } finally {
    db.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});
