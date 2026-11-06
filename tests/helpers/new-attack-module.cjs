'use strict';
const fs = require('node:fs'),
  path = require('node:path');
module.exports = function newAttackModule() {
  const directory = path.resolve(__dirname, '../../frontend/src/services');
  return (
    'const createNewAttack = (()=>{\n' +
    'const rules = ' +
    JSON.stringify(require('../../public/shared/scene-rules.json')) +
    ';\n' +
    [
      'attack-revision.js',
      'attack-homing.js',
      'attack-new-draws.js',
      'attack-colossus.js',
      'attack-hero-draw.js',
      'attack-new.js',
    ]
      .map((name) =>
        fs
          .readFileSync(path.join(directory, name), 'utf8')
          .replace(/^import rules .*scene-rules\.json' with \{ type: 'json' \};\r?$/m, '')
          .replace(/^import\s+[\s\S]*?from\s+['"][^'"]+['"];?\r?$/gm, '')
          .replace(/^export \{[^\n]*\};?\r?$/gm, '')
          .replace(/^export function /gm, 'function '),
      )
      .join('\n') +
    '\nreturn createNewAttack;\n})();\n'
  );
};
