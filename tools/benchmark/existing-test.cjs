'use strict';
// Explicit opt-in for the persistent isolated QA server, never the production service.
const fs = require('node:fs'),
  path = require('node:path'),
  crypto = require('node:crypto');
const readline = require('node:readline');
const { execFileSync } = require('node:child_process');
const { processProbe, gpuDeviceSample } = require('./telemetry.cjs');
const { harnessDigest, sourceIdentity } = require('./stats.cjs');
const args = Object.fromEntries(
  process.argv.slice(2).reduce((a, v, i, all) => {
    if (!(i % 2)) a.push([v.slice(2), all[i + 1]]);
    return a;
  }, []),
);
const root = fs.realpathSync(args.root),
  pid = Number(args['test-pid']);
const dbFile = fs.realpathSync(args['test-db']);
const base = new URL(args['test-base']);
if (
  process.platform !== 'linux' ||
  !Number.isInteger(pid) ||
  !['127.0.0.1', 'localhost'].includes(base.hostname) ||
  base.protocol !== 'http:' ||
  base.pathname !== '/' ||
  base.username ||
  base.password ||
  base.search ||
  base.hash
)
  throw Error('Use the loopback isolated QA server only');
const cmd = fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8').split('\0');
if (
  !cmd.some((v) => v.endsWith('/persist-qa-server.cjs')) ||
  !cmd.includes(root) ||
  !cmd.includes(path.dirname(dbFile))
)
  throw Error('PID/root/data do not identify the persistent QA server');
const { openDatabase } = require(path.join(root, 'src/db'));
const db = openDatabase(dbFile),
  sessions = [],
  probe = processProbe();
const prefix = 'bench_' + crypto.randomBytes(4).toString('hex');
let initial,
  started,
  peakRss = 0;
async function sample(reset) {
  const [value, deviceGpu] = await Promise.all([probe.sample([pid]), gpuDeviceSample()]);
  peakRss = Math.max(peakRss, value.rssBytes);
  const elapsedMs = performance.now() - started;
  const metrics = {
    ...value,
    deviceGpu,
    cpuMs: (value.cpuSeconds - initial.cpuSeconds) * 1000,
    cpuPercentOfOneCore: ((value.cpuSeconds - initial.cpuSeconds) * 100000) / elapsedMs,
    elapsedMs,
    peakRssBytes: peakRss,
    eventLoopP95Ms: null,
    eventLoopMaxMs: null,
    eventLoopReason:
      'Existing server is measured externally; event-loop instrumentation requires an instrumented start.',
  };
  if (reset) {
    initial = value;
    started = performance.now();
    peakRss = value.rssBytes;
  }
  return metrics;
}
async function stop() {
  for (const { id } of sessions) {
    db.prepare('DELETE FROM sessions WHERE user_id=?').run(id);
    db.prepare('DELETE FROM users WHERE id=?').run(id);
  }
  db.close();
  probe.close();
}
(async () => {
  try {
    for (let i = 0; i < 10; i++) {
      const id = crypto.randomUUID(),
        token = crypto.randomBytes(32).toString('hex');
      // These synthetic accounts cannot password-login; only the private in-memory sessions can use them.
      db.prepare(
        "INSERT INTO users(id,username,display_name,password_hash,role,created_at) VALUES(?,?,?,?,'member',?)",
      ).run(
        id,
        prefix + '_' + i,
        '效能玩家' + (i + 1),
        'benchmark-disabled-' + crypto.randomBytes(32).toString('hex'),
        new Date().toISOString(),
      );
      db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').run(
        crypto.createHash('sha256').update(token).digest('hex'),
        id,
        new Date(Date.now() + 3600000).toISOString(),
      );
      sessions.push({ id, token });
    }
    initial = await probe.sample([pid]);
    started = performance.now();
    const info = {
      type: 'ready',
      base: base.origin,
      sessions,
      revision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
      version: (await (await fetch(base.origin + '/api/version')).json()).version,
      node: process.version,
      platform: process.platform,
      cpus: require('node:os').cpus().length,
      target: 'persistent-isolated-test-site',
      gpu: await gpuDeviceSample(),
    };
    info.harnessDigest = harnessDigest();
    info.sourceIdentity = sourceIdentity(root, info.revision);
    console.log(JSON.stringify(info));
    const lines = readline.createInterface({ input: process.stdin });
    lines.on('line', async (line) => {
      try {
        const { id, command } = JSON.parse(line);
        if (!['reset', 'sample', 'identity'].includes(command))
          throw Error('Unknown fixture command');
        console.log(
          JSON.stringify({
            id,
            metrics:
              command === 'identity'
                ? sourceIdentity(root, info.revision)
                : await sample(command === 'reset'),
          }),
        );
      } catch (error) {
        console.error(error.stack);
        lines.close();
      }
    });
    lines.on('close', async () => {
      await stop();
      process.exit();
    });
  } catch (error) {
    await stop();
    throw error;
  }
})().catch((error) => {
  console.error(error.stack);
  process.exit(1);
});
