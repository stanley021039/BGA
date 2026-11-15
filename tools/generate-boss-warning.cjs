// Original synthesized two-cycle siren, no recordings or third-party samples.
const fs = require('node:fs');
const path = require('node:path');
const rate = 24000,
  seconds = 2.2,
  samples = Math.round(rate * seconds);
const wav = Buffer.alloc(44 + samples * 2);
wav.write('RIFF');
wav.writeUInt32LE(wav.length - 8, 4);
wav.write('WAVEfmt ', 8);
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(rate, 24);
wav.writeUInt32LE(rate * 2, 28);
wav.writeUInt16LE(2, 32);
wav.writeUInt16LE(16, 34);
wav.write('data', 36);
wav.writeUInt32LE(samples * 2, 40);
let phase = 0;
for (let i = 0; i < samples; i++) {
  const t = i / rate;
  const frequency = 620 + (330 * (1 - Math.cos((2 * Math.PI * t) / 1.1))) / 2;
  phase += (2 * Math.PI * frequency) / rate;
  const fade = Math.min(1, t / 0.04, (seconds - t) / 0.12);
  const sample = (Math.sin(phase) + 0.18 * Math.sin(phase * 2)) * 0.36 * Math.max(0, fade);
  wav.writeInt16LE(Math.round(sample * 32767), 44 + i * 2);
}
const directory = path.resolve(__dirname, '../public/assets/game-sounds');
fs.writeFileSync(path.join(directory, 'boss-warning.wav'), wav);
if (process.argv[2]) {
  const { spawnSync } = require('node:child_process');
  const crypto = require('node:crypto');
  const result = spawnSync(process.argv[2], [
    '-v',
    'error',
    '-y',
    '-i',
    path.join(directory, 'boss-warning.wav'),
    '-c:a',
    'libmp3lame',
    '-b:a',
    '96k',
    '-ac',
    '1',
    '-map_metadata',
    '-1',
    path.join(directory, 'boss-warning.mp3'),
  ]);
  if (result.status !== 0) throw Error(String(result.stderr || result.error));
  const mp3 = fs.readFileSync(path.join(directory, 'boss-warning.mp3'));
  const file = path.join(directory, 'compressed-manifest.json');
  const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
  manifest.sounds = manifest.sounds.filter((item) => item.source !== 'boss-warning.wav');
  manifest.sounds.push({
    directory: 'game-sounds',
    source: 'boss-warning.wav',
    file: 'boss-warning.mp3',
    sourceSha256: crypto.createHash('sha256').update(wav).digest('hex'),
    sha256: crypto.createHash('sha256').update(mp3).digest('hex'),
    sourceBytes: wav.length,
    bytes: mp3.length,
  });
  fs.writeFileSync(file, JSON.stringify(manifest, null, 2) + '\n');
}
