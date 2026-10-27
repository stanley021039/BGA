'use strict';
const fs = require('node:fs'),
  path = require('node:path');
const { spawn, execFile } = require('node:child_process');
const readline = require('node:readline');
const { promisify } = require('node:util');
const execute = promisify(execFile);
function processProbe() {
  let helper, lines;
  const pending = [];
  if (process.platform === 'win32') {
    helper = spawn(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        path.join(__dirname, 'windows-sample.ps1'),
      ],
      { windowsHide: true, stdio: ['pipe', 'pipe', 'inherit'] },
    );
    lines = readline.createInterface({ input: helper.stdout });
    lines.on('line', (line) => {
      const p = pending.shift();
      if (p) {
        clearTimeout(p.timer);
        try {
          p.resolve(JSON.parse(line));
        } catch (e) {
          p.reject(e);
        }
      }
    });
    const fail = (error) => {
      for (const p of pending.splice(0)) {
        clearTimeout(p.timer);
        p.reject(error);
      }
    };
    helper.on('error', fail);
    helper.on('exit', () => fail(Error('Telemetry helper exited')));
  }
  return {
    async sample(pids) {
      if (helper)
        return new Promise((resolve, reject) => {
          const item = {
            resolve,
            reject,
            timer: setTimeout(() => {
              reject(Error('Telemetry helper timed out'));
              helper.kill();
            }, 10000),
          };
          pending.push(item);
          helper.stdin.write(JSON.stringify({ pids }) + '\n');
        });
      let cpuSeconds = 0,
        rssBytes = 0,
        privateBytes = 0,
        processes = 0;
      const hz = Number((await execute('getconf', ['CLK_TCK'])).stdout.trim());
      for (const pid of pids) {
        try {
          const text = fs.readFileSync(`/proc/${pid}/stat`, 'utf8');
          const fields = text.slice(text.lastIndexOf(')') + 2).split(' ');
          cpuSeconds += (Number(fields[11]) + Number(fields[12])) / hz;
          const status = fs.readFileSync(`/proc/${pid}/status`, 'utf8');
          rssBytes += Number(status.match(/^VmRSS:\s+(\d+)/m)?.[1] || 0) * 1024;
          const rollup = fs.readFileSync(`/proc/${pid}/smaps_rollup`, 'utf8');
          privateBytes += [...rollup.matchAll(/^Private_(?:Clean|Dirty):\s+(\d+)/gm)].reduce(
            (n, m) => n + Number(m[1]) * 1024,
            0,
          );
          processes++;
        } catch (error) {
          if (error.code !== 'ENOENT') throw error;
        }
      }
      // Node HTTP rendering does not use the VMware display device; no fabricated zero values.
      const adapters = fs.existsSync('/sys/class/drm')
        ? fs
            .readdirSync('/sys/class/drm')
            .filter((n) => /^card\d+$/.test(n))
            .map((n) => {
              const device = `/sys/class/drm/${n}/device`;
              return {
                card: n,
                driver: fs.existsSync(device + '/driver')
                  ? path.basename(fs.realpathSync(device + '/driver'))
                  : null,
              };
            })
        : [];
      return {
        cpuSeconds,
        rssBytes,
        privateBytes,
        processes,
        gpu: {
          available: false,
          utilizationPercent: null,
          dedicatedBytes: null,
          sharedBytes: null,
          adapters,
          reason:
            'No per-process GPU utilization/VRAM telemetry exposed by this Linux adapter; HTTP server CPU/RSS are measured separately.',
        },
      };
    },
    close() {
      helper?.stdin.end();
      helper?.kill();
      lines?.close();
    },
  };
}
async function gpuDeviceSample() {
  try {
    const { stdout } = await execute(
      'nvidia-smi',
      [
        '--query-gpu=name,utilization.gpu,memory.used,memory.total',
        '--format=csv,noheader,nounits',
      ],
      { windowsHide: true, timeout: 5000 },
    );
    return {
      available: true,
      scope: 'whole-device, includes other applications',
      devices: stdout
        .trim()
        .split('\n')
        .map((line) => {
          const [name, utilization, used, total] = line.split(',').map((s) => s.trim());
          return {
            name,
            utilizationPercent: /^\d+(\.\d+)?$/.test(utilization) ? Number(utilization) : null,
            usedBytes: /^\d+(\.\d+)?$/.test(used) ? Number(used) * 1024 ** 2 : null,
            totalBytes: /^\d+(\.\d+)?$/.test(total) ? Number(total) * 1024 ** 2 : null,
          };
        }),
    };
  } catch (error) {
    return {
      available: false,
      utilizationPercent: null,
      usedBytes: null,
      reason: error.code === 'ENOENT' ? 'nvidia-smi unavailable' : error.message,
    };
  }
}
module.exports = { processProbe, gpuDeviceSample };
