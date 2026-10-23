const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path'),
  os = require('node:os'),
  crypto = require('node:crypto');
const directory = path.join(__dirname, '../public/assets/game-sounds'),
  expected = {
    turn: 560,
    'dice-roll': 650,
    shot: 1360,
    slam: 600,
    nitro: 1300,
    skid: 660,
    'quacks-explosion': 1500,
    reveal: 560,
  };
test('the eight current deterministic cues match manifest digests, PCM lengths and bounded peaks with faded edges', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'manifest.json'), 'utf8'));
  assert.deepEqual(Object.keys(manifest.cues).sort(), Object.keys(expected).sort());
  for (const [cue, durationMs] of Object.entries(expected)) {
    const entry = manifest.cues[cue],
      data = fs.readFileSync(path.join(directory, entry.file));
    assert.equal(entry.file, cue === 'reveal' ? '../gift-sounds/open_001.wav' : cue + '.wav');
    assert.equal(entry.durationMs, durationMs);
    assert.equal(entry.sha256, crypto.createHash('sha256').update(data).digest('hex'));
    assert.equal(entry.bytes, data.length);
    assert.equal(data.toString('ascii', 0, 4), 'RIFF');
    assert.equal(data.readUInt32LE(4), data.length - 8);
    assert.equal(data.toString('ascii', 8, 16), 'WAVEfmt ');
    assert.equal(data.readUInt32LE(16), 16);
    assert.equal(data.readUInt16LE(20), 1);
    assert.equal(data.readUInt16LE(22), 1);
    assert.equal(data.readUInt32LE(24), 24000);
    assert.equal(data.readUInt16LE(34), 16);
    assert.equal(data.toString('ascii', 36, 40), 'data');
    assert.equal(data.readUInt32LE(40), durationMs * 48);
    assert.equal(data.length, 44 + durationMs * 48);
    let peak = 0;
    for (let i = 44; i < data.length; i += 2)
      peak = Math.max(peak, Math.abs(data.readInt16LE(i)) / 32768);
    assert.ok(peak > 0 && peak <= 0.75, cue + ' peak');
    assert.ok(Math.abs(data.readInt16LE(44)) <= 1);
    assert.ok(Math.abs(data.readInt16LE(data.length - 2)) <= 1);
    assert.ok(entry.source);
    assert.ok(entry.license);
    assert.ok(entry.author);
    assert.ok(entry.changes);
  }
});
test('game cue controllers and WAV routes are served exactly, unrelated files remain inaccessible', async () => {
  const { createApp } = require('../src/app'),
    temp = fs.mkdtempSync(path.join(os.tmpdir(), 'bga-game-cue-http-'));
  const app = createApp({
    port: 0,
    host: '127.0.0.1',
    dbFile: path.join(temp, 'db.sqlite'),
    historyDir: path.join(temp, 'history'),
    communityDir: path.join(temp, 'community'),
    musicDir: path.join(temp, 'music'),
    externalSideEffectsEnabled: false,
  });
  try {
    const { port } = await app.listen(),
      base = 'http://127.0.0.1:' + port;
    for (const file of [
      'shared/game-sounds.js',
      'shared/race-game-sounds.js',
      'assets/game-sounds/quacks-decline-user.wav',
      'assets/game-sounds/quacks-settlement-user.wav',
      ...Object.keys(expected).map((cue) =>
        cue === 'reveal' ? 'assets/gift-sounds/open_001.wav' : 'assets/game-sounds/' + cue + '.wav',
      ),
    ]) {
      const response = await fetch(base + '/' + file);
      assert.equal(response.status, 200, file);
      assert.match(
        response.headers.get('content-type'),
        file.endsWith('.wav') ? /audio\/mpeg/ : /javascript/,
      );
      assert.deepEqual(
        Buffer.from(await response.arrayBuffer()),
        fs.readFileSync(path.join(__dirname, '../public', file.replace(/\.wav$/, '.mp3'))),
      );
    }
    for (const file of [
      'assets/game-sounds/correct.wav',
      'assets/game-sounds/incorrect.wav',
      'assets/game-sounds/quacks-potion.wav',
      'assets/game-sounds/quacks-potion-synth.wav',
      'assets/game-sounds/quacks-ingredient.wav',
      'assets/game-sounds/quacks-stop-user.wav',
      'assets/game-sounds/quacks-draw.wav',
      'assets/game-sounds/missing.wav',
      'assets/game-sounds/manifest.json',
      'assets/game-sounds/sources/confirmation_001.wav',
    ])
      assert.equal((await fetch(base + '/' + file)).status, 404);
  } finally {
    await app.close();
    const resolved = path.resolve(temp);
    assert.ok(
      resolved.startsWith(path.resolve(os.tmpdir()) + path.sep) &&
        path.basename(resolved).startsWith('bga-game-cue-http-'),
    );
    fs.rmSync(resolved, { recursive: true, force: true, maxRetries: 5 });
  }
});

test('shot consists of two byte-identical bursts separated by exactly 120ms of silence', () => {
  const b = fs.readFileSync(path.join(directory, 'shot.wav')).subarray(44),
    single = 620 * 48,
    gap = 120 * 48;
  assert.equal(b.length, 2 * single + gap);
  assert.deepEqual(b.subarray(0, single), b.subarray(single + gap));
  assert.ok(b.subarray(single, single + gap).every((x) => x === 0));
});

test('reveal consists of two identical short hits with an 80ms silent gap', () => {
  const b = fs.readFileSync(path.join(directory, '../gift-sounds/open_001.wav')).subarray(44),
    single = 240 * 48,
    gap = 80 * 48;
  assert.equal(b.length, 2 * single + gap);
  assert.deepEqual(b.subarray(0, single), b.subarray(single + gap));
  assert.ok(b.subarray(single, single + gap).every((x) => x === 0));
});
