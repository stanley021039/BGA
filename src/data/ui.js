const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { run, safeError } = require('./transfer');

const assets = path.resolve(__dirname, '../../tools/data-transfer-ui');
const loopback = new Set(['127.0.0.1', '::ffff:127.0.0.1']);
const actions = new Set(['keygen', 'inspect', 'export', 'verify', 'restore']);
function uiError(code, message) { const error = Error(message); error.uiCode = code; return error; }
function json(res, status, body) {
  if (res.destroyed) return;
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(body));
}
async function readRequest(req) {
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) throw uiError('INVALID_REQUEST', 'Request must use application/json');
  const chunks = []; let bytes = 0, oversized = false;
  for await (const chunk of req) { bytes += chunk.length; if (bytes > 64 * 1024) { oversized = true; chunks.length = 0; } else if (!oversized) chunks.push(chunk); }
  if (oversized) throw uiError('INVALID_REQUEST', 'UI request exceeds 64 KiB');
  let input; try { input = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw uiError('INVALID_REQUEST', 'Request is not valid JSON'); }
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw uiError('INVALID_REQUEST', 'Request must be an object');
  return input;
}
function createTransferUi({ port = 3170, host, executor = run } = {}) {
  if (host !== undefined && host !== '127.0.0.1') throw Error('The data transfer UI only accepts 127.0.0.1');
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw Error('Invalid UI port');
  const token = crypto.randomBytes(32).toString('hex');
  let busy = false, action = null, lastResponse = null, activeJob = null, closing = false;
  const origin = () => 'http://127.0.0.1:' + server.address().port;
  const server = http.createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY'); res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    try {
      // Strict Host and Origin checks also fence DNS rebinding and cross-site requests.
      if (!loopback.has(req.socket.remoteAddress) || req.headers.host !== new URL(origin()).host || (req.headers.origin && req.headers.origin !== origin())) throw uiError('FORBIDDEN', 'Use the local URL printed by the tool');
      const url = new URL(req.url, origin());
      if (url.search || url.hash) throw uiError('INVALID_REQUEST', 'Query parameters are not accepted');
      if (req.method === 'GET' && ['/', '/app.js', '/style.css'].includes(url.pathname)) {
        const name = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
        let content = fs.readFileSync(path.join(assets, name));
        if (name === 'index.html') content = Buffer.from(content.toString('utf8').replace('@@TRANSFER_TOKEN@@', token));
        res.writeHead(200, { 'Content-Type': name.endsWith('.html') ? 'text/html; charset=utf-8' : name.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'text/css; charset=utf-8' }); res.end(content); return;
      }
      const supplied = req.headers['x-transfer-token'];
      if (typeof supplied !== 'string' || !/^[0-9a-f]{64}$/.test(supplied) || !crypto.timingSafeEqual(Buffer.from(supplied, 'hex'), Buffer.from(token, 'hex'))) throw uiError('FORBIDDEN', 'Open the local management page before making requests');
      if (req.method === 'GET' && url.pathname === '/api/state') { json(res, 200, { ok: true, result: { busy, action, lastResponse } }); return; }
      if (req.method !== 'POST' || url.pathname !== '/api/run') { json(res, 404, { ok: false, error: { code: 'NOT_FOUND', message: 'Unknown UI endpoint' } }); return; }
      if (req.headers.origin !== origin()) throw uiError('FORBIDDEN', 'Same-origin requests are required');
      const input = await readRequest(req), request = input.request;
      if (!request || typeof request !== 'object' || Array.isArray(request) || !actions.has(request.action)) throw uiError('INVALID_REQUEST', 'Choose a supported transfer action');
      if (['inspect', 'export'].includes(request.action) && (input.confirmations?.sourceStopped !== true || request.sourceStopped !== true)) throw uiError('PRECONDITION_REQUIRED', 'Confirm that every source writer has been stopped');
      if (request.action === 'restore' && request.apply === true && input.confirmations?.targetStopped !== true) throw uiError('PRECONDITION_REQUIRED', 'Confirm target writers are stopped before publishing a generation');
      if (closing) throw uiError('CLOSING', 'The local UI is shutting down');
      if (busy) throw uiError('BUSY', 'Another transfer operation is still running');
      busy = true; action = request.action;
      activeJob = (async () => {
        try { return { ok: true, result: await executor(request) }; }
        catch (error) { return { ok: false, error: safeError(error) }; }
      })();
      try { lastResponse = await activeJob; json(res, lastResponse.ok ? 200 : 400, lastResponse); }
      finally { busy = false; action = null; activeJob = null; }
    } catch (error) {
      const body = { ok: false, error: error.uiCode ? { code: error.uiCode, message: error.message } : safeError(error) };
      json(res, error.uiCode === 'FORBIDDEN' ? 403 : ['BUSY', 'CLOSING'].includes(error.uiCode) ? 409 : 400, body);
    }
  });
  server.requestTimeout = 15000; server.headersTimeout = 10000; server.keepAliveTimeout = 3000;
  return {
    server,
    async listen() {
      await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', () => { server.off('error', reject); resolve(); }); });
      return { url: origin(), host: '127.0.0.1', port: server.address().port };
    },
    async close() {
      closing = true;
      const job = activeJob;
      if (server.listening) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
      if (job) await job;
    },
  };
}
module.exports = { createTransferUi };
