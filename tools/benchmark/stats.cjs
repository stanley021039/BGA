'use strict';
function harnessDigest() {
  const fs = require('node:fs'),
    path = require('node:path'),
    hash = require('node:crypto').createHash('sha256');
  for (const name of fs
    .readdirSync(__dirname)
    .filter((n) => /\.(cjs|ps1)$/.test(n))
    .sort())
    hash.update(
      name + '\n' + fs.readFileSync(path.join(__dirname, name), 'utf8').replace(/\r\n/g, '\n'),
    );
  return hash.digest('hex');
}
function sourceIdentity(root, revision) {
  const fs = require('node:fs'),
    path = require('node:path'),
    crypto = require('node:crypto');
  const hash = (data) => crypto.createHash('sha256').update(data).digest('hex');
  const file = path.join(root, 'frontend/dist/.vite/manifest.json');
  const patch = fs.existsSync(path.join(root, '.git'))
    ? require('node:child_process').execFileSync(
        'git',
        [
          'diff',
          '--binary',
          'HEAD',
          '--',
          'src',
          'public',
          'frontend',
          'server.js',
          'package.json',
          'package-lock.json',
        ],
        { cwd: root, maxBuffer: 32 * 1024 * 1024 },
      )
    : Buffer.alloc(0);
  return {
    revision,
    dirtyProduct: patch.length > 0,
    sourcePatchSha256: hash(patch),
    frontendManifestSha256: fs.existsSync(file) ? hash(fs.readFileSync(file)) : null,
  };
}
function assertSourceStable(before, after) {
  if (JSON.stringify(before) !== JSON.stringify(after))
    throw Error('Source/build changed during benchmark; discard this run');
}
function distribution(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  const quantile = (p) =>
    sorted.length ? sorted[Math.max(0, Math.ceil(sorted.length * p) - 1)] : null;
  return {
    count: sorted.length,
    p50: quantile(0.5),
    p95: quantile(0.95),
    p99: quantile(0.99),
    max: quantile(1),
  };
}
function compare(before, after) {
  if (before.schemaVersion !== 1 || after.schemaVersion !== 1)
    throw Error('Unsupported report schema');
  if (JSON.stringify(before.harness) !== JSON.stringify(after.harness))
    throw Error('Benchmark harness mismatch; cannot compare');
  if (JSON.stringify(before.scenario) !== JSON.stringify(after.scenario))
    throw Error('Scenario mismatch; cannot compare');
  if (
    before.browser !== after.browser ||
    JSON.stringify(before.client) !== JSON.stringify(after.client)
  )
    throw Error('Browser/client environment mismatch; cannot compare');
  if (JSON.stringify(before.server) !== JSON.stringify(after.server))
    throw Error('Server environment mismatch; cannot compare');
  if (JSON.stringify(before.gpuAdapter) !== JSON.stringify(after.gpuAdapter))
    throw Error('GPU adapter/driver mismatch; cannot compare');
  if (!before.valid || !after.valid) throw Error('Invalid run; cannot use as a baseline');
  const rows = [];
  for (const phase of ['idle', 'effects']) {
    for (const [metric, read] of [
      ['apiP95Ms', (p) => p.apiLatencyMs.p95],
      ['downloadBytesPerClientSecond', (p) => p.downloadBytes / 10 / (p.durationMs / 1000)],
      ['uploadBodyBytesPerClientSecond', (p) => p.uploadBodyBytes / 10 / (p.durationMs / 1000)],
      ['frameP95Ms', (p) => p.frameIntervalMs.p95],
      ['serverCpuPercent', (p) => p.server.cpuPercentOfOneCore],
      ['serverRssBytes', (p) => p.server.peakRssBytes],
      ['clientCpuPercent', (p) => p.resources?.client.cpuPercentOfOneCore ?? null],
      ['clientRssBytes', (p) => p.resources?.client.peakRssBytes ?? null],
      ['clientGpuDedicatedBytes', (p) => p.resources?.client.peakGpuDedicatedBytes ?? null],
    ]) {
      const a = read(before.phases[phase]),
        b = read(after.phases[phase]);
      rows.push({
        phase,
        metric,
        before: a,
        after: b,
        changePercent: a > 0 && b !== null ? (b / a - 1) * 100 : null,
      });
    }
  }
  return rows;
}
module.exports = { distribution, compare, harnessDigest, sourceIdentity, assertSourceStable };
