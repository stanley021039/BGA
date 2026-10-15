'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const geometry = /^(?:display|position|inset(?:-.+)?|top|right|bottom|left|z-index|float|clear|box-sizing|(?:min-|max-)?(?:width|height|inline-size|block-size)|aspect-ratio|margin(?:-.+)?|padding(?:-.+)?|gap|row-gap|column-gap|grid(?:-.+)?|flex(?:-.+)?|order|align(?:-.+)?|justify(?:-.+)?|place(?:-.+)?|overflow(?:-.+)?|scroll(?:-.+)?|overscroll(?:-.+)?|object-(?:fit|position)|contain|content-visibility|visibility)$/;
const files = {
  'public/shared/stitch-tokens.css': 'tokens',
  'public/shared/stitch-skin.css': 'skin',
  'public/shared/stitch-composition.css': 'layout',
  'public/quacks-theme.css': 'theme',
  'public/quacks-layout.css': 'layout',
};
let failed = false;
for (const [file, owner] of Object.entries(files)) {
  const css = fs.readFileSync(path.join(root, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const declarations = [...css.matchAll(/(?:^|[;{}])\s*([\w-]+)\s*:/g)];
  for (const match of declarations) {
    const prop = match[1];
    const token = prop.startsWith('--');
    const invalid = owner === 'tokens' ? !token : owner === 'layout' ? !geometry.test(prop) : geometry.test(prop) || owner === 'skin' && token;
    if (invalid) {
      const line = css.slice(0, match.index).split('\n').length;
      console.error(`${file}:${line}: ${prop} belongs to another presentation owner`);
      failed = true;
    }
  }
}
if (failed) process.exitCode = 1;
else console.log('UI style ownership: tokens, skin and layout declarations are separated.');
