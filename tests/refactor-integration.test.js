'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { appFixture } = require('./helpers/app-fixture.cjs');
const { createAuth } = require('../src/auth');

test('integrated app serves the draw controller boundary its page shell loads', async (t) => {
  const { base } = await appFixture(t, {
    seed: (db) => createAuth(db).bootstrap('integration_owner', 'test-password-123'),
  });
  const login = await fetch(base + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'integration_owner', password: 'test-password-123' }),
  });
  assert.equal(login.status, 200);
  await login.text();
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const route = '/shared/draw-controller.js',
    response = await fetch(base + route);
  assert.equal(response.status, 200, route);
  assert.match(response.headers.get('content-type'), /^text\/javascript/);
  assert.equal(
    await response.text(),
    fs.readFileSync(path.join(__dirname, '../public', route), 'utf8'),
  );
  // The draw page shell loads its controller; pages come from the Vue build (#233).
  const shell = fs.readFileSync(path.join(__dirname, '../frontend/pages/draw/index.html'), 'utf8');
  assert.ok(shell.includes('src="' + route + '"'), 'draw loads its controller');
  assert.equal((await fetch(base + '/draw/ABCDEF', { headers: { Cookie: cookie } })).status, 503);
  const version = await fetch(base + '/api/version');
  assert.equal(version.status, 200);
  assert.deepEqual(await version.json(), { version: require('../package.json').version });
});
