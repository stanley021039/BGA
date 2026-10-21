'use strict';
const tar = require('tar');

function extractArchive(archive, tree) {
  // Decode Git's UTF-8 paths independently of Windows bsdtar's current locale.
  // Strict mode rejects corrupt archives and unsafe paths instead of silently
  // leaving an incomplete tree for the committed-content format check.
  tar.x({ file: archive, cwd: tree, sync: true, strict: true, noMtime: true });
}

module.exports = { extractArchive };
