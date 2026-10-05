#!/usr/bin/env node
const fs = require('node:fs');
const { run, safeError } = require('../src/data/transfer');
const contract = {
  tool: 'afterhours-server-data', version: 1, usage: 'node tools/server-data.cjs --request <absolute-json-file | ->',
  actions: {
    keygen: { action: 'keygen', keyFile: '/private/backup.key' },
    inspect: { action: 'inspect', sourceStopped: true, source: { dbFile: '/old/afterhours.sqlite', historyDir: '/old/history', communityDir: '/old/community', musicDir: '/old/music' } },
    export: { action: 'export', sourceStopped: true, source: { envId: 'production', dbFile: '/old/afterhours.sqlite', historyDir: '/old/history', communityDir: '/old/community', musicDir: '/old/music' }, keyFile: '/private/backup.key', outputDir: '/backups/fresh-bundle' },
    verify: { action: 'verify', keyFile: '/private/backup.key', bundleDir: '/backups/fresh-bundle' },
    restore: { action: 'restore', keyFile: '/private/backup.key', bundleDir: '/backups/fresh-bundle', destinationDir: '/new/generation', apply: false },
  },
  options: { apply: 'Only literal true publishes a restore; default is a fully validated dry run', acknowledgeInterruptedMatches: 'Explicitly permit unfinished matches to become interrupted on restore', maxBytes: 'Default 10 GiB, maximum 1 TiB', tempDir: 'Optional absolute scratch directory for verify', forceVacuum: 'Force the compatible SQLite VACUUM INTO snapshot method' },
  safeguards: ['Full account data is encrypted, including password hashes; original passwords still work', 'Old sessions, invitations and reset links are revoked on restore', 'Every writer must be stopped before inspect/export', 'Restore only creates a new destination; never merges or overwrites', 'Deployment secrets and live rooms are excluded; first boot disables external submissions'],
  output: { ok: true, result: 'action-specific JSON' }, errorOutput: { ok: false, error: { code: 'stable error code', message: 'redacted description' } },
};
async function main() {
  if (process.argv.length === 3 && process.argv[2] === '--help') { process.stdout.write(JSON.stringify({ ok: true, result: contract }) + '\n'); return; }
  try {
    if (process.argv.length !== 4 || process.argv[2] !== '--request') { const error = Error('Use --request <file|-> or --help'); error.code = 'INVALID_REQUEST'; throw error; }
    const file = process.argv[3], contents = fs.readFileSync(file === '-' ? 0 : file, 'utf8');
    if (Buffer.byteLength(contents) > 1024 * 1024) { const error = Error('Request exceeds 1 MiB'); error.code = 'INVALID_REQUEST'; throw error; }
    let request; try { request = JSON.parse(contents.replace(/^\uFEFF/, '')); } catch { const error = Error('Request is not valid JSON'); error.code = 'INVALID_REQUEST'; throw error; }
    process.stdout.write(JSON.stringify({ ok: true, result: await run(request) }) + '\n');
  } catch (error) { process.stdout.write(JSON.stringify({ ok: false, error: safeError(error) }) + '\n'); process.exitCode = 1; }
}
main();
