const fs = require('node:fs'),
  path = require('node:path');
module.exports = () =>
  'const createBossArtwork = (()=>{\nconst abilities=' +
  JSON.stringify(require('../../public/shared/boss-abilities.json')) +
  ';\n' +
  ['../engines/boss-geometry.js', 'boss-artwork.js']
    .map((p) =>
      fs
        .readFileSync(path.resolve(__dirname, '../../frontend/src/services', p), 'utf8')
        .replace(/^import .*\r?\n/gm, '')
        .replace(/^export /gm, ''),
    )
    .join('\n') +
  '\nreturn createBossArtwork;})();\n';
