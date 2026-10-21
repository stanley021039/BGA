'use strict';
const path = require('node:path');
const { execFileSync } = require('node:child_process');

function extractArchive(archive, tree) {
  if (process.platform !== 'win32') {
    execFileSync('tar', ['-xmf', archive, '-C', tree], { stdio: 'inherit' });
    return;
  }
  // Git's MSYS tar treats drive letters as remote hosts, so use Windows bsdtar.
  // Older bsdtar builds need explicit UTF-8 decoding for non-ASCII Git archive
  // paths; newer runner images reject that option's conversion, so fall back.
  const command = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe');
  try {
    execFileSync(command, ['--options', 'hdrcharset=UTF-8', '-xmf', archive, '-C', tree], {
      stdio: 'inherit',
    });
  } catch {
    execFileSync(command, ['-xmf', archive, '-C', tree], { stdio: 'inherit' });
  }
}

module.exports = { extractArchive };
