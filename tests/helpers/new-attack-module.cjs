'use strict';
const fs = require('node:fs'),
  path = require('node:path');
module.exports = function newAttackModule() {
  const directory = path.resolve(__dirname, '../../frontend/src/services');
  return (
    'const createNewAttack = (()=>{\n' +
    'const rules = ' +
    JSON.stringify(require('../../public/shared/scene-rules.json')) +
    ';\nconst timing = ' +
    JSON.stringify(require('../../public/shared/attack-timing.json')) +
    ';\n' +
    [
      'attack-revision.js',
      'attack-homing.js',
      'attack-new-draws.js',
      'attack-colossus.js',
      'hero-flight-path.js',
      'attack-hero-draw.js',
      'attack-ultimate-extra.js',
      'attack-single-ultimates.js',
      'attack-new.js',
    ]
      .map((name) =>
        fs
          .readFileSync(path.join(directory, name), 'utf8')
          .replace(/^import rules .*scene-rules\.json' with \{ type: 'json' \};\r?$/m, '')
          .replace(/^import\s+[\s\S]*?from\s+['"][^'"]+['"];?\r?$/gm, '')
          .replace(/^export \{[^\n]*\};?\r?$/gm, '')
          .replace(/^export (?=function |const )/gm, ''),
      )
      .join('\n') +
    '\nreturn createNewAttack;\n})();\n'
  );
};
