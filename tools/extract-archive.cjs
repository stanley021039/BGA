'use strict';
const path = require('node:path');
const { execFileSync } = require('node:child_process');

function extractArchive(archive, tree) {
  const windows = process.platform === 'win32';
  // Git's MSYS tar treats drive letters as remote hosts. Windows bsdtar needs
  // explicit UTF-8 decoding for Git archives containing non-ASCII filenames.
  const command = windows
    ? path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe')
    : 'tar';
  const options = windows ? ['--options', 'hdrcharset=UTF-8'] : [];
  execFileSync(command, [...options, '-xmf', archive, '-C', tree], { stdio: 'inherit' });
}

module.exports = { extractArchive };
