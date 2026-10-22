'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  os = require('node:os'),
  path = require('node:path');
const { MediaAudio, encodeMp3 } = require('../src/media/audio');
const { contentHash } = require('../src/media/thumbnails');
const { appFixture } = require('./helpers/app-fixture.cjs');

function directory(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bga-media-audio-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}
// A valid 24 kHz mono 16-bit WAV, as the expression-sound recorder produces.
function wav(seconds = 1, frequency = 440) {
  const samples = 24000 * seconds,
    bytes = Buffer.alloc(44 + samples * 2);
  bytes.write('RIFF', 0);
  bytes.writeUInt32LE(bytes.length - 8, 4);
  bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(24000, 24);
  bytes.writeUInt32LE(48000, 28);
  bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36);
  bytes.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++)
    bytes.writeInt16LE(
      Math.round(Math.sin((i / 24000) * frequency * 2 * Math.PI) * 12000),
      44 + i * 2,
    );
  return bytes;
}

test('sounds are converted once per content and shared by identical uploads', async (t) => {
  const root = directory(t),
    calls = [],
    audio = new MediaAudio({
      directory: root,
      encode: async (bytes) => {
        calls.push(bytes.length);
        return Buffer.from('ID3-fake-mp3');
      },
    }),
    sound = wav();
  assert.equal(await audio.variant(sound), null);
  await audio.prepare(sound);
  assert.deepEqual((await audio.variant(Buffer.from(sound))).bytes, Buffer.from('ID3-fake-mp3'));
  await audio.prepare(Buffer.from(sound));
  assert.equal(calls.length, 1);
  assert.deepEqual(fs.readdirSync(root), [`${contentHash(sound)}-mp3-v1.mp3`]);

  // A later backfill without that sound removes its copy.
  const past = new Date(Date.now() - 60000);
  fs.utimesSync(path.join(root, fs.readdirSync(root)[0]), past, past);
  await new MediaAudio({ directory: root, encode: async () => Buffer.alloc(1) }).backfill([]);
  assert.deepEqual(fs.readdirSync(root), []);
});

test('a larger or failed conversion keeps the WAV, and a missing ffmpeg records nothing', async (t) => {
  const root = directory(t),
    sound = wav();
  const larger = new MediaAudio({
    directory: root,
    encode: async (bytes) => Buffer.concat([bytes, bytes]),
  });
  await larger.prepare(sound);
  assert.deepEqual(await larger.variant(sound), { same: true });

  const other = wav(1, 660),
    missing = new MediaAudio({
      directory: root,
      encode: async () => {
        throw Object.assign(Error('spawn ffmpeg ENOENT'), { code: 'ENOENT' });
      },
    });
  await missing.prepare(other);
  assert.deepEqual(await missing.variant(other), { same: true });
  assert.ok(!fs.readdirSync(root).some((name) => name.startsWith(contentHash(other))));
});

test('ffmpeg produces a smaller mono MP3 when it is installed', async (t) => {
  const sound = wav(2);
  let mp3;
  try {
    mp3 = await encodeMp3(process.env.FFMPEG_PATH || 'ffmpeg', sound);
  } catch (error) {
    if (error.code === 'ENOENT') return t.skip('ffmpeg is not installed');
    throw error;
  }
  assert.ok(mp3.length < sound.length / 3);
  // MPEG audio frame sync, optionally after an ID3 tag.
  const start =
    mp3.subarray(0, 3).toString('latin1') === 'ID3'
      ? 10 + ((mp3[6] << 21) | (mp3[7] << 14) | (mp3[8] << 7) | mp3[9])
      : 0;
  assert.equal(mp3[start], 0xff);
  assert.equal(mp3[start + 1] & 0xe0, 0xe0);
});

test('converted built-in art is served as WebP under both the new and the old PNG URLs', async (t) => {
  const { base } = await appFixture(t);
  for (const name of [
    'quacks/explosion-reference-v1',
    'bluff-reaction-photo',
    'quacks/draw-portrait-v1',
    'quacks/stop-portrait-v1',
    'quacks/draw-777',
    'thunder-box',
  ]) {
    assert.ok(!fs.existsSync(path.join(__dirname, '../public/assets', name + '.png')), name);
    const webp = fs.readFileSync(path.join(__dirname, '../public/assets', name + '.webp'));
    assert.ok(webp.length < 160 * 1024, name);
    for (const suffix of ['.webp', '.png']) {
      const response = await fetch(`${base}/assets/${name}${suffix}`);
      assert.equal(response.status, 200, name + suffix);
      assert.equal(response.headers.get('content-type'), 'image/webp');
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), webp);
    }
  }
});
