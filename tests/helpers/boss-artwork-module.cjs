const ts = require('../../frontend/node_modules/typescript');
function removeImports(source) {
  const tree = ts.createSourceFile(
    'art.js',
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  for (const node of [...tree.statements].reverse())
    if (ts.isImportDeclaration(node))
      source = source.slice(0, node.getFullStart()) + source.slice(node.end);
  return source;
}
const fs = require('node:fs'),
  path = require('node:path');
module.exports = () =>
  'const createBossArtwork = (()=>{\nconst abilities=' +
  JSON.stringify(require('../../public/shared/boss-abilities.json')) +
  ';\n' +
  [
    '../engines/boss-geometry.js',
    'boss-warning-visibility.js',
    'boss-mouths.js',
    'boss-strike-art.js',
    'boss-artwork.js',
  ]
    .map((p) =>
      removeImports(
        fs.readFileSync(path.resolve(__dirname, '../../frontend/src/services', p), 'utf8'),
      ).replace(/^export /gm, ''),
    )
    .join('\n') +
  '\nreturn createBossArtwork;})();\n';
