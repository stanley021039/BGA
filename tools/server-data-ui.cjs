#!/usr/bin/env node
const { createTransferUi } = require('../src/data/ui');
async function main() {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || args[0] !== '--port' || !/^\d+$/.test(args[1]) || Number(args[1]) < 1 || Number(args[1]) > 65535)) throw Error('Usage: node tools/server-data-ui.cjs [--port 3170]');
  const ui = createTransferUi({ port: args.length ? Number(args[1]) : 3170 });
  const result = await ui.listen();
  process.stdout.write(JSON.stringify({ ok: true, result: { ...result, note: 'Open this local URL manually. This UI does not stop or switch game services.' } }) + '\n');
  let stopping = false;
  const stop = async () => { if (stopping) return; stopping = true; try { await ui.close(); } catch { process.exitCode = 1; } };
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
}
main().catch(() => { process.stderr.write('Unable to start the localhost data transfer UI. Use --port <1..65535> and check the port is free.\n'); process.exitCode = 1; });
