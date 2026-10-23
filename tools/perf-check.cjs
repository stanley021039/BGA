/* Resource budgets are policy, not a baseline that can grow automatically. */
'use strict';
const fs = require('node:fs'),
  path = require('node:path'),
  crypto = require('node:crypto');
const { gzipSync } = require('node:zlib');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const hash = (b) => crypto.createHash('sha256').update(b).digest('hex');
function files(directory) {
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory() ? files(path.join(directory, e.name)) : [path.join(directory, e.name)],
    );
}
function check(base = root, { build = false } = {}) {
  const errors = [],
    soundsDir = path.join(base, 'public/assets/game-sounds');
  const fail = (s) => errors.push(s);
  const read = (name) => fs.readFileSync(path.join(base, name));
  const manifest = JSON.parse(read('public/assets/game-sounds/compressed-manifest.json'));
  if (manifest.schema !== 1 || !Array.isArray(manifest.sounds))
    throw Error('Invalid audio compression manifest');
  const sources = new Set(),
    outputs = new Set();
  for (const e of manifest.sounds) {
    if (
      !['game-sounds', 'gift-sounds'].includes(e.directory) ||
      !/^[a-z0-9_-]+\.wav$/.test(e.source) ||
      !/^[a-z0-9_-]+\.mp3$/.test(e.file) ||
      sources.has(e.directory + '/' + e.source) ||
      outputs.has(e.directory + '/' + e.file)
    ) {
      fail('Invalid or duplicate compressed sound entry');
      continue;
    }
    sources.add(e.directory + '/' + e.source);
    outputs.add(e.directory + '/' + e.file);
    const a = fs.readFileSync(path.join(base, 'public/assets', e.directory, e.source)),
      b = fs.readFileSync(path.join(base, 'public/assets', e.directory, e.file));
    if (
      e.sourceSha256 !== hash(a) ||
      e.sha256 !== hash(b) ||
      e.sourceBytes !== a.length ||
      e.bytes !== b.length
    )
      fail('Audio hash/size mismatch: ' + e.source);
    if (
      b.length >= a.length ||
      !(b.subarray(0, 3).toString() === 'ID3' || (b[0] === 255 && (b[1] & 224) === 224))
    )
      fail('Missing smaller MP3: ' + e.source);
  }
  let total = 0,
    deliveredSounds = 0;
  for (const absolute of files(path.join(base, 'public/assets'))) {
    const file = path
      .relative(path.join(base, 'public/assets'), absolute)
      .split(path.sep)
      .join('/');
    if (file.split('/').includes('sources')) continue;
    if (/\.(wav|flac|aiff?|pcm)$/i.test(file) && !sources.has(file))
      fail('Uncompressed delivery sound: ' + file);
    if (/\.(png|jpe?g|webp|gif|svg)$/i.test(file) && fs.statSync(absolute).size > 256 * 1024)
      fail('Static image exceeds 256 KiB: ' + file);
    if (/\.mp3$/i.test(file)) {
      const bytes = fs.readFileSync(absolute);
      if (!(
        bytes.subarray(0, 3).toString() === 'ID3' ||
        (bytes[0] === 255 && (bytes[1] & 224) === 224)
      ))
        fail('Invalid compressed audio: ' + file);
      const size = fs.statSync(absolute).size;
      total += size;
      deliveredSounds++;
      if (size > 384 * 1024) fail('Sound exceeds 384 KiB: ' + file);
    }
  }
  if (total > 2 * 1024 * 1024) fail('Combined sounds exceed 2 MiB');
  for (const file of ['login-864.webp', 'home-family.jpg', 'soul-world.webp'])
    if (fs.statSync(path.join(base, 'public/assets/auth', file)).size > 256 * 1024)
      fail('Opening image exceeds 256 KiB: ' + file);
  for (const [name, key] of [
    ['entrance-stitch', 'html'],
    ['lobby-background-live', 'svg'],
  ]) {
    const bytes = read('public/shared/' + name + '.json');
    if (gzipSync(bytes).length > 48 * 1024) fail('Imported effects exceed 48 KiB gzip: ' + name);
    for (const effect of JSON.parse(bytes)) {
      const markup = effect[key];
      const resources =
        typeof markup === 'string'
          ? markup.replace(
              /\sxmlns(?::[a-z]+)?=["']http:\/\/www\.w3\.org\/(?:2000\/svg|1999\/xlink)["']/g,
              '',
            )
          : '';
      if (
        typeof markup !== 'string' ||
        /(?:https?:|data:|<\s*(?:img|video|audio|iframe|script|foreignObject)\b)/i.test(resources)
      )
        fail('External/embedded media in ' + name + ': ' + effect.id);
      if (
        gzipSync(markup || '').length > 24 * 1024 ||
        (markup?.match(/<[a-z]/gi) || []).length > 512
      )
        fail('Effect exceeds markup budget: ' + effect.id);
    }
  }
  if (build) {
    const dir = path.join(base, 'frontend/dist/frontend-assets');
    if (!fs.existsSync(dir)) throw Error('Build frontend before perf:check --build');
    for (const file of files(dir)) {
      const limit = file.endsWith('.js') ? 256 * 1024 : file.endsWith('.css') ? 128 * 1024 : 0;
      if (limit && gzipSync(fs.readFileSync(file)).length > limit)
        fail('Built asset exceeds gzip budget: ' + path.basename(file));
    }
  }
  return {
    errors,
    sounds: deliveredSounds,
    bytes: total,
    sources: sources.size,
  };
}
async function runtime() {
  const executable = process.env.FFMPEG_PATH || 'ffmpeg';
  const probe = spawnSync(executable, ['-version'], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 10000,
  });
  if (probe.error || probe.status !== 0)
    throw Error('ffmpeg must be executable on the release host');
  const pcm = Buffer.alloc(48044);
  pcm.write('RIFF');
  pcm.writeUInt32LE(48036, 4);
  pcm.write('WAVEfmt ', 8);
  pcm.writeUInt32LE(16, 16);
  pcm.writeUInt16LE(1, 20);
  pcm.writeUInt16LE(1, 22);
  pcm.writeUInt32LE(24000, 24);
  pcm.writeUInt32LE(48000, 28);
  pcm.writeUInt16LE(2, 32);
  pcm.writeUInt16LE(16, 34);
  pcm.write('data', 36);
  pcm.writeUInt32LE(48000, 40);
  const mp3 = await require('../src/media/audio').encodeMp3(executable, pcm);
  if (mp3.length >= pcm.length || mp3.length < 100)
    throw Error('Runtime MP3 encoding failed compression check');
  return { encoder: probe.stdout.split('\n')[0], inputBytes: pcm.length, outputBytes: mp3.length };
}
if (require.main === module)
  (async () => {
    if (process.argv.slice(2).some((a) => !['--build', '--runtime'].includes(a)))
      throw Error('Usage: perf-check.cjs [--build] [--runtime]');
    const result = check(root, { build: process.argv.includes('--build') });
    if (result.errors.length) throw Error(result.errors.join('\n'));
    if (process.argv.includes('--runtime')) result.runtime = await runtime();
    console.log(JSON.stringify({ performanceBudgets: 'passed', ...result }));
  })().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
module.exports = { check, runtime };
