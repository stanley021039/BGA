'use strict';
const crypto = require('node:crypto');
const fs = require('node:fs');

// Browser caching for static responses. setSecurityHeaders starts every response
// as no-store; HTML, APIs and game audio keep that.
const IMMUTABLE = 'public, max-age=31536000, immutable';
const PRIVATE_IMMUTABLE = 'private, max-age=31536000, immutable';
// Revalidated responses are private even for public files: Cloudflare raises a
// shorter browser TTL to the zone's Browser Cache TTL (4 h), which would keep
// stale shared scripts after a deploy, but leaves private responses alone.
const PRIVATE_REVALIDATE = 'private, no-cache';

const etagFor = (bytes) =>
  `"${crypto.createHash('sha256').update(bytes).digest('base64url').slice(0, 27)}"`;

function fresh(req, etag) {
  const header = req.headers['if-none-match'];
  return (
    typeof header === 'string' &&
    header.split(',').some((tag) => {
      tag = tag.trim();
      return tag === '*' || tag.replace(/^W\//, '') === etag;
    })
  );
}

// Answers 304 when the browser already holds these bytes. Callers check access
// first, so a revalidation never outlives a revoked session.
function sendCached(
  req,
  res,
  bytes,
  { cacheControl = PRIVATE_REVALIDATE, etag = etagFor(bytes) } = {},
) {
  res.setHeader('Cache-Control', cacheControl);
  res.setHeader('ETag', etag);
  if (fresh(req, etag)) {
    res.writeHead(304);
    return res.end();
  }
  res.setHeader('Content-Length', bytes.length);
  return res.end(bytes);
}

// Public files change only between releases; the stat check keeps local edits
// visible during development.
const files = new Map();
function readStatic(location) {
  const stat = fs.statSync(location),
    known = files.get(location);
  if (known && known.mtimeMs === stat.mtimeMs && known.size === stat.size) return known;
  const bytes = fs.readFileSync(location),
    entry = { bytes, etag: etagFor(bytes), mtimeMs: stat.mtimeMs, size: stat.size };
  files.set(location, entry);
  return entry;
}

function sendStatic(req, res, location, cacheControl = PRIVATE_REVALIDATE) {
  const { bytes, etag } = readStatic(location);
  return sendCached(req, res, bytes, { cacheControl, etag });
}

// Versioned media is immutable only while the URL names the bytes being sent.
function sendVersioned(req, res, bytes, versioned) {
  return sendCached(req, res, bytes, {
    cacheControl: versioned ? PRIVATE_IMMUTABLE : PRIVATE_REVALIDATE,
  });
}

module.exports = {
  IMMUTABLE,
  PRIVATE_IMMUTABLE,
  PRIVATE_REVALIDATE,
  etagFor,
  readStatic,
  sendCached,
  sendStatic,
  sendVersioned,
};
