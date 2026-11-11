'use strict';
// Build immutable Git archives and run exactly the same harness against each.
const fs = require('node:fs'),
  path = require('node:path'),
  os = require('node:os');
const { execFileSync, spawnSync } = require('node:child_process');
const tar = require('tar');
const { compare, distribution } = require('./stats.cjs');
async function main() {
  const args = process.argv.slice(2),
    opt = {};
  for (let i = 0; i < args.length; i += 2) {
    if (!['--refs', '--out', '--runs'].includes(args[i]) || args[i + 1] === undefined)
      throw Error('Usage: perf:history --refs BEFORE,AFTER [--runs 3] [--out DIR]');
    opt[args[i].slice(2)] = args[i + 1];
  }
  const refs = opt.refs?.split(',').filter(Boolean),
    runs = Number(opt.runs || 3);
  if (
    !refs ||
    refs.length < 2 ||
    refs.length > 10 ||
    !Number.isInteger(runs) ||
    runs < 1 ||
    runs > 10
  )
    throw Error('Choose 2–10 revisions and 1–10 runs');
  const root = path.resolve(__dirname, '../..'),
    output = path.resolve(opt.out || 'work/benchmark/history');
  fs.mkdirSync(output, { recursive: true });
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'bga-benchmark-history-'));
  const git = (...args) =>
    execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 1024 * 1024 }).trim();
  const npm = (args, cwd) => {
    // npm run supplies the exact npm CLI; direct node execution works on Windows too.
    if (!process.env.npm_execpath) throw Error('Run through npm run perf:history');
    execFileSync(process.execPath, [process.env.npm_execpath, ...args], {
      cwd,
      stdio: 'inherit',
      timeout: 240000,
    });
  };
  const revisions = refs.map((ref) => {
    if (ref.startsWith('-') || ref.length > 200) throw Error('Invalid Git revision');
    return git('rev-parse', '--verify', ref + '^{commit}');
  });
  const results = new Map(revisions.map((sha) => [sha, []]));
  try {
    for (const sha of revisions) {
      const directory = path.join(scratch, sha);
      fs.mkdirSync(directory);
      const file = path.join(scratch, sha + '.tar');
      execFileSync('git', ['archive', '--format=tar', '--output', file, sha], { cwd: root });
      await tar.x({ file, cwd: directory });
      fs.unlinkSync(file);
      npm(['ci', '--ignore-scripts'], directory);
      npm(['ci', '--ignore-scripts'], path.join(directory, 'frontend'));
      npm(['run', 'frontend:build'], directory);
    }
    for (let run = 0; run < runs; run++) {
      // Reverse every other round to reduce systematic order/temperature bias.
      for (const sha of run % 2 ? [...revisions].reverse() : revisions) {
        const file = path.join(output, `${sha.slice(0, 12)}-${run + 1}.json`);
        const child = spawnSync(
          process.execPath,
          [
            path.join(__dirname, 'run.cjs'),
            '--root',
            path.join(scratch, sha),
            '--revision',
            sha,
            '--out',
            file,
          ],
          { stdio: 'inherit', timeout: 180000, windowsHide: true },
        );
        if (child.error) throw child.error;
        if (fs.existsSync(file)) results.get(sha).push(JSON.parse(fs.readFileSync(file, 'utf8')));
        if (child.status !== 0)
          throw Error('Invalid benchmark for ' + sha + '; raw report retained');
      }
    }
    const summary = { schemaVersion: 1, runs, revisions: [], comparisons: [] };
    for (const sha of revisions) {
      const reports = results.get(sha);
      summary.revisions.push({
        revision: sha,
        version: reports[0].version,
        validRuns: reports.length,
        effectsApiP95Ms: distribution(reports.map((r) => r.phases.effects.apiLatencyMs.p95)),
        effectsDeliveryP95Ms: distribution(
          reports.map((r) => r.phases.effects.delivery.latencyMs.p95),
        ),
        effectsBytes: distribution(reports.map((r) => r.phases.effects.downloadBytes)),
      });
    }
    for (let i = 1; i < revisions.length; i++) {
      const before = results.get(revisions[i - 1]),
        after = results.get(revisions[i]);
      summary.comparisons.push({
        before: revisions[i - 1],
        after: revisions[i],
        pairedRuns: before.map((report, n) => compare(report, after[n])),
      });
    }
    fs.writeFileSync(path.join(output, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
    console.log('History reports: ' + output);
  } finally {
    // Only this invocation's mkdtemp tree; no checkout, service or player data is removed.
    fs.rmSync(scratch, { recursive: true, force: true, maxRetries: 5 });
  }
}
main().catch((error) => {
  console.error(error.stack);
  process.exitCode = 1;
});
