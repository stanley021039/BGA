const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'),
  path = require('node:path');
const {
  builtinCharacters,
  retiredCharacters,
  defaults,
  validateAppearance,
  canonicalCharacterId,
  retiredCharacterAsset,
} = require('../src/profiles/appearance');
const { getProfileSettings } = require('../src/profiles/settings');
const { appFixture } = require('./helpers/app-fixture.cjs');
const { createAuth } = require('../src/auth');

test('retired characters disappear from the roster and legacy choices migrate without changing expressions', () => {
  for (const old of Object.keys(retiredCharacters)) {
    const id = 'builtin:' + old;
    assert.ok(!builtinCharacters.some((c) => c.id === id));
    for (const version of [4, 5]) {
      const input =
        version === 4 ? { version, skinId: id } : { version, characterId: id, expression: 'angry' };
      const result = validateAppearance(input);
      assert.equal(result.characterId, canonicalCharacterId(id));
      assert.equal(result.expression, version === 4 ? 'neutral' : 'angry');
      assert.ok(builtinCharacters.some((c) => c.id === result.characterId));
    }
    assert.equal(
      fs
        .readdirSync(path.join(__dirname, '../public/assets/characters'))
        .some((file) => file.startsWith(old + '-')),
      false,
    );
  }
  assert.equal(retiredCharacterAsset('/assets/characters/not-a-character-neutral.png'), null);
  assert.equal(retiredCharacterAsset('/assets/characters/traveler-../neutral.png'), null);
  assert.ok(builtinCharacters.some((c) => c.id === defaults.characterId));
});

test('saved old avatar and appearance both resolve to new art; old image routes serve correct WebP MIME', async (t) => {
  const old = {
    version: 5,
    characterId: 'builtin:traveler',
    expression: 'angry',
    avatar: { kind: 'character', characterId: 'builtin:woods', expression: 'happy' },
  };
  let settings;
  const f = await appFixture(t, {
    async seed(db) {
      const id = await createAuth(db).bootstrap('retirement_owner', 'retirement-password');
      db.prepare('UPDATE users SET appearance=? WHERE id=?').run(JSON.stringify(old), id);
      settings = getProfileSettings(db, id);
    },
  });
  assert.equal(settings.appearance.characterId, canonicalCharacterId('builtin:traveler'));
  assert.equal(settings.appearance.expression, 'angry');
  assert.equal(settings.avatar.characterId, canonicalCharacterId('builtin:woods'));
  assert.equal(settings.avatar.expression, 'happy');
  const login = await fetch(f.base + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'retirement_owner', password: 'retirement-password' }),
  });
  const headers = { Cookie: login.headers.get('set-cookie').split(';')[0] };
  const legacy = '/assets/characters/traveler-neutral.png';
  const mapped = retiredCharacterAsset(legacy);
  const [oldResponse, current] = await Promise.all([
    fetch(f.base + legacy, { headers }),
    fetch(f.base + mapped, { headers }),
  ]);
  assert.equal(oldResponse.status, 200);
  assert.equal(oldResponse.headers.get('content-type'), 'image/webp');
  assert.deepEqual(
    Buffer.from(await oldResponse.arrayBuffer()),
    Buffer.from(await current.arrayBuffer()),
  );
  assert.equal((await fetch(f.base + legacy)).status, 401);
});
