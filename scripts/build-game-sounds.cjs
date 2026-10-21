#!/usr/bin/env node
'use strict';

// Rebuild the eight short game cues without network access or audio playback.
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
const archiveUrl =
  'https://kenney.nl/media/pages/assets/interface-sounds/fa43c1dd4d-1677589452/kenney_interface-sounds.zip';
const hash = (data) => crypto.createHash('sha256').update(data).digest('hex');
const hashText = (data) => hash(Buffer.from(data.toString('utf8').replace(/\r\n/g, '\n')));
const round = (value) => Number(value.toFixed(8));
const tau = 2 * Math.PI;

function readMaster(name, expectedSha256) {
  const file = 'sources/kenney-' + name + '.wav';
  const bytes = fs.readFileSync(path.join(output, file));
  if (hash(bytes) !== expectedSha256) throw Error('Master hash mismatch: ' + file);
  if (
    bytes.toString('ascii', 0, 4) !== 'RIFF' ||
    bytes.readUInt32LE(4) !== bytes.length - 8 ||
    bytes.toString('ascii', 8, 12) !== 'WAVE' ||
    bytes.toString('ascii', 12, 16) !== 'fmt ' ||
    bytes.readUInt32LE(16) !== 16 ||
    bytes.readUInt16LE(20) !== 1 ||
    bytes.readUInt16LE(22) !== 1 ||
    bytes.readUInt32LE(24) !== 44100 ||
    bytes.readUInt16LE(34) !== 16 ||
    bytes.toString('ascii', 36, 40) !== 'data' ||
    bytes.readUInt32LE(40) !== bytes.length - 44
  )
    throw Error('Invalid PCM master: ' + file);
  const samples = Float64Array.from(
    { length: (bytes.length - 44) / 2 },
    (_, i) => bytes.readInt16LE(44 + i * 2) / 32768,
  );
  return { file, sha256: expectedSha256, samples, sampleRate: 44100 };
}

function seededNoise(seed) {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) / 0x100000000) * 2 - 1;
  };
}

function samplesFor(ms) {
  return new Float64Array((sampleRate * ms) / 1000);
}

function antiAlias(input, sourceRate) {
  const taps = 63,
    middle = (taps - 1) / 2,
    cutoff = 8000 / sourceRate;
  const kernel = new Float64Array(taps);
  let total = 0;
  for (let i = 0; i < taps; i++) {
    const offset = i - middle;
    const sinc = offset === 0 ? 2 * cutoff : Math.sin(tau * cutoff * offset) / (Math.PI * offset);
    kernel[i] = sinc * (0.54 - 0.46 * Math.cos((tau * i) / (taps - 1)));
    total += kernel[i];
  }
  const filtered = new Float64Array(input.length);
  for (let frame = 0; frame < input.length; frame++) {
    for (let tap = 0; tap < taps; tap++) {
      const position = frame + tap - middle;
      if (position >= 0 && position < input.length)
        filtered[frame] += (input[position] * kernel[tap]) / total;
    }
  }
  return filtered;
}

function resample(master, ms, fitEntireMaster) {
  const samples = samplesFor(ms);
  const filtered = antiAlias(master.samples, master.sampleRate);
  const step = fitEntireMaster
    ? (filtered.length - 1) / (samples.length - 1)
    : master.sampleRate / sampleRate;
  for (let i = 0; i < samples.length; i++) {
    const position = Math.min(filtered.length - 1, i * step);
    const left = Math.floor(position),
      fraction = position - left;
    samples[i] =
      filtered[left] * (1 - fraction) +
      filtered[Math.min(left + 1, filtered.length - 1)] * fraction;
  }
  return samples;
}

function dice(ms, seed) {
  const samples = samplesFor(ms),
    noise = seededNoise(seed);
  const taps = [0.012, 0.064, 0.127, 0.201, 0.288, 0.388, 0.499, 0.59];
  let low = 0;
  for (let i = 0; i < samples.length; i++) {
    const time = i / sampleRate;
    low += 0.23 * (noise() - low);
    for (let tap = 0; tap < taps.length; tap++) {
      const age = time - taps[tap];
      if (age < 0 || age > 0.06) continue;
      const softAttack = Math.min(1, age / 0.002);
      const tone =
        Math.sin(tau * (490 + tap * 31) * age) + 0.35 * Math.sin(tau * (850 + tap * 23) * age);
      samples[i] +=
        softAttack *
        (0.56 * low * Math.exp(-age / 0.012) + 0.23 * tone * Math.exp(-age / 0.01)) *
        (1 - tap * 0.055);
    }
  }
  return samples;
}

function shot(ms, seed) {
  const samples = samplesFor(ms),
    noise = seededNoise(seed);
  let low = 0,
    phase = 0;
  for (let i = 0; i < samples.length; i++) {
    const time = i / sampleRate;
    low += 0.18 * (noise() - low);
    phase += (tau * (360 * Math.exp(-time / 0.095) + 105)) / sampleRate;
    samples[i] =
      0.65 * low * Math.exp(-time / 0.042) + 0.32 * Math.sin(phase) * Math.exp(-time / 0.075);
  }
  return samples;
}

function slam(ms, seed) {
  const samples = samplesFor(ms),
    noise = seededNoise(seed);
  let low = 0;
  for (let i = 0; i < samples.length; i++) {
    const time = i / sampleRate;
    low += 0.085 * (noise() - low);
    const thud = Math.sin(tau * 112 * time) + 0.42 * Math.sin(tau * 183 * time);
    const metal = Math.sin(tau * 530 * time) + 0.22 * Math.sin(tau * 907 * time);
    samples[i] =
      0.45 * thud * Math.exp(-time / 0.061) +
      0.48 * low * Math.exp(-time / 0.042) +
      0.1 * metal * Math.exp(-time / 0.085);
  }
  return samples;
}

function nitro(ms, seed) {
  const samples = samplesFor(ms),
    noise = seededNoise(seed);
  const duration = ms / 1000;
  let low = 0,
    phase = 0;
  for (let i = 0; i < samples.length; i++) {
    const time = i / sampleRate,
      progress = time / duration;
    low += (0.08 + progress * 0.14) * (noise() - low);
    phase += (tau * (105 + 390 * progress)) / sampleRate;
    const envelope = Math.sin(Math.PI * progress) ** 1.3;
    samples[i] = envelope * (0.72 * low + 0.17 * Math.sin(phase) + 0.07 * Math.sin(phase * 2));
  }
  return samples;
}

function skid(ms, seed) {
  const samples = samplesFor(ms),
    noise = seededNoise(seed);
  const duration = ms / 1000;
  let low = 0,
    lower = 0,
    phase = 0;
  for (let i = 0; i < samples.length; i++) {
    const time = i / sampleRate,
      progress = time / duration;
    const white = noise();
    low += 0.38 * (white - low);
    lower += 0.08 * (white - lower);
    phase += (tau * (980 - 480 * progress)) / sampleRate;
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
  const fadeIn = (sampleRate * 5) / 1000,
    fadeOut = (sampleRate * 24) / 1000;
  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    const envelope = Math.min(1, i / fadeIn) * Math.min(1, (samples.length - 1 - i) / fadeOut);
    samples[i] = (samples[i] - mean) * envelope;
    if (!Number.isFinite(samples[i])) throw Error('Non-finite sample');
    peak = Math.max(peak, Math.abs(samples[i]));
  }
  if (!peak) throw Error('Silent cue');
  // Scale to the per-cue peak with headroom; both boundaries remain silent.
  const pcm = new Int16Array(samples.length);
  const scale = Math.floor(targetPeak * 32767) / peak;
  for (let i = 0; i < samples.length; i++) pcm[i] = Math.round(samples[i] * scale);
  pcm[0] = pcm[pcm.length - 1] = 0;
  return pcm;
}

function wav(pcm) {
  const bytes = Buffer.alloc(44 + pcm.length * 2);
  bytes.write('RIFF', 0);
  bytes.writeUInt32LE(bytes.length - 8, 4);
  bytes.write('WAVE', 8);
  bytes.write('fmt ', 12);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(sampleRate, 24);
  bytes.writeUInt32LE(sampleRate * 2, 28);
  bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36);
  bytes.writeUInt32LE(pcm.length * 2, 40);
  for (let i = 0; i < pcm.length; i++) bytes.writeInt16LE(pcm[i], 44 + i * 2);
  return bytes;
}

function waveformStats(pcm) {
  let peak = 0,
    energy = 0,
    sum = 0,
    maximumStep = 0,
    clippedSamples = 0;
  for (let i = 0; i < pcm.length; i++) {
    const sample = pcm[i] / 32768;
    peak = Math.max(peak, Math.abs(sample));
    energy += sample * sample;
    sum += sample;
    if (Math.abs(pcm[i]) >= 32767) clippedSamples++;
    if (i) maximumStep = Math.max(maximumStep, Math.abs(pcm[i] - pcm[i - 1]) / 32768);
  }
  return {
    peak: round(peak),
    rms: round(Math.sqrt(energy / pcm.length)),
    mean: round(sum / pcm.length),
    maximumStep: round(maximumStep),
    firstSample: pcm[0],
    lastSample: pcm[pcm.length - 1],
    clippedSamples,
  };
}

const turnMaster = readMaster(
  'confirmation_003',
  '60903f8e64428b742ffba12df9142ae3d391a4b428aa4deefd7fa15db013c3f8',
);
const correctMaster = readMaster(
  'confirmation_001',
  '40fedc78efd80dceb2e747bb3f98bf881e271844b914e382b349f93d89d9d067',
);
const licenseFile = 'sources/KENNEY-INTERFACE-LICENSE.txt';
const licenseTextSha256 = hashText(fs.readFileSync(path.join(output, licenseFile)));
const generatorSha256 = hashText(fs.readFileSync(__filename));
const kenneyLicense = {
  id: 'CC0-1.0',
  url: 'https://creativecommons.org/publicdomain/zero/1.0/',
  file: licenseFile,
  textSha256: licenseTextSha256,
  hashNormalization: 'UTF-8 LF',
  attributionRequired: false,
  redistributionAllowed: true,
};
const originalLicense = {
  id: 'Project-original',
  url: null,
  attributionRequired: false,
  redistributionAllowed: true,
  note: 'Original synthesized project assets, distributed with the project. No third-party samples; not attributed to Kenney and not declared CC0.',
};
const commonChanges = [
  'Remove DC offset',
  '5ms linear fade-in and 24ms linear fade-out',
  'Conservative peak scaling',
  'Mono PCM16 WAV at 24000Hz',
];
function kenneySource(name, originalSha256, master) {
  return {
    type: 'licensed-asset',
    url: sourceUrl,
    package: 'Interface Sounds 1.0',
    archiveUrl,
    archiveSha256,
    originalFile: 'Audio/' + name + '.ogg',
    originalSha256,
    decodedFile: master.file,
    decodedSha256: master.sha256,
    decodedBy: 'python-soundfile 0.14.0 / libsndfile 1.2.2, PCM16',
    checkedAt,
  };
}
function originalSource(seed, synthesis) {
  return {
    type: 'original-synthesis',
    generator: 'scripts/build-game-sounds.cjs',
    generatorSha256,
    generatorHashNormalization: 'UTF-8 LF',
    algorithm: 'xorshift32 seeded noise plus sine oscillators and envelopes',
    seed,
    synthesis,
    createdAt: checkedAt,
  };
}
function enhanced(kind, ms, seed) {
  const noise = seededNoise(seed),
    a = new Float64Array((sampleRate * ms) / 1000);
  let low = 0,
    phase = 0;
  for (let i = 0; i < a.length; i++) {
    const t = i / sampleRate,
      u = i / a.length,
      n = noise();
    low = 0.88 * low + 0.12 * n;
    let v = 0;
    if (kind === 'turn') {
      for (const [at, hz] of [
        [0.01, 1046.5],
        [0.215, 659.25],
      ]) {
        const x = t - at;
        if (x >= 0 && x < 0.34)
          v +=
            Math.sin(tau * hz * x) * Math.exp(-x * 13) +
            0.2 * Math.sin(tau * hz * 2.01 * x) * Math.exp(-x * 25) +
            0.08 * Math.sin(tau * hz * 3.97 * x) * Math.exp(-x * 36) +
            (n - low) * 0.08 * Math.exp(-x * 90);
      }
    } else if (kind === 'reveal') {
      v =
        Math.sin(tau * 180 * t) * 0.85 * Math.exp(-t * 28) +
        Math.sin(tau * 720 * t) * 0.28 * Math.exp(-t * 39) +
        (n - low) * 0.6 * Math.exp(-t * 75);
    } else if (kind === 'shot') {
      // Dry percussive crack + pressure thump + short room reflections, no laser sweep.
      const attack = Math.exp(-t * 75),
        body = Math.exp(-t * 22),
        air = Math.exp(-t * 12);
      v =
        Math.tanh(n * 2.8) * (attack * 0.9 + body * 0.22) +
        Math.sin(tau * 86 * t) * 0.72 * Math.exp(-t * 15) +
        low * 1.4 * air;
      for (const [at, gain] of [
        [0.075, 0.3],
        [0.135, 0.16],
        [0.205, 0.07],
      ]) {
        const x = t - at;
        if (x > 0)
          v +=
            (Math.tanh(n * 2) * 0.48 + Math.sin(tau * 430 * x) * 0.13) * gain * Math.exp(-x * 23);
      }
    } else if (kind === 'slam') {
      v = (low * 3 + Math.sin(tau * (90 * t - 48 * t * t)) * 0.6) * Math.exp(-t * 8);
      for (const at of [0.02, 0.08, 0.17]) {
        const x = t - at;
        if (x > 0) v += Math.sin(tau * 680 * x) * 0.13 * Math.exp(-x * 28);
      }
    } else if (kind === 'explosion') {
      const crack = Math.tanh((n - low) * 4) * 0.9 * Math.exp(-t * 60),
        rumble =
          (Math.tanh(low * 5) * 0.8 + Math.sin(tau * (58 * t - 7 * t * t)) * 0.65) *
          Math.exp(-t * 2.8);
      v = crack + rumble;
      for (const [at, gain] of [
        [0.12, 0.35],
        [0.29, 0.18],
        [0.48, 0.09],
      ]) {
        const x = t - at;
        if (x > 0)
          v += (Math.tanh(n * 2) * 0.5 + Math.sin(tau * 74 * x) * 0.5) * gain * Math.exp(-x * 5);
      }
    } else if (kind === 'nitro') {
      phase += (tau * (100 + 700 * u ** 1.7)) / sampleRate;
      const e = Math.sin(Math.PI * u) ** 0.45;
      v =
        (Math.sin(phase) + 0.33 * Math.sin(phase * 2) + 0.2 * Math.sin(phase * 3)) * 0.43 * e +
        (n - low) * 0.2 * e;
    } else if (kind === 'skid') {
      phase += (tau * (950 - 500 * u + 70 * Math.sin(tau * 12 * t))) / sampleRate;
      const e = Math.sin(Math.PI * u) ** 0.55;
      v =
        (Math.sin(phase) * 0.45 + Math.sin(phase * 1.48) * 0.22 + (n - low) * 0.25) *
        e *
        (0.85 + 0.15 * Math.sin(tau * 22 * t));
    }
    a[i] = v;
  }
  return a;
}
const definitions = [
  {
    id: 'turn',
    ms: 560,
    samples: enhanced('turn', 560, 20261020),
    peak: 0.5,
    seed: 20261020,
    synthesis:
      'Clear descending ding-dong mallet reminder, two distinct pitches with a short natural decay',
  },
  {
    id: 'dice-roll',
    ms: 650,
    samples: dice(650, 0xd1ce2026),
    peak: 0.2,
    seed: 0xd1ce2026,
    synthesis: 'Eight soft rattles with progressively wider spacing; invariant across dice results',
  },
  {
    id: 'shot',
    ms: 1360,
    samples: enhanced('shot', 620, 2402),
    repeat: 2,
    gapMs: 120,
    peak: 0.62,
    seed: 2402,
    synthesis:
      'Two identical 620ms gunshot bursts with a 120ms silent gap; dry crack, pressure thump and short reflections',
  },
  {
    id: 'slam',
    ms: 600,
    samples: enhanced('slam', 600, 20),
    peak: 0.6,
    seed: 20,
    synthesis: 'Heavy low impact with three brief metallic resonances',
  },
  {
    id: 'nitro',
    ms: 1300,
    samples: enhanced('nitro', 1300, 2702),
    peak: 0.52,
    seed: 2702,
    synthesis:
      'Extended rising engine rev, stronger harmonics and sustained air rush before release',
  },
  {
    id: 'skid',
    ms: 660,
    samples: enhanced('skid', 660, 28),
    peak: 0.48,
    seed: 28,
    synthesis: 'Falling modulated tire-like squeal with textured friction',
  },
  {
    id: 'quacks-explosion',
    ms: 1500,
    samples: enhanced('explosion', 1500, 2602),
    peak: 0.72,
    seed: 2602,
    synthesis:
      'Abrupt explosive crack, heavy sustained low rumble and three debris reflections; startling vehicle explosion',
  },
  {
    id: 'reveal',
    file: '../gift-sounds/open_001.wav',
    ms: 560,
    samples: enhanced('reveal', 240, 1903),
    repeat: 2,
    gapMs: 80,
    peak: 0.58,
    seed: 1903,
    synthesis:
      'Two identical dry reveal hits, 240ms each with an 80ms silent gap; no anticipation sweep or sustained tail',
  },
];
const artifacts = new Map();
const manifest = {
  version: 1,
  format: { codec: 'PCM', sampleRate, channels: 1, bitsPerSample: 16 },
  generator: 'scripts/build-game-sounds.cjs',
  generatorSha256,
  generatorHashNormalization: 'UTF-8 LF',
  checkedAt,
  auditionReviewed: false,
  cues: {},
};
for (const definition of definitions) {
  let pcm = finish(definition.samples, definition.peak);
  if (definition.repeat === 2) {
    const single = pcm,
      gap = (sampleRate * definition.gapMs) / 1000;
    pcm = new Int16Array(single.length * 2 + gap);
    pcm.set(single, 0);
    pcm.set(single, single.length + gap);
  }
  const bytes = wav(pcm);
  if (pcm.length !== (sampleRate * definition.ms) / 1000 || definition.ms > 10000)
    throw Error('Invalid cue duration');
  const file = definition.file || definition.id + '.wav';
  artifacts.set(file, bytes);
  manifest.cues[definition.id] = {
    file,
    durationMs: definition.ms,
    bytes: bytes.length,
    sha256: hash(bytes),
    waveform: waveformStats(pcm),
    author: definition.author || 'BGA project contributors',
    source: definition.source || originalSource(definition.seed, definition.synthesis),
    license: definition.license || originalLicense,
    changes: [
      ...(definition.changes || ['Original synthesis; no external recording or sample']),
      ...commonChanges,
    ],
  };
}
artifacts.set('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2) + '\n'));
const args = process.argv.slice(2);
if (args.some((argument) => argument !== '--check'))
  throw Error('Usage: node scripts/build-game-sounds.cjs [--check]');
if (args.includes('--check')) {
  for (const [file, bytes] of artifacts) {
    const present = fs.existsSync(path.join(output, file))
      ? fs.readFileSync(path.join(output, file))
      : null;
    const matches =
      present &&
      (file === 'manifest.json'
        ? present.toString('utf8').replace(/\r\n/g, '\n') ===
          bytes.toString('utf8').replace(/\r\n/g, '\n')
        : present.equals(bytes));
    if (!matches) throw Error('Generated asset differs: ' + file);
  }
  console.log('Verified eight deterministic game cues and manifest; no audio playback.');
} else {
  for (const [file, bytes] of artifacts) fs.writeFileSync(path.join(output, file), bytes);
  console.log(
    'Built eight game cues: ' +
      definitions.reduce((sum, definition) => sum + manifest.cues[definition.id].bytes, 0) +
      ' WAV bytes; no audio playback.',
  );
}
