#!/usr/bin/env node
'use strict';

// Rebuild the seven short game cues without network access or audio playback.
// Kenney masters were decoded once from the official CC0 Vorbis files; the
// checked-in PCM masters make rebuilds independent of a particular decoder.
// The five action cues contain no third-party recordings or samples.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'public', 'assets', 'game-sounds');
const sampleRate = 24000;
const checkedAt = '2026-10-06';
const archiveSha256 = 'f2193d072726d6758a5f7871b2dcc54dcce0d5c35c6f0a62f92549b327c81232';
const sourceUrl = 'https://kenney.nl/assets/interface-sounds';
const archiveUrl = 'https://kenney.nl/media/pages/assets/interface-sounds/fa43c1dd4d-1677589452/kenney_interface-sounds.zip';
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
const hashText = data => hash(Buffer.from(data.toString('utf8').replace(/\r\n/g, '\n')));
const round = value => Number(value.toFixed(8));
const tau = 2 * Math.PI;

function readMaster(name, expectedSha256) {
  const file = 'sources/kenney-' + name + '.wav';
  const bytes = fs.readFileSync(path.join(output, file));
  if (hash(bytes) !== expectedSha256) throw Error('Master hash mismatch: ' + file);
  if (bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.readUInt32LE(4) !== bytes.length - 8 ||
      bytes.toString('ascii', 8, 12) !== 'WAVE' || bytes.toString('ascii', 12, 16) !== 'fmt ' ||
      bytes.readUInt32LE(16) !== 16 || bytes.readUInt16LE(20) !== 1 ||
      bytes.readUInt16LE(22) !== 1 || bytes.readUInt32LE(24) !== 44100 ||
      bytes.readUInt16LE(34) !== 16 || bytes.toString('ascii', 36, 40) !== 'data' ||
      bytes.readUInt32LE(40) !== bytes.length - 44) throw Error('Invalid PCM master: ' + file);
  const samples = Float64Array.from({length: (bytes.length - 44) / 2}, (_, i) => bytes.readInt16LE(44 + i * 2) / 32768);
  return {file, sha256: expectedSha256, samples, sampleRate: 44100};
}

function seededNoise(seed) {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x100000000 * 2 - 1;
  };
}

function samplesFor(ms) { return new Float64Array(sampleRate * ms / 1000); }

function antiAlias(input, sourceRate) {
  const taps = 63, middle = (taps - 1) / 2, cutoff = 8000 / sourceRate;
  const kernel = new Float64Array(taps);
  let total = 0;
  for (let i = 0; i < taps; i++) {
    const offset = i - middle;
    const sinc = offset === 0 ? 2 * cutoff : Math.sin(tau * cutoff * offset) / (Math.PI * offset);
    kernel[i] = sinc * (0.54 - 0.46 * Math.cos(tau * i / (taps - 1)));
    total += kernel[i];
  }
  const filtered = new Float64Array(input.length);
  for (let frame = 0; frame < input.length; frame++) {
    for (let tap = 0; tap < taps; tap++) {
      const position = frame + tap - middle;
      if (position >= 0 && position < input.length) filtered[frame] += input[position] * kernel[tap] / total;
    }
  }
  return filtered;
}

function resample(master, ms, fitEntireMaster) {
  const samples = samplesFor(ms);
  const filtered = antiAlias(master.samples, master.sampleRate);
  const step = fitEntireMaster ? (filtered.length - 1) / (samples.length - 1) : master.sampleRate / sampleRate;
  for (let i = 0; i < samples.length; i++) {
    const position = Math.min(filtered.length - 1, i * step);
    const left = Math.floor(position), fraction = position - left;
    samples[i] = filtered[left] * (1 - fraction) + filtered[Math.min(left + 1, filtered.length - 1)] * fraction;
  }
  return samples;
}

function dice(ms, seed) {
  const samples = samplesFor(ms), noise = seededNoise(seed);
  const taps = [0.012, 0.064, 0.127, 0.201, 0.288, 0.388, 0.499, 0.59];
  let low = 0;
  for (let i = 0; i < samples.length; i++) {
    const time = i / sampleRate;
    low += 0.23 * (noise() - low);
    for (let tap = 0; tap < taps.length; tap++) {
      const age = time - taps[tap];
      if (age < 0 || age > 0.06) continue;
      const softAttack = Math.min(1, age / 0.002);
      const tone = Math.sin(tau * (490 + tap * 31) * age) + 0.35 * Math.sin(tau * (850 + tap * 23) * age);
      samples[i] += softAttack * (0.56 * low * Math.exp(-age / 0.012) + 0.23 * tone * Math.exp(-age / 0.01)) * (1 - tap * 0.055);
    }
  }
  return samples;
}

function shot(ms, seed) {
  const samples = samplesFor(ms), noise = seededNoise(seed);
  let low = 0, phase = 0;
  for (let i = 0; i < samples.length; i++) {
    const time = i / sampleRate;
    low += 0.18 * (noise() - low);
    phase += tau * (360 * Math.exp(-time / 0.095) + 105) / sampleRate;
    samples[i] = 0.65 * low * Math.exp(-time / 0.042) + 0.32 * Math.sin(phase) * Math.exp(-time / 0.075);
  }
  return samples;
}

function slam(ms, seed) {
  const samples = samplesFor(ms), noise = seededNoise(seed);
  let low = 0;
  for (let i = 0; i < samples.length; i++) {
    const time = i / sampleRate;
    low += 0.085 * (noise() - low);
    const thud = Math.sin(tau * 112 * time) + 0.42 * Math.sin(tau * 183 * time);
    const metal = Math.sin(tau * 530 * time) + 0.22 * Math.sin(tau * 907 * time);
    samples[i] = 0.45 * thud * Math.exp(-time / 0.061) + 0.48 * low * Math.exp(-time / 0.042) + 0.1 * metal * Math.exp(-time / 0.085);
  }
  return samples;
}

function nitro(ms, seed) {
  const samples = samplesFor(ms), noise = seededNoise(seed);
  const duration = ms / 1000;
  let low = 0, phase = 0;
  for (let i = 0; i < samples.length; i++) {
    const time = i / sampleRate, progress = time / duration;
    low += (0.08 + progress * 0.14) * (noise() - low);
    phase += tau * (105 + 390 * progress) / sampleRate;
    const envelope = Math.sin(Math.PI * progress) ** 1.3;
    samples[i] = envelope * (0.72 * low + 0.17 * Math.sin(phase) + 0.07 * Math.sin(phase * 2));
  }
  return samples;
}

function skid(ms, seed) {
  const samples = samplesFor(ms), noise = seededNoise(seed);
  const duration = ms / 1000;
  let low = 0, lower = 0, phase = 0;
  for (let i = 0; i < samples.length; i++) {
    const time = i / sampleRate, progress = time / duration;
    const white = noise();
    low += 0.38 * (white - low);
    lower += 0.08 * (white - lower);
    phase += tau * (980 - 480 * progress) / sampleRate;
    const envelope = Math.sin(Math.PI * progress) ** 0.9;
    const friction = (low - lower) * (0.76 + 0.24 * Math.sin(tau * 27 * time));
    samples[i] = envelope * (0.76 * friction + 0.13 * Math.sin(phase));
  }
  return samples;
}

function finish(samples, targetPeak) {
  // Remove DC and ramp both boundaries to exactly zero before peak limiting.
  let mean = 0;
  for (const sample of samples) mean += sample / samples.length;
  const fadeIn = sampleRate * 5 / 1000, fadeOut = sampleRate * 24 / 1000;
  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    const envelope = Math.min(1, i / fadeIn) * Math.min(1, (samples.length - 1 - i) / fadeOut);
    samples[i] = (samples[i] - mean) * envelope;
    if (!Number.isFinite(samples[i])) throw Error('Non-finite sample');
    peak = Math.max(peak, Math.abs(samples[i]));
  }
  if (!peak) throw Error('Silent cue');
  // Floor the final positive peak to keep all cues <= 0.24 after PCM rounding.
  const pcm = new Int16Array(samples.length);
  const scale = Math.floor(targetPeak * 32767) / peak;
  for (let i = 0; i < samples.length; i++) pcm[i] = Math.round(samples[i] * scale);
  pcm[0] = pcm[pcm.length - 1] = 0;
  return pcm;
}

function wav(pcm) {
  const bytes = Buffer.alloc(44 + pcm.length * 2);
  bytes.write('RIFF', 0); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write('WAVE', 8);
  bytes.write('fmt ', 12); bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(1, 22); bytes.writeUInt32LE(sampleRate, 24);
  bytes.writeUInt32LE(sampleRate * 2, 28); bytes.writeUInt16LE(2, 32); bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36); bytes.writeUInt32LE(pcm.length * 2, 40);
  for (let i = 0; i < pcm.length; i++) bytes.writeInt16LE(pcm[i], 44 + i * 2);
  return bytes;
}

function waveformStats(pcm) {
  let peak = 0, energy = 0, sum = 0, maximumStep = 0, clippedSamples = 0;
  for (let i = 0; i < pcm.length; i++) {
    const sample = pcm[i] / 32768;
    peak = Math.max(peak, Math.abs(sample)); energy += sample * sample; sum += sample;
    if (Math.abs(pcm[i]) >= 32767) clippedSamples++;
    if (i) maximumStep = Math.max(maximumStep, Math.abs(pcm[i] - pcm[i - 1]) / 32768);
  }
  return {peak: round(peak), rms: round(Math.sqrt(energy / pcm.length)), mean: round(sum / pcm.length),
    maximumStep: round(maximumStep), firstSample: pcm[0], lastSample: pcm[pcm.length - 1], clippedSamples};
}

const turnMaster = readMaster('confirmation_003', '60903f8e64428b742ffba12df9142ae3d391a4b428aa4deefd7fa15db013c3f8');
const correctMaster = readMaster('confirmation_001', '40fedc78efd80dceb2e747bb3f98bf881e271844b914e382b349f93d89d9d067');
const licenseFile = 'sources/KENNEY-INTERFACE-LICENSE.txt';
const licenseTextSha256 = hashText(fs.readFileSync(path.join(output, licenseFile)));
const generatorSha256 = hashText(fs.readFileSync(__filename));
const kenneyLicense = {id: 'CC0-1.0', url: 'https://creativecommons.org/publicdomain/zero/1.0/',
  file: licenseFile, textSha256: licenseTextSha256, hashNormalization: 'UTF-8 LF', attributionRequired: false, redistributionAllowed: true};
const originalLicense = {id: 'Project-original', url: null, attributionRequired: false, redistributionAllowed: true,
  note: 'Original synthesized project assets, distributed with the project. No third-party samples; not attributed to Kenney and not declared CC0.'};
const commonChanges = ['Remove DC offset', '5ms linear fade-in and 24ms linear fade-out', 'Conservative peak scaling', 'Mono PCM16 WAV at 24000Hz'];
function kenneySource(name, originalSha256, master) {
  return {type: 'licensed-asset', url: sourceUrl, package: 'Interface Sounds 1.0', archiveUrl, archiveSha256,
    originalFile: 'Audio/' + name + '.ogg', originalSha256, decodedFile: master.file, decodedSha256: master.sha256,
    decodedBy: 'python-soundfile 0.14.0 / libsndfile 1.2.2, PCM16', checkedAt};
}
function originalSource(seed, synthesis) {
  return {type: 'original-synthesis', generator: 'scripts/build-game-sounds.cjs', generatorSha256,
    generatorHashNormalization: 'UTF-8 LF',
    algorithm: 'xorshift32 seeded noise plus sine oscillators and envelopes', seed, synthesis, createdAt: checkedAt};
}
const definitions = [
  {id: 'turn', ms: 320, samples: resample(turnMaster, 320, false), peak: 0.24, author: 'Kenney', license: kenneyLicense,
    source: kenneySource('confirmation_003', '3091bf0be0497f825769ee0733ca7bdc3bcd59bd6c6e8f2ba8f93d580ff38022', turnMaster),
    changes: ['Trim 322.018ms source to 320ms', '63-tap Hamming-windowed sinc 8kHz low-pass before resampling', 'Linear interpolation from 44100Hz to 24000Hz']},
  {id: 'correct', ms: 220, samples: resample(correctMaster, 220, true), peak: 0.24, author: 'Kenney', license: kenneyLicense,
    source: kenneySource('confirmation_001', '063564703b6094d70718a3e787a55cc9141611e4ecd6b6637f8828f79b4a8c3a', correctMaster),
    changes: ['63-tap Hamming-windowed sinc 8kHz low-pass before resampling', 'Fit entire 289.841ms source into 220ms by interpolation (faster playback and higher pitch)', 'Convert 44100Hz to 24000Hz']},
  {id: 'dice-roll', ms: 650, samples: dice(650, 0xD1CE2026), peak: 0.20, seed: 0xD1CE2026, synthesis: 'Eight soft rattles with progressively wider spacing; invariant across dice results'},
  {id: 'shot', ms: 280, samples: shot(280, 0x51072026), peak: 0.24, seed: 0x51072026, synthesis: 'Short filtered air impulse and descending sine; no real firearm sample'},
  {id: 'slam', ms: 350, samples: slam(350, 0x51A02026), peak: 0.23, seed: 0x51A02026, synthesis: 'Damped low impact with a small metallic overtone'},
  {id: 'nitro', ms: 500, samples: nitro(500, 0xA1702026), peak: 0.22, seed: 0xA1702026, synthesis: 'Filtered noise swell and rising engine-like tones; one shot, no loop'},
  {id: 'skid', ms: 480, samples: skid(480, 0x5C1D2026), peak: 0.22, seed: 0x5C1D2026, synthesis: 'Band-limited friction noise and a descending mid-frequency sine; no tire recording'}
];
const artifacts = new Map();
const manifest = {version: 1, format: {codec: 'PCM', sampleRate, channels: 1, bitsPerSample: 16},
  generator: 'scripts/build-game-sounds.cjs', generatorSha256, generatorHashNormalization: 'UTF-8 LF', checkedAt, auditionReviewed: false,
  cues: {}};
for (const definition of definitions) {
  const pcm = finish(definition.samples, definition.peak), bytes = wav(pcm);
  if (pcm.length !== sampleRate * definition.ms / 1000 || definition.ms > 10000) throw Error('Invalid cue duration');
  const file = definition.id + '.wav';
  artifacts.set(file, bytes);
  manifest.cues[definition.id] = {file, durationMs: definition.ms, bytes: bytes.length, sha256: hash(bytes),
    waveform: waveformStats(pcm), author: definition.author || 'BGA project contributors',
    source: definition.source || originalSource(definition.seed, definition.synthesis),
    license: definition.license || originalLicense, changes: [...(definition.changes || ['Original synthesis; no external recording or sample']), ...commonChanges]};
}
artifacts.set('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2) + '\n'));
const args = process.argv.slice(2);
if (args.some(argument => argument !== '--check')) throw Error('Usage: node scripts/build-game-sounds.cjs [--check]');
if (args.includes('--check')) {
  for (const [file, bytes] of artifacts) {
    if (!fs.existsSync(path.join(output, file)) || !fs.readFileSync(path.join(output, file)).equals(bytes)) throw Error('Generated asset differs: ' + file);
  }
  console.log('Verified seven deterministic game cues and manifest; no audio playback.');
} else {
  for (const [file, bytes] of artifacts) fs.writeFileSync(path.join(output, file), bytes);
  console.log('Built seven game cues: ' + definitions.reduce((sum, definition) => sum + manifest.cues[definition.id].bytes, 0) + ' WAV bytes; no audio playback.');
}
