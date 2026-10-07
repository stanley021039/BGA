const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { FORMAT } = require('./transfer');
const { noLinks, uuid, validBundleLogical } = require('./validation');

const defaults = Object.freeze({ maxBytes: 10 * 1024 ** 3, maxFiles: 20000, maxManifestBytes: 5 * 1024 ** 2, maxUploads: 4 });
function uploadError(code, message) { const error = Error(message); error.uiCode = code; return error; }
function inside(parent, file) { const relative = path.relative(parent, file); return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative)); }

function createUploadStore(options = {}) {
  const limits = { ...defaults, ...options };
  for (const [name, maximum] of Object.entries({ maxBytes: 1024 ** 4, maxFiles: 20000, maxManifestBytes: defaults.maxManifestBytes, maxUploads: defaults.maxUploads })) {
    if (!Number.isSafeInteger(limits[name]) || limits[name] < 1 || limits[name] > maximum) throw Error('Invalid upload limit: ' + name);
  }
  const parent = fs.realpathSync(os.tmpdir()), uploads = new Map();
  let root = null, storedBytes = 0;
  const totalLimit = limits.maxBytes + limits.maxUploads * (limits.maxManifestBytes + 32);
  function owned(directory) {
    if (!root || path.dirname(directory) !== root || !uuid.test(path.basename(directory))) throw Error('Invalid upload cleanup path');
    noLinks(root); noLinks(directory);
  }
  function get(id) {
    const entry = uploads.get(id);
    if (!entry) throw uploadError('UPLOAD_NOT_FOUND', 'This upload is no longer available; start a new upload');
    return entry;
  }
  function writable(entry) {
    if (entry.finished || entry.failed) throw uploadError('UPLOAD_CONFLICT', 'This upload is sealed or failed; delete it before starting again');
  }
  function parseManifest(file) {
    let manifest;
    try { manifest = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { throw uploadError('INVALID_UPLOAD', 'The manifest is not valid JSON'); }
    if (manifest?.format !== FORMAT || !uuid.test(manifest.bundleId) || !Array.isArray(manifest.files) || !manifest.files.length) throw uploadError('INVALID_UPLOAD', 'Select an Afterhours encrypted backup folder');
    if (manifest.files.length > limits.maxFiles) throw uploadError('UPLOAD_LIMIT', 'The backup contains too many payload files');
    const payloads = new Map(), logicals = new Set(); let bytes = 0;
    for (const entry of manifest.files) {
      const logical = entry?.logical;
      if (!validBundleLogical(logical) || typeof entry?.payload !== 'string' || !/^payload\/[0-9]{6}\.bin$/.test(entry.payload) || payloads.has(entry.payload) || logicals.has(logical.toLowerCase())) throw uploadError('INVALID_UPLOAD', 'The manifest contains invalid or duplicate file paths');
      if (!Number.isSafeInteger(entry.bytes) || entry.bytes < 0 || entry.bytes > limits.maxBytes - bytes) throw uploadError('UPLOAD_LIMIT', 'The backup exceeds the upload byte limit');
      bytes += entry.bytes; payloads.set(entry.payload, entry.bytes); logicals.add(logical.toLowerCase());
    }
    if (!logicals.has('db/afterhours.sqlite') || manifest.totalBytes !== bytes) throw uploadError('INVALID_UPLOAD', 'The manifest database or total byte count is invalid');
    return payloads;
  }
  async function receive(req, file, maximum, exact) {
    if (!/^application\/octet-stream(?:\s*;|$)/i.test(req.headers['content-type'] || '')) throw uploadError('INVALID_UPLOAD', 'Upload files as application/octet-stream');
    const declared = req.headers['content-length'];
    if (declared !== undefined && (!/^\d+$/.test(declared) || !Number.isSafeInteger(Number(declared)) || Number(declared) > maximum || (exact !== undefined && Number(declared) !== exact))) throw uploadError('UPLOAD_LIMIT', 'The uploaded file size does not match its allowed size');
    if (declared !== undefined && Number(declared) > totalLimit - storedBytes) throw uploadError('UPLOAD_LIMIT', 'Temporary uploads exceed the total byte limit; delete an earlier upload');
    const handle = await fs.promises.open(file, 'wx', 0o600); let bytes = 0, complete = false;
    try {
      // Keep the request readable on a limit error so the server can return a JSON error.
      for await (const chunk of req.iterator({ destroyOnReturn: false })) {
        if (chunk.length > maximum - bytes || chunk.length > totalLimit - storedBytes - bytes) throw uploadError('UPLOAD_LIMIT', 'The uploaded file exceeds its allowed byte limit');
        bytes += chunk.length; await handle.writeFile(chunk);
      }
      if (exact !== undefined && bytes !== exact) throw uploadError('UPLOAD_INCOMPLETE', 'The uploaded file is incomplete');
      await handle.sync(); complete = true;
    } finally {
      try { await handle.close(); }
      catch (error) { complete = false; throw error; }
      finally { if (!complete) { req.resume(); await fs.promises.unlink(file); } }
    }
    storedBytes += bytes;
    return bytes;
  }
  return {
    start() {
      if (uploads.size >= limits.maxUploads) throw uploadError('UPLOAD_LIMIT', 'Too many temporary uploads; delete an earlier upload');
      if (!root) { root = fs.mkdtempSync(path.join(parent, 'afterhours-ui-import-')); fs.chmodSync(root, 0o700); }
      const uploadId = crypto.randomUUID(), directory = path.join(root, uploadId), bundleDir = path.join(directory, 'bundle');
      fs.mkdirSync(directory, { mode: 0o700 }); fs.mkdirSync(bundleDir, { mode: 0o700 }); fs.mkdirSync(path.join(bundleDir, 'payload'), { mode: 0o700 });
      uploads.set(uploadId, { directory, bundleDir, keyFile: path.join(directory, 'backup.key'), files: new Map(), payloads: null, keyReceived: false, bytes: 0, finished: false, failed: false });
      return { uploadId };
    },
    async file(id, name, req) {
      const entry = get(id); writable(entry);
      if (typeof name !== 'string' || (name !== 'manifest.json' && !/^payload\/[0-9]{6}\.bin$/.test(name))) throw uploadError('INVALID_UPLOAD', 'Only manifest.json and its declared payload files can be uploaded');
      if (entry.files.has(name)) throw uploadError('UPLOAD_CONFLICT', 'An uploaded file cannot be overwritten');
      if (name !== 'manifest.json' && (!entry.payloads || !entry.payloads.has(name))) throw uploadError('INVALID_UPLOAD', 'Upload the manifest first, then only the payload files it declares');
      const file = path.join(entry.bundleDir, ...name.split('/'));
      try {
        const exact = name === 'manifest.json' ? undefined : entry.payloads.get(name);
        const bytes = await receive(req, file, exact ?? limits.maxManifestBytes, exact);
        entry.files.set(name, bytes); entry.bytes += bytes;
        if (name === 'manifest.json') entry.payloads = parseManifest(file);
        return { uploadId: id, path: name, bytes };
      } catch (error) { entry.failed = true; throw error; }
    },
    async key(id, req) {
      const entry = get(id); writable(entry);
      if (entry.keyReceived) throw uploadError('UPLOAD_CONFLICT', 'The uploaded key cannot be overwritten');
      try { await receive(req, entry.keyFile, 32, 32); entry.keyReceived = true; return { uploadId: id, keyReceived: true }; }
      catch (error) { entry.failed = true; throw error; }
    },
    async finish(id, executor) {
      const entry = get(id);
      if (entry.finished) return entry.result;
      writable(entry);
      if (!entry.payloads || !entry.keyReceived || entry.files.size !== entry.payloads.size + 1) throw uploadError('UPLOAD_INCOMPLETE', 'Upload the manifest, every payload file and the 32-byte key before verification');
      entry.verifying = true;
      try {
        const verification = await executor({ action: 'verify', bundleDir: entry.bundleDir, keyFile: entry.keyFile, maxBytes: limits.maxBytes });
        entry.finished = true;
        entry.result = { uploadId: id, bundleDir: entry.bundleDir, keyFile: entry.keyFile, files: entry.files.size, bytes: entry.bytes, verification };
        return entry.result;
      } catch (error) { entry.failed = true; throw error; }
      finally { entry.verifying = false; }
    },
    list() {
      return [...uploads].map(([uploadId, entry]) => ({ uploadId, status: entry.failed ? 'failed' : entry.finished ? 'verified' : entry.verifying ? 'verifying' : 'uploading', files: entry.files.size, bytes: entry.bytes, keyReceived: entry.keyReceived,
        ...(entry.finished ? { bundleDir: entry.bundleDir, keyFile: entry.keyFile, verification: entry.result.verification } : {}) }));
    },
    protectRequest(request) {
      const output = request.action === 'keygen' ? request.keyFile : request.action === 'export' ? request.outputDir : request.action === 'restore' ? request.destinationDir : null;
      if (root && typeof output === 'string' && inside(root, path.resolve(output))) throw uploadError('INVALID_REQUEST', 'Permanent keys, backups and restored generations must be outside temporary upload storage');
    },
    remove(id) {
      const entry = get(id); owned(entry.directory);
      fs.rmSync(entry.directory, { recursive: true, force: true, maxRetries: 5 });
      storedBytes -= entry.bytes + (entry.keyReceived ? 32 : 0); uploads.delete(id);
      return { uploadId: id, deleted: true };
    },
    close() {
      for (const id of uploads.keys()) this.remove(id);
      if (root) {
        if (path.dirname(root) !== parent || !path.basename(root).startsWith('afterhours-ui-import-')) throw Error('Invalid upload cleanup root');
        noLinks(root); fs.rmdirSync(root); root = null;
      }
    },
  };
}

module.exports = { createUploadStore };
