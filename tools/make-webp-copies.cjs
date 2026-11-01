'use strict';
// Writes a WebP copy next to each built-in image, as AGENTS.md "圖片交付" asks for
// fixed assets: `node tools/make-webp-copies.cjs [--width 200] [--lossless] <files…>`.
// With --width the copy is resized (never enlarged) and named `<name>-<width>.webp`;
// without it the copy keeps the size and is named `<name>.webp`. Existing copies are
// rewritten, so rerunning after the source changes is safe.
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

async function main(argv) {
  let width = null,
    lossless = false;
  const files = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--width') width = Number(argv[++i]);
    else if (argv[i] === '--lossless') lossless = true;
    else files.push(argv[i]);
  }
  if (width !== null && !(Number.isInteger(width) && width > 0))
    throw Error('--width must be a positive integer');
  if (!files.length) throw Error('Usage: make-webp-copies.cjs [--width N] [--lossless] <files…>');
  let before = 0,
    after = 0;
  for (const file of files) {
    // A WebP source only makes sense as a smaller copy.
    if (!(width ? /\.(png|jpe?g|gif|webp)$/i : /\.(png|jpe?g|gif)$/i).test(file))
      throw Error('Not a PNG, JPEG or GIF (or WebP with --width): ' + file);
    const base = file.replace(/\.[^.]+$/, ''),
      target = base + (width ? '-' + width : '') + '.webp';
    let image = sharp(file, { animated: /\.gif$/i.test(file) });
    if (width) image = image.resize({ width, withoutEnlargement: true });
    await image
      .webp(lossless ? { lossless: true, effort: 6 } : { quality: 82, effort: 6 })
      .toFile(target);
    before += fs.statSync(file).size;
    after += fs.statSync(target).size;
    console.log(path.relative(process.cwd(), target), fs.statSync(target).size);
  }
  console.log(`${files.length} files: ${before} -> ${after} bytes`);
}

main(process.argv.slice(2)).catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
