'use strict';
// Only creates a fresh temporary database. Never reads .env or accepts a target URL.
const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');
const crypto = require('node:crypto');
const { monitorEventLoopDelay } = require('node:perf_hooks');
const { execFileSync } = require('node:child_process');
const { processProbe, gpuDeviceSample } = require('./telemetry.cjs');
const { harnessDigest, sourceIdentity } = require('./stats.cjs');
const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, value, i, all) => {
    if (i % 2 === 0) pairs.push([value.slice(2), all[i + 1]]);
    return pairs;
  }, []),
);
const root = path.resolve(args.root || path.join(__dirname, '../..'));
const { appFixture } = require(path.join(root, 'tests/helpers/app-fixture.cjs'));
const { createAuth } = require(path.join(root, 'src/auth'));
const hash = (s) => crypto.createHash('sha256').update(s).digest('hex');
const sessions = [];
let fixture;
const probe = processProbe();
const histogram = monitorEventLoopDelay({ resolution: 10 });
let usage = process.cpuUsage(),
  started = performance.now(),
  peakRss = 0;
const rssTimer = setInterval(() => {
  peakRss = Math.max(peakRss, process.memoryUsage().rss);
}, 100);
rssTimer.unref();
async function sample(reset = false) {
  const [memory, deviceGpu] = await Promise.all([probe.sample([process.pid]), gpuDeviceSample()]);
  const cpu = process.cpuUsage(usage),
    elapsedMs = performance.now() - started;
  const value = {
    elapsedMs,
    cpuMs: (cpu.user + cpu.system) / 1000,
    cpuPercentOfOneCore: (cpu.user + cpu.system) / (elapsedMs * 10),
    rssBytes: process.memoryUsage().rss,
    peakRssBytes: peakRss,
    eventLoopP95Ms: histogram.count ? histogram.percentile(95) / 1e6 : null,
    eventLoopMaxMs: histogram.count ? histogram.max / 1e6 : null,
    privateBytes: memory.privateBytes,
    gpu: memory.gpu,
    deviceGpu,
  };
  if (reset) {
    usage = process.cpuUsage();
    started = performance.now();
    peakRss = process.memoryUsage().rss;
    histogram.reset();
  }
  return value;
}
async function stop() {
  histogram.disable();
  clearInterval(rssTimer);
  await fixture?.dispose();
  probe.close();
}
(async () => {
  // Reproducible decorative combat/positions, scoped to this disposable process.
  let seed = 311;
  Math.random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  fixture = await appFixture(
    { after() {} },
    {
      config: { frontendEnabled: true, achievementPurpose: 'test', marketAutomationEnabled: false },
      seed: async (db) => {
        const admin = await createAuth(db).bootstrap(
          'benchmark_seed',
          crypto.randomBytes(20).toString('hex'),
        );
        const row = db.prepare('SELECT * FROM users WHERE id=?').get(admin);
        db.prepare('DELETE FROM users WHERE id=?').run(admin);
        for (let i = 0; i < 10; i++) {
          const id = `00000000-0311-4000-8000-${String(i).padStart(12, '0')}`;
          const token = crypto.randomBytes(32).toString('hex');
          db.prepare(
            "INSERT INTO users(id,username,display_name,password_hash,role,created_at) VALUES(?,?,?,?,'member',?)",
          ).run(id, 'bench_' + i, '效能玩家' + (i + 1), row.password_hash, row.created_at);
          db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').run(
            hash(token),
            id,
            new Date(Date.now() + 3600000).toISOString(),
          );
          sessions.push({ id, token });
        }
      },
    },
  );
  let revision = args.revision;
  if (!revision)
    revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  histogram.enable();
  await sample(true);
  // Private pipe only: the caller consumes tokens in memory and never puts them in reports.
  console.log(
    JSON.stringify({
      type: 'ready',
      base: fixture.base,
      sessions,
      revision,
      sourceIdentity: sourceIdentity(root, revision),
      harnessDigest: harnessDigest(),
      version: require(path.join(root, 'package.json')).version,
      node: process.version,
      platform: process.platform,
      cpus: require('node:os').cpus().length,
    }),
  );
  const lines = readline.createInterface({ input: process.stdin });
  lines.on('line', async (line) => {
    try {
      const { id, command } = JSON.parse(line);
      if (command === 'stop') {
        await stop();
        process.exit(0);
      }
      if (!['reset', 'sample', 'identity'].includes(command))
        throw Error('Unknown fixture command');
      console.log(
        JSON.stringify({
          id,
          metrics:
            command === 'identity'
              ? sourceIdentity(root, revision)
              : await sample(command === 'reset'),
        }),
      );
    } catch (error) {
      console.error(error.message);
      process.exitCode = 1;
      lines.close();
    }
  });
  lines.on('close', () => stop().then(() => process.exit(process.exitCode || 0)));
})().catch(async (error) => {
  console.error(error.stack);
  await stop();
  process.exit(1);
});
