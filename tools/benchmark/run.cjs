'use strict';
const fs = require('node:fs'),
  path = require('node:path'),
  os = require('node:os');
const { spawn } = require('node:child_process');
const readline = require('node:readline');
const { chromium } = require('playwright');
const { distribution, compare, harnessDigest, assertSourceStable } = require('./stats.cjs');
const { processProbe, gpuDeviceSample } = require('./telemetry.cjs');
function options(argv) {
  const allowed = [
    'root',
    'out',
    'baseline',
    'ssh',
    'fixture',
    'revision',
    'idle-ms',
    'waves',
    'interval-ms',
    'port',
    'max-regression',
    'test-db',
    'test-pid',
    'test-base',
  ];
  const result = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i].slice(2);
    if (
      !argv[i].startsWith('--') ||
      !allowed.includes(key) ||
      argv[i + 1] === undefined ||
      key in result
    )
      throw Error(
        'Usage: perf:benchmark [--root DIR] [--out FILE] [--baseline FILE] [--idle-ms 10000] [--waves 4] [--interval-ms 2500] [--max-regression PERCENT] [--ssh HOST --fixture REMOTE_FILE --port LOCAL_PORT]',
      );
    result[key] = argv[i + 1];
  }
  for (const [key, fallback, min, max] of [
    ['idle-ms', 10000, 5000, 120000],
    ['waves', 2, 2, 20],
    ['interval-ms', 2500, 2200, 10000],
    ['port', 33111, 1024, 65535],
    ['max-regression', 0, 0, 1000],
  ]) {
    result[key] = Number(result[key] ?? fallback);
    if (!Number.isInteger(result[key]) || result[key] < min || result[key] > max)
      throw Error('Invalid --' + key);
  }
  if (
    result.ssh &&
    (!/^[a-zA-Z0-9_.@-]+$/.test(result.ssh) ||
      result.ssh.startsWith('-') ||
      !result.fixture ||
      !result.root)
  )
    throw Error('SSH requires a host, --root and --fixture');
  if (result.revision && !/^[a-f0-9]{40}$/.test(result.revision))
    throw Error('--revision must be a full commit SHA');
  if (
    [result['test-db'], result['test-pid'], result['test-base']].some(Boolean) &&
    ![result['test-db'], result['test-pid'], result['test-base']].every(Boolean)
  )
    throw Error('Existing test mode needs --test-db, --test-pid and --test-base');
  if (result['max-regression'] && !result.baseline)
    throw Error('--max-regression requires --baseline');
  return result;
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const quote = (s) => "'" + String(s).replaceAll("'", "'\\''") + "'";
async function main() {
  const opt = options(process.argv.slice(2));
  const root = opt.root || path.resolve(__dirname, '../..');
  const fixtureArgs = [opt.fixture || path.join(__dirname, 'fixture.cjs'), '--root', root];
  if (opt.revision) fixtureArgs.push('--revision', opt.revision);
  for (const key of ['test-db', 'test-pid', 'test-base'])
    if (opt[key]) fixtureArgs.push('--' + key, opt[key]);
  const child = opt.ssh
    ? spawn(
        'ssh',
        [
          '-o',
          'BatchMode=yes',
          '-o',
          'ConnectTimeout=10',
          opt.ssh,
          ['node', ...fixtureArgs].map(quote).join(' '),
        ],
        { stdio: ['pipe', 'pipe', 'inherit'], windowsHide: true },
      )
    : spawn(process.execPath, fixtureArgs, {
        stdio: ['pipe', 'pipe', 'inherit'],
        windowsHide: true,
      });
  const pending = new Map();
  let nextId = 0,
    readyResolve,
    readyReject;
  const ready = new Promise((resolve, reject) => {
    readyResolve = resolve;
    readyReject = reject;
  });
  const lines = readline.createInterface({ input: child.stdout });
  lines.on('line', (line) => {
    try {
      const data = JSON.parse(line);
      if (data.type === 'ready') readyResolve(data);
      else if (pending.has(data.id)) {
        pending.get(data.id).resolve(data.metrics);
        pending.delete(data.id);
      }
    } catch {
      readyReject(Error('Invalid fixture protocol'));
    }
  });
  const command = (command) =>
    new Promise((resolve, reject) => {
      const id = ++nextId;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(Error('Fixture timeout'));
      }, 15000);
      pending.set(id, {
        resolve: (v) => {
          clearTimeout(timer);
          resolve(v);
        },
        reject: (e) => {
          clearTimeout(timer);
          reject(e);
        },
      });
      child.stdin.write(JSON.stringify({ id, command }) + '\n');
    });
  child.on('error', readyReject);
  child.on('exit', () => {
    readyReject(Error('Fixture exited before ready'));
    for (const p of pending.values()) p.reject(Error('Fixture exited'));
    pending.clear();
  });
  let tunnel, browser, report, clientProbe, resourceTimer;
  const clients = [];
  const readyTimer = setTimeout(() => readyReject(Error('Fixture startup timeout')), 30000);
  try {
    const info = await ready;
    clearTimeout(readyTimer);
    if (info.harnessDigest !== harnessDigest())
      throw Error('Client and server benchmark tools differ; synchronize the harness first');
    let base = info.base;
    if (opt.ssh) {
      tunnel = spawn(
        'ssh',
        [
          '-N',
          '-o',
          'BatchMode=yes',
          '-o',
          'ExitOnForwardFailure=yes',
          '-o',
          'ConnectTimeout=10',
          '-L',
          `127.0.0.1:${opt.port}:127.0.0.1:${new URL(base).port}`,
          opt.ssh,
        ],
        { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] },
      );
      let tunnelError;
      tunnel.on('error', (e) => {
        tunnelError = e;
      });
      let stderr = '';
      tunnel.stderr.on('data', (data) => {
        stderr += data;
      });
      base = `http://127.0.0.1:${opt.port}`;
      let connected = false,
        readinessError = '';
      for (let i = 0; i < 100; i++) {
        if (tunnelError || tunnel.exitCode !== null)
          throw Error(tunnelError?.message || stderr || 'SSH tunnel failed');
        try {
          const response = await fetch(base + '/api/version', { signal: AbortSignal.timeout(500) });
          if (response.ok) {
            connected = true;
            break;
          }
          readinessError = 'HTTP ' + response.status;
        } catch (error) {
          readinessError = error.message + ': ' + (error.cause?.code || '');
        }
        await sleep(100);
      }
      if (!connected) throw Error('SSH tunnel readiness timeout: ' + readinessError);
    }
    // Allow stale presence from the previous run to expire before cold-load accounting.
    const benchmarkIds = new Set(info.sessions.map((s) => s.id));
    let quiet = false;
    for (let attempt = 0; attempt < 25; attempt++) {
      const response = await fetch(base + '/api/lobby', {
        headers: { Cookie: 'ah-session=' + info.sessions[0].token },
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) throw Error('Test-site presence check failed: HTTP ' + response.status);
      const snapshot = await response.json();
      if (!(snapshot.visitors || []).some((v) => !benchmarkIds.has(v.id))) {
        quiet = true;
        break;
      }
      await sleep(1000);
    }
    if (!quiet)
      throw Error('Other users are active on the test site; cannot establish a ten-user baseline');
    browser = await chromium.launch({
      ...(process.env.BGA_CHROMIUM_PATH
        ? { executablePath: process.env.BGA_CHROMIUM_PATH }
        : process.platform === 'win32'
          ? { channel: 'chrome' }
          : {}),
      headless: true,
      args: [
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
        '--disable-backgrounding-occluded-windows',
      ],
    });
    const errors = [];
    clientProbe = processProbe();
    const browserCdp = await browser.newBrowserCDPSession();
    const systemInfo = await browserCdp.send('SystemInfo.getInfo');
    report = {
      schemaVersion: 1,
      at: new Date().toISOString(),
      revision: info.revision,
      sourceBefore: info.sourceIdentity,
      version: info.version,
      harness: { client: harnessDigest(), server: info.harnessDigest },
      browser: browser.version(),
      client: {
        platform: process.platform,
        node: process.version,
        cpus: os.cpus().length,
        cpu: os.cpus()[0].model,
        transport: opt.ssh ? 'ssh-loopback-forward' : 'loopback',
      },
      server: {
        node: info.node,
        platform: info.platform,
        cpus: info.cpus,
        target: info.target || 'disposable-fixture',
      },
      gpuAdapter: systemInfo.gpu.devices.map(
        ({ vendorId, deviceId, vendorString, deviceString, driverVersion }) => ({
          vendorId,
          deviceId,
          vendorString,
          deviceString,
          driverVersion,
        }),
      ),
      scenario: {
        id: 'lobby-ten-effects-v2',
        users: 10,
        viewport: { width: 1920, height: 1080 },
        motion: true,
        idleMs: opt['idle-ms'],
        waves: opt.waves,
        intervalMs: opt['interval-ms'],
        effects: ['barrage', 'beam'],
        input: 'authenticated-browser-fetch',
        cache: 'fresh-context-then-reload',
        telemetryIntervalMs: 2000,
      },
      loads: {},
      phases: {},
      errors,
      valid: false,
    };
    for (const session of info.sessions) {
      const context = await browser.newContext({
        viewport: report.scenario.viewport,
        reducedMotion: 'no-preference',
      });
      await context.addCookies([
        { name: 'ah-session', value: session.token, url: base, httpOnly: true, sameSite: 'Lax' },
      ]);
      await context.addInitScript(
        (ids) => {
          localStorage.setItem(
            'bga-entry-intro-settings',
            JSON.stringify({ version: 1, enabled: false }),
          );
          localStorage.setItem(
            'ah-motion-settings',
            JSON.stringify({ version: 1, enabled: true, barrages: true }),
          );
          const state = (window.__benchmark = {
            ids,
            incoming: {},
            rendered: {},
            frames: [],
            longTasks: [],
            visibilityChanges: 0,
            otherVisitorsPeak: 0,
            phase: '',
            previous: 0,
          });
          const original = window.fetch;
          window.fetch = async (...args) => {
            const response = await original(...args);
            const url = String(args[0] instanceof Request ? args[0].url : args[0]);
            if (/\/api\/lobby(?:[/?]|$)/.test(url)) {
              response
                .clone()
                .json()
                .then((data) => {
                  for (const event of data.attacks || []) state.incoming[event.id] ??= Date.now();
                  if (state.phase && Array.isArray(data.visitors))
                    state.otherVisitorsPeak = Math.max(
                      state.otherVisitorsPeak,
                      data.visitors.filter((v) => !state.ids.includes(v.id)).length,
                    );
                })
                .catch(() => {});
            }
            return response;
          };
          const observer = new MutationObserver(() => {
            for (const node of document.querySelectorAll('.lobby-attack[data-attack-id]')) {
              const id = node.dataset.attackId;
              const canvas = node.querySelector('canvas');
              if (
                !state.rendered[id] &&
                canvas?.width > 0 &&
                canvas.getBoundingClientRect().width > 0 &&
                !node.querySelector('.is-still')
              )
                state.rendered[id] = Date.now();
            }
          });
          observer.observe(document, { childList: true, subtree: true });
          try {
            new PerformanceObserver((list) => {
              if (state.phase) state.longTasks.push(...list.getEntries().map((e) => e.duration));
            }).observe({ type: 'longtask', buffered: false });
          } catch {}
          document.addEventListener('visibilitychange', () => {
            state.visibilityChanges++;
          });
          function frame(at) {
            if (state.phase && state.previous) state.frames.push(at - state.previous);
            state.previous = at;
            requestAnimationFrame(frame);
          }
          requestAnimationFrame(frame);
        },
        info.sessions.map((s) => s.id),
      );
      const page = await context.newPage();
      page.on('pageerror', (error) => errors.push({ type: 'page', message: error.message }));
      const cdp = await context.newCDPSession(page);
      await cdp.send('Network.enable');
      const records = new Map();
      let phase = 'cold';
      cdp.on('Network.requestWillBeSent', (event) => {
        if (!event.request.url.startsWith(base)) return;
        records.set(event.requestId, {
          phase,
          path: new URL(event.request.url).pathname,
          at: event.timestamp,
          status: 0,
          download: 0,
          upload: Buffer.byteLength(event.request.postData || ''),
          finished: false,
        });
      });
      cdp.on('Network.responseReceived', (event) => {
        const r = records.get(event.requestId);
        if (r) {
          r.status = event.response.status;
          r.cached = !!(event.response.fromDiskCache || event.response.fromServiceWorker);
        }
      });
      cdp.on('Network.responseReceivedExtraInfo', (event) => {
        const r = records.get(event.requestId);
        if (r && event.statusCode === 304) r.revalidated = true;
      });
      cdp.on('Network.dataReceived', (event) => {
        const r = records.get(event.requestId);
        if (r) r.download += event.encodedDataLength;
      });
      cdp.on('Network.loadingFinished', (event) => {
        const r = records.get(event.requestId);
        if (r) {
          r.download = event.encodedDataLength;
          r.latency = (event.timestamp - r.at) * 1000;
          r.finished = true;
        }
      });
      cdp.on('Network.loadingFailed', (event) => {
        const r = records.get(event.requestId);
        if (r && !event.canceled) {
          r.failed = event.errorText;
          errors.push({ type: 'network', path: r.path, message: event.errorText });
        }
      });
      clients.push({
        context,
        page,
        records,
        setPhase: (v) => {
          phase = v;
        },
      });
    }
    for (const phase of ['cold', 'warm']) {
      await Promise.all(
        clients.map(async (c) => {
          c.setPhase(phase);
          if (phase === 'cold') await c.page.goto(base, { waitUntil: 'load' });
          else await c.page.reload({ waitUntil: 'load' });
          await c.page.waitForFunction(
            () =>
              [...document.querySelectorAll('.lobby-visitors [data-ping-player]')].filter((n) =>
                window.__benchmark.ids.includes(n.dataset.pingPlayer),
              ).length === 10,
            null,
            { timeout: 20000 },
          );
          await c.page.waitForTimeout(2000);
        }),
      );
      const requests = clients.flatMap((c) =>
        [...c.records.values()].filter((r) => r.phase === phase),
      );
      report.loads[phase] = {
        downloadBytes: requests.reduce((n, r) => n + r.download, 0),
        requests: requests.length,
        cached: requests.filter((r) => r.cached).length,
        revalidated: requests.filter((r) => r.revalidated).length,
        loadMs: distribution(
          await Promise.all(
            clients.map((c) =>
              c.page.evaluate(() => performance.getEntriesByType('navigation')[0].loadEventEnd),
            ),
          ),
        ),
      };
    }
    const actions = [];
    for (const phase of ['idle', 'effects']) {
      const resourceSamples = [];
      async function takeResourceSample() {
        const processes = (await browserCdp.send('SystemInfo.getProcessInfo')).processInfo;
        const sampledAt = performance.now();
        const [memory, deviceGpu, server] = await Promise.all([
          clientProbe.sample(processes.map((p) => p.id)),
          gpuDeviceSample(),
          command('sample'),
        ]);
        resourceSamples.push({
          at: sampledAt,
          cpuSeconds: processes.reduce((n, p) => n + p.cpuTime, 0),
          memory,
          deviceGpu,
          server,
        });
      }
      await takeResourceSample();
      await command('reset');
      const start = performance.now();
      let resourceJob,
        stopped = false,
        telemetryError;
      resourceTimer = setInterval(() => {
        if (!resourceJob && !stopped)
          resourceJob = takeResourceSample()
            .catch((e) => {
              telemetryError = e;
            })
            .finally(() => {
              resourceJob = null;
            });
      }, 2000);
      for (const c of clients) c.setPhase(phase);
      await Promise.all(
        clients.map((c) =>
          c.page.evaluate((phase) => {
            const s = window.__benchmark;
            s.phase = phase;
            s.frames = [];
            s.longTasks = [];
            s.visibilityChanges = 0;
            s.otherVisitorsPeak = 0;
            s.previous = 0;
            s.incoming = {};
            s.rendered = {};
          }, phase),
        ),
      );
      if (phase === 'idle') await sleep(opt['idle-ms']);
      else {
        for (let wave = 0; wave < opt.waves; wave++) {
          const waveStart = performance.now();
          const batch = await Promise.all(
            clients.map((c, i) =>
              c.page.evaluate(
                async ({ wave, i }) => {
                  const at = Date.now();
                  const response = await fetch('/api/lobby/attack', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      requestId: crypto.randomUUID(),
                      aspectRatio: 1920 / 1080,
                      slot: wave % 2 ? 'e' : 'q',
                    }),
                  });
                  const data = await response.json();
                  const own = (data.attacks || []).filter((e) => e.fromId === data.selfId).at(-1);
                  const attack = {
                    at,
                    status: response.status,
                    code: data.error?.code || data.code,
                    eventId: response.ok ? own?.id : null,
                    client: i,
                  };
                  const movement = await fetch('/api/lobby/move', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      x: (i % 2 ? 75 : 15) + (wave % 2) * 3,
                      y: 40 + Math.floor(i / 2) * 5,
                    }),
                  });
                  const moveData = await movement.json();
                  return {
                    ...attack,
                    moveStatus: movement.status,
                    moveCode: moveData.error?.code || moveData.code,
                  };
                },
                { wave, i },
              ),
            ),
          );
          actions.push(...batch);
          await sleep(Math.max(0, opt['interval-ms'] - (performance.now() - waveStart)));
        }
        await sleep(1500);
      }
      const durationMs = performance.now() - start;
      for (const c of clients) c.setPhase('settle');
      stopped = true;
      clearInterval(resourceTimer);
      const serverJob = command('sample');
      const samples = await Promise.all(
        clients.map((c) =>
          c.page.evaluate(() => {
            const s = window.__benchmark;
            s.phase = '';
            const roster = [...document.querySelectorAll('.lobby-visitors [data-ping-player]')];
            return {
              frames: s.frames,
              longTasks: s.longTasks,
              incoming: s.incoming,
              rendered: s.rendered,
              hidden: document.hidden,
              visibilityChanges: s.visibilityChanges,
              otherVisitorsPeak: s.otherVisitorsPeak,
              roster: roster.length,
              benchmarkRoster: roster.filter((n) => s.ids.includes(n.dataset.pingPlayer)).length,
            };
          }),
        ),
      );
      await resourceJob;
      if (telemetryError) throw telemetryError;
      const server = await serverJob;
      server.cpuPercentOfMachine = server.cpuPercentOfOneCore / info.cpus;
      await takeResourceSample();
      const requests = clients.flatMap((c) =>
        [...c.records.values()].filter((r) => r.phase === phase),
      );
      const httpErrors = requests.filter((r) => r.status >= 400);
      const gameplay = (status, code) =>
        status === 409 && ['SCENE_RESPAWNING', 'NO_ATTACK_TARGET'].includes(code);
      const expectedGameplayRejections =
        phase === 'effects'
          ? actions.reduce(
              (n, a) =>
                n + Number(gameplay(a.status, a.code)) + Number(gameplay(a.moveStatus, a.moveCode)),
              0,
            )
          : 0;
      const value = (report.phases[phase] = {
        durationMs,
        requests: requests.length,
        downloadBytes: requests.reduce((n, r) => n + r.download, 0),
        uploadBodyBytes: requests.reduce((n, r) => n + r.upload, 0),
        apiLatencyMs: distribution(
          requests.filter((r) => r.path.startsWith('/api/') && r.finished).map((r) => r.latency),
        ),
        frameIntervalMs: distribution(samples.flatMap((s) => s.frames)),
        longTasks: {
          count: samples.reduce((n, s) => n + s.longTasks.length, 0),
          durationMs: samples.reduce((n, s) => n + s.longTasks.reduce((a, b) => a + b, 0), 0),
        },
        httpErrorCount: httpErrors.length,
        httpErrorRate: requests.length ? httpErrors.length / requests.length : 0,
        expectedGameplayRejections,
        unexpectedHttpErrorCount: httpErrors.length - expectedGameplayRejections,
        httpErrors: httpErrors.map(({ path, status }) => ({ path, status })),
        clients: samples.map((s) => ({
          hidden: s.hidden,
          roster: s.roster,
          benchmarkRoster: s.benchmarkRoster,
          visibilityChanges: s.visibilityChanges,
          otherVisitorsPeak: s.otherVisitorsPeak,
          frames: s.frames.length,
          renderedEffects: Object.keys(s.rendered).length,
        })),
        server,
      });
      const first = resourceSamples[0],
        last = resourceSamples.at(-1);
      value.resources = {
        scope:
          'Client Chrome process tree; CPU percent is relative to one logical core; summed RSS can double-count shared pages. Whole-device GPU samples include other applications.',
        client: {
          cpuPercentOfOneCore:
            ((last.cpuSeconds - first.cpuSeconds) * 100000) / (last.at - first.at),
          peakRssBytes: Math.max(...resourceSamples.map((s) => s.memory.rssBytes)),
          peakPrivateBytes: Math.max(...resourceSamples.map((s) => s.memory.privateBytes)),
          peakGpuDedicatedBytes: distribution(
            resourceSamples.map((s) => s.memory.gpu.dedicatedBytes),
          ).max,
          peakGpuSharedBytes: distribution(resourceSamples.map((s) => s.memory.gpu.sharedBytes))
            .max,
          gpu3DEnginePercent: distribution(
            resourceSamples
              .flatMap((s) => s.memory.gpu.engines || [])
              .filter((e) => e.engine.endsWith('_3D'))
              .map((e) => e.percent),
          ),
          wholeDeviceGpuPercent: distribution(
            resourceSamples
              .flatMap((s) => s.deviceGpu.devices || [])
              .map((d) => d.utilizationPercent),
          ),
        },
        samples: resourceSamples.map(({ at, ...s }) => ({ elapsedMs: at - first.at, ...s })),
      };
      value.resources.client.cpuPercentOfMachine =
        value.resources.client.cpuPercentOfOneCore / os.cpus().length;
      if (
        samples.some(
          (s) =>
            s.hidden ||
            s.visibilityChanges ||
            s.otherVisitorsPeak ||
            s.benchmarkRoster !== 10 ||
            s.frames.length < 10,
        )
      )
        errors.push({
          type: 'scenario',
          message: 'Ten visible active clients were not maintained',
        });
      if (phase === 'effects') {
        const accepted = actions.filter((a) => a.status === 200 && a.eventId);
        const deliveries = [],
          visuals = [];
        for (const action of accepted)
          for (const s of samples) {
            if (s.incoming[action.eventId]) deliveries.push(s.incoming[action.eventId] - action.at);
            if (s.rendered[action.eventId]) visuals.push(s.rendered[action.eventId] - action.at);
          }
        value.actions = {
          attempted: actions.length,
          accepted: accepted.length,
          rejected: actions.filter((a) => a.status !== 200),
          moveErrors: actions.filter((a) => a.moveStatus !== 200).length,
        };
        value.delivery = {
          expected: accepted.length * 10,
          observed: deliveries.length,
          ratio: accepted.length ? deliveries.length / (accepted.length * 10) : 0,
          latencyMs: distribution(deliveries),
        };
        value.visual = {
          observed: visuals.length,
          latencyMs: distribution(visuals),
          note: 'Display cap is 3 concurrent effects per client; not all accepted events must create DOM.',
        };
        if (
          new Set(accepted.map((a) => a.client)).size !== 10 ||
          value.delivery.ratio < 0.95 ||
          samples.some((s) => !Object.keys(s.rendered).length)
        )
          errors.push({
            type: 'scenario',
            message: 'Effects were not delivered/rendered on all ten clients',
          });
        if (
          actions.some(
            (a) =>
              (a.moveStatus !== 200 && !gameplay(a.moveStatus, a.moveCode)) ||
              (a.status !== 200 && !gameplay(a.status, a.code)),
          )
        )
          errors.push({
            type: 'action',
            message: 'Unexpected scheduled action rejection; inspect actions.rejected',
          });
      }
      if (value.unexpectedHttpErrorCount)
        errors.push({
          type: 'http',
          message: `${phase}: ${value.unexpectedHttpErrorCount} unexpected HTTP errors`,
        });
      if (phase === 'effects') {
        // Visual evidence is taken after the timed window so capture does not skew the metrics.
        for (const client of clients) {
          const ok = await client.page.evaluate(
            async () =>
              (
                await fetch('/api/lobby/attack', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    requestId: crypto.randomUUID(),
                    aspectRatio: 1920 / 1080,
                    slot: 'q',
                  }),
                })
              ).ok,
          );
          if (ok) break;
        }
        await sleep(650);
        const image =
          path.resolve(opt.out || 'work/benchmark/latest.json').replace(/\.json$/i, '') + '.png';
        fs.mkdirSync(path.dirname(image), { recursive: true });
        await clients[0].page.screenshot({ path: image });
      }
      console.log(
        `${phase}: API p95 ${value.apiLatencyMs.p95?.toFixed(1)} ms; ${(value.downloadBytes / 1024).toFixed(1)} KiB down; ${value.requests} requests`,
      );
    }
    report.sourceAfter = await command('identity');
    assertSourceStable(report.sourceBefore, report.sourceAfter);
    report.valid = errors.length === 0;
    if (opt.baseline)
      report.comparison = compare(JSON.parse(fs.readFileSync(opt.baseline, 'utf8')), report);
    if (
      opt['max-regression'] &&
      report.comparison?.some((r) => r.changePercent > opt['max-regression'])
    )
      report.regression = true;
    if (!report.valid || report.regression) process.exitCode = 1;
  } catch (error) {
    if (report) {
      report.valid = false;
      report.errors.push({ type: 'execution', message: error.message });
      report.failedRequests = clients.flatMap((c) =>
        [...c.records.values()]
          .filter((r) => r.status >= 400 || r.failed)
          .map(({ path, status, failed, phase }) => ({ path, status, failed, phase })),
      );
    }
    throw error;
  } finally {
    clearTimeout(readyTimer);
    clearInterval(resourceTimer);
    if (report) {
      const output = path.resolve(opt.out || 'work/benchmark/latest.json');
      fs.mkdirSync(path.dirname(output), { recursive: true });
      fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
      console.log('Report: ' + output);
    }
    await browser?.close();
    clientProbe?.close();
    tunnel?.kill();
    if (!child.killed) {
      child.stdin.end();
      const timer = setTimeout(() => child.kill(), 10000);
      await new Promise((resolve) =>
        child.exitCode !== null ? resolve() : child.once('exit', resolve),
      );
      clearTimeout(timer);
    }
    lines.close();
  }
}
if (require.main === module)
  main().catch((error) => {
    console.error(error.stack);
    process.exitCode = 1;
  });
module.exports = { options };
