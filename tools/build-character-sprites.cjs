const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sharp = require('sharp');
const expressions = ['neutral', 'happy', 'sad', 'surprised', 'thinking', 'angry'];
const hash = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
async function build(inputFile, root = path.resolve(__dirname, '..')) {
  const inputs = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
  const output = path.join(root, 'public/assets/characters');
  const archive = path.join(root, 'work/scene-bots-408/sources');
  fs.mkdirSync(archive, { recursive: true });
  const characters = [];
  for (const item of inputs) {
    if (!/^[a-z][a-z0-9-]{0,40}$/.test(item.id) || typeof item.name !== 'string')
      throw Error('Invalid character definition');
    const bytes = fs.readFileSync(item.path),
      meta = await sharp(bytes).metadata();
    if (!meta.hasAlpha || meta.width % 3 || meta.height % 2)
      throw Error('Expected transparent 3×2 sheet: ' + item.id);
    fs.writeFileSync(path.join(archive, item.id + '.png'), bytes);
    const w = meta.width / 3,
      h = meta.height / 2,
      cells = [];
    let minX = w,
      minY = h,
      maxX = 0,
      maxY = 0;
    for (let i = 0; i < 6; i++) {
      const cell = await sharp(bytes)
        .extract({ left: (i % 3) * w, top: Math.floor(i / 3) * h, width: w, height: h })
        .png()
        .toBuffer();
      const { data, info } = await sharp(cell)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++)
          if (data[(y * w + x) * info.channels + 3] > 16) {
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
          }
      cells.push(cell);
    }
    const bounds = {
      left: Math.max(0, minX - 4),
      top: Math.max(0, minY - 4),
      width: Math.min(w - 1, maxX + 4) - Math.max(0, minX - 4) + 1,
      height: Math.min(h - 1, maxY + 4) - Math.max(0, minY - 4) + 1,
    };
    const files = {};
    for (let i = 0; i < 6; i++) {
      const file = 'community-' + item.id + '-' + expressions[i] + '.webp';
      const result = await sharp(cells[i])
        .extract(bounds)
        .resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .webp({ quality: 88, alphaQuality: 100 })
        .toBuffer();
      if (result.length > 256 * 1024) throw Error('Image budget exceeded: ' + file);
      fs.writeFileSync(path.join(output, file), result);
      files[expressions[i]] = { file, bytes: result.length, sha256: hash(result) };
    }
    characters.push({
      id: 'builtin:community-' + item.id,
      name: item.name,
      source: 'ImageGen',
      sourceSha256: hash(bytes),
      sourceFile: path.basename(item.path),
      bounds,
      expressions: files,
    });
  }
  fs.writeFileSync(
    path.join(root, 'public/shared/character-additions.json'),
    JSON.stringify({ version: 1, characters }, null, 2) + '\n',
  );
  return characters;
}
if (require.main === module)
  build(process.argv[2])
    .then((rows) =>
      console.log(
        JSON.stringify({
          characters: rows.length,
          images: rows.length * 6,
          bytes: rows.reduce(
            (sum, c) => sum + Object.values(c.expressions).reduce((n, e) => n + e.bytes, 0),
            0,
          ),
        }),
      ),
    )
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    });
module.exports = { build };
