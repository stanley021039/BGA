'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { readStatic } = require('./static-cache');

// Image URLs the server hands out carry their file's content version (?v=), so
// browsers keep them until the bytes change instead of revalidating on every
// page. Anything that is not an existing public image passes through unchanged.
const PUBLIC = path.join(__dirname, '..', '..', 'public');
const IMAGE = /^\/assets\/[A-Za-z0-9_./-]+\.(?:png|webp|svg|jpe?g|gif)$/i;

function versionedAsset(url) {
  if (typeof url !== 'string') return url;
  const [pathname, query = ''] = url.split('?');
  if (!IMAGE.test(pathname) || /(?:^|&)v=/.test(query)) return url;
  const file = path.join(PUBLIC, pathname);
  if (!file.startsWith(PUBLIC + path.sep) || !fs.existsSync(file)) return url;
  return pathname + '?' + (query ? query + '&' : '') + 'v=' + readStatic(file).version;
}
const assetPath = (url) => (typeof url === 'string' ? url.split('?')[0] : url);

module.exports = { versionedAsset, assetPath };
