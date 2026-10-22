'use strict';
// Disposable 96 kbps mono MP3 copies of expression sounds, keyed by the WAV's
// content hash so identical uploads share one file. The validated WAV stays in
// SQLite as the original; without ffmpeg the WAV is simply served.
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { contentHash } = require('./thumbnails');

const NAME = /^([a-f0-9]{64})-mp3-v1\.(mp3|same)$/;

function encodeMp3(ffmpegPath, bytes) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      ffmpegPath,
      [
        '-hide_banner',
        '-loglevel',
        'error',
        '-i',
        'pipe:0',
        '-vn',
        '-ac',
        '1',
        '-b:a',
        '96k',
        '-f',
        'mp3',
        'pipe:1',
      ],
      { stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true },
    );
    const chunks = [],
      timer = setTimeout(() => child.kill('SIGKILL'), 20000);
    child.stdout.on('data', (chunk) => chunks.push(chunk));
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0 && chunks.length) resolve(Buffer.concat(chunks));
      else reject(Error('ffmpeg exited with ' + code));
    });
    child.stdin.on('error', () => {});
    child.stdin.end(bytes);
  });
}

class MediaAudio {
  constructor({
    directory,
    ffmpegPath = 'ffmpeg',
    encode = (bytes) => encodeMp3(ffmpegPath, bytes),
  }) {
    this.directory = directory;
    this.encode = encode;
    // hash -> 'mp3' | 'same'
    this.known = new Map();
    this.loaded = null;
    this.pending = new Map();
    this.chain = Promise.resolve();
    this.stopped = false;
    // Set when ffmpeg is missing; nothing is recorded, so installing it and
    // restarting converts everything.
    this.unavailable = false;
  }
  load() {
    return (this.loaded ||= (async () => {
      let names = [];
      try {
        names = await fs.readdir(this.directory);
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
      for (const name of names) {
        const match = name.match(NAME);
        if (match) this.known.set(match[1], match[2]);
      }
    })());
  }
  file(hash, kind) {
    return path.join(this.directory, `${hash}-mp3-v1.${kind}`);
  }
  // Returns the MP3, { same: true } when the WAV should be served (smaller, not
  // decodable, or no encoder), or null while it is being prepared.
  async variant(bytes) {
    await this.load();
    const hash = contentHash(bytes),
      kind = this.known.get(hash);
    if (kind === 'same' || this.unavailable) return { same: true };
    if (kind === 'mp3') {
      try {
        return { bytes: await fs.readFile(this.file(hash, 'mp3')) };
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        this.known.delete(hash);
      }
    }
    this.prepare(bytes);
    return null;
  }
  prepare(bytes) {
    if (this.stopped || this.unavailable) return Promise.resolve();
    const hash = contentHash(bytes);
    if (this.known.has(hash)) return Promise.resolve();
    if (!this.pending.has(hash)) {
      const job = this.chain.then(() => this.generate(hash, bytes));
      // One failed write (e.g. the directory vanished) must not stall the queue.
      this.chain = job.catch(() => {});
      this.pending.set(
        hash,
        job.finally(() => this.pending.delete(hash)),
      );
    }
    return this.pending.get(hash);
  }
  async generate(hash, bytes) {
    await this.load();
    if (this.stopped || this.unavailable || this.known.has(hash)) return;
    let encoded;
    try {
      encoded = await this.encode(bytes);
    } catch (error) {
      if (error.code === 'ENOENT') {
        this.unavailable = true;
        return;
      }
      encoded = bytes;
    }
    const kind = encoded.length < bytes.length ? 'mp3' : 'same';
    await fs.mkdir(this.directory, { recursive: true, mode: 0o700 });
    const target = this.file(hash, kind),
      temporary = `${target}.${randomUUID()}.tmp`;
    try {
      await fs.writeFile(temporary, kind === 'mp3' ? encoded : '', { flag: 'wx', mode: 0o600 });
      await fs.rename(temporary, target);
    } finally {
      await fs.rm(temporary, { force: true });
    }
    this.known.set(hash, kind);
  }
  // Converts every listed sound, then removes copies of deleted ones.
  async backfill(sources) {
    await this.load();
    const started = Date.now(),
      live = new Set();
    for (const read of sources) {
      if (this.stopped || this.unavailable) return;
      let bytes = null;
      try {
        bytes = read();
      } catch {
        // A row deleted since listing is simply skipped.
      }
      if (bytes) {
        live.add(contentHash(bytes));
        await this.prepare(bytes).catch(() => {});
      }
      await new Promise((resolve) => setImmediate(resolve));
    }
    for (const [hash, kind] of [...this.known]) {
      if (this.stopped) return;
      if (live.has(hash) || this.pending.has(hash)) continue;
      const file = this.file(hash, kind);
      const stat = await fs.stat(file).catch(() => null);
      if (stat && stat.mtimeMs >= started) continue;
      await fs.rm(file, { force: true });
      this.known.delete(hash);
    }
  }
  async stop() {
    this.stopped = true;
    await this.chain.catch(() => {});
  }
}

module.exports = { MediaAudio, encodeMp3 };
