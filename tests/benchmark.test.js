'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { distribution, compare, assertSourceStable } = require('../tools/benchmark/stats.cjs');
function report() {
  const phase = () => ({
    apiLatencyMs: { p95: 10 },
    downloadBytes: 10000,
    uploadBodyBytes: 1000,
    durationMs: 1000,
    frameIntervalMs: { p95: 16 },
    server: { cpuPercentOfOneCore: 5, peakRssBytes: 100 },
    resources: {
      client: { cpuPercentOfOneCore: 50, peakRssBytes: 200, peakGpuDedicatedBytes: null },
    },
  });
  return {
    schemaVersion: 1,
    harness: { client: 'a', server: 'a' },
    valid: true,
    scenario: { id: 'test', users: 10 },
    browser: 'same',
    client: { cpus: 4 },
    server: { cpus: 2 },
    gpuAdapter: [{ device: 1 }],
    phases: { idle: phase(), effects: phase() },
  };
}
test('nearest-rank percentiles retain tail latency and do not invent absent GPU values', () => {
  assert.deepEqual(distribution([null, undefined, NaN, Infinity]), {
    count: 0,
    p50: null,
    p95: null,
    p99: null,
    max: null,
  });
  const d = distribution(Array.from({ length: 100 }, (_, i) => 100 - i));
  assert.equal(d.p50, 50);
  assert.equal(d.p95, 95);
  assert.equal(d.p99, 99);
  assert.equal(d.max, 100);
});
test('comparisons normalize traffic by client count and actual time', () => {
  const before = report(),
    after = report();
  after.phases.effects.durationMs = 2000;
  after.phases.effects.downloadBytes = 20000;
  after.phases.effects.apiLatencyMs.p95 = 15;
  const rows = compare(before, after).filter((r) => r.phase === 'effects');
  assert.equal(rows.find((r) => r.metric === 'downloadBytesPerClientSecond').changePercent, 0);
  assert.equal(rows.find((r) => r.metric === 'apiP95Ms').changePercent, 50);
  assert.equal(rows.find((r) => r.metric === 'clientGpuDedicatedBytes').changePercent, null);
});
test('invalid or incompatible environments cannot become performance baselines', () => {
  for (const mutate of [
    (r) => {
      r.valid = false;
    },
    (r) => {
      r.schemaVersion = 2;
    },
    (r) => {
      r.harness.client = 'b';
    },
    (r) => {
      r.scenario.users = 9;
    },
    (r) => {
      r.browser = 'different';
    },
    (r) => {
      r.client.cpus = 8;
    },
    (r) => {
      r.server.cpus = 8;
    },
    (r) => {
      r.gpuAdapter = [];
    },
  ]) {
    const after = report();
    mutate(after);
    assert.throws(() => compare(report(), after));
  }
});
test('a rebuild during a run invalidates its source evidence', () => {
  const before = { revision: 'a', frontendManifestSha256: 'old', sourcePatchSha256: 'x' };
  assert.doesNotThrow(() => assertSourceStable(before, { ...before }));
  assert.throws(() => assertSourceStable(before, { ...before, frontendManifestSha256: 'new' }));
  assert.throws(() => assertSourceStable(before, { ...before, sourcePatchSha256: 'changed' }));
});
