'use strict';
// Disposable WebP derivatives of character images and artworks, keyed by the
// original's content hash so identical uploads share one set. Originals and all
// permissions stay in SQLite; a missing derivative only costs a larger response.
const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const sharp = require('sharp');

const SIZES = Object.freeze([128, 256, 512]);
const NAME = /^([a-f0-9]{64})-(128|256|512)-v1\.(webp|same)$/;
const MAX_INPUT_PIXELS = 64 * 1024 * 1024;
const contentHash = (bytes) => createHash('sha256').update(bytes).digest('hex');

function thumbnailSize(value) {
  const size = Number(value);
  return SIZES.includes(size) ? size : null;
}

// Animated GIF/WebP stay animated; nothing is enlarged.
async function encodeThumbnail(bytes, size) {
  const { data } = await sharp(bytes, {
    animated: true,
    failOn: 'error',
    limitInputPixels: MAX_INPUT_PIXELS,
  })
    .resize({ width: size, height: size, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80, effort: 4 })
    .timeout({ seconds: 20 })
    .toBuffer({ resolveWithObject: true });
  return data;
}

class MediaThumbnails {
  constructor({ directory, encode = encodeThumbnail }) {
    this.directory = directory;
    this.encode = encode;
    // key -> 'webp' | 'same' (the original is already no larger than a thumbnail)
    this.known = new Map();
    this.loaded = null;
    this.pending = new Map();
    this.chain = Promise.resolve();
    this.stopped = false;
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
        if (match) this.known.set(`${match[1]}-${match[2]}`, match[3]);
      }
    })());
  }
  file(key, kind) {
    return path.join(this.directory, `${key}-v1.${kind}`);
  }
  // Returns the derivative, { same: true } when the original should be served,
  // or null while it is being prepared.
  async variant(bytes, size) {
    await this.load();
    const key = `${contentHash(bytes)}-${size}`,
      kind = this.known.get(key);
    if (kind === 'same') return { same: true };
    if (kind === 'webp') {
      try {
        return { bytes: await fs.readFile(this.file(key, 'webp')) };
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        this.known.delete(key);
      }
    }
    this.prepare(bytes, [size]);
    return null;
  }
  // Queues every missing size; work runs one image at a time.
  prepare(bytes, sizes = SIZES) {
    if (this.stopped) return Promise.resolve();
    const hash = contentHash(bytes),
      keys = sizes.map((size) => `${hash}-${size}`).filter((key) => !this.known.has(key)),
      missing = sizes.filter(
        (size) => !this.pending.has(`${hash}-${size}`) && !this.known.has(`${hash}-${size}`),
      );
    if (missing.length) {
      const job = this.chain.then(() => this.generate(hash, bytes, missing));
      // One failed write (e.g. the directory vanished) must not stall the queue.
      this.chain = job.catch(() => {});
      for (const size of missing) {
        const key = `${hash}-${size}`;
        this.pending.set(
          key,
          job.finally(() => this.pending.delete(key)),
        );
      }
    }
    return Promise.all(keys.map((key) => this.pending.get(key))).then(() => {});
  }
  async generate(hash, bytes, sizes) {
    await this.load();
    for (const size of sizes) {
      if (this.stopped) return;
      const key = `${hash}-${size}`;
      if (this.known.has(key)) continue;
      let encoded;
      try {
        encoded = await this.encode(bytes, size);
      } catch {
        // Undecodable or oversized input keeps being served as the original.
        encoded = bytes;
      }
      const kind = encoded.length < bytes.length ? 'webp' : 'same';
      await fs.mkdir(this.directory, { recursive: true, mode: 0o700 });
      const target = this.file(key, kind),
        temporary = `${target}.${randomUUID()}.tmp`;
      try {
        await fs.writeFile(temporary, kind === 'webp' ? encoded : '', { flag: 'wx', mode: 0o600 });
        await fs.rename(temporary, target);
      } finally {
        await fs.rm(temporary, { force: true });
      }
      this.known.set(key, kind);
    }
  }
  // Fills derivatives for every listed original without blocking requests.
  // Then removes derivatives of originals that no longer exist.
  async backfill(sources) {
    const started = Date.now(),
      live = new Set();
    for (const read of sources) {
      if (this.stopped) return;
      let bytes = null;
      try {
        bytes = read();
      } catch {
        // A row deleted or a file removed since listing is simply skipped.
      }
      if (bytes) {
        live.add(contentHash(bytes));
        await this.prepare(bytes).catch(() => {});
      }
      await new Promise((resolve) => setImmediate(resolve));
    }
    await this.prune(live, started);
  }
  async prune(live, since) {
    for (const [key, kind] of [...this.known]) {
      if (this.stopped) return;
      if (live.has(key.slice(0, 64)) || this.pending.has(key)) continue;
      const file = this.file(key, kind);
      // Uploaded after the source list was taken: not stale, just not listed.
      const stat = await fs.stat(file).catch(() => null);
      if (stat && stat.mtimeMs >= since) continue;
      await fs.rm(file, { force: true });
      this.known.delete(key);
    }
  }
  async stop() {
    this.stopped = true;
    await this.chain.catch(() => {});
  }
}

module.exports = { MediaThumbnails, SIZES, thumbnailSize, encodeThumbnail, contentHash };
