'use strict';
// Seven small deterministic PCM studies, built only for teaching the interface.
// Their year values are sorting exercises, not claims about music publication history.
const songs = Array.from({ length: 7 }, (_, i) => ({
  id: 'tutorial-melody-' + i,
  title: '教學旋律 ' + (i + 1),
  artist: '本站自製練習音',
  year: 1900 + i * 10,
  bank: 'custom',
  genres: ['自選'],
  aliases: [],
  artistAliases: [],
  aiGenerated: false,
  familiarity: 'familiar',
  videoId: 'tutorial00' + i,
  source: '本站自製旋律；年份僅供排序練習',
  introStart: 0,
  highlightStart: 0,
}));
const cache = new Map();
function clip(index, seconds = 8) {
  if (!Number.isInteger(index) || index < 0 || index >= songs.length)
    throw Error('Unknown tutorial melody');
  if (![8, 30].includes(seconds)) throw Error('Unknown tutorial duration');
  const key = index + ':' + seconds;
  if (cache.has(key)) return cache.get(key);
  const rate = 16000,
    n = rate * seconds,
    b = Buffer.alloc(44 + n * 2);
  b.write('RIFF');
  b.writeUInt32LE(b.length - 8, 4);
  b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write('data', 36);
  b.writeUInt32LE(n * 2, 40);
  const notes = [0, 2, 4, 7, 4, 2, 0, 4, 7, 9, 7, 0];
  for (let j = 0; j < n; j++) {
    const t = j / rate,
      p = t % 0.5,
      freq = (220 + index * 24) * 2 ** (notes[Math.floor(t / 0.5) % notes.length] / 12),
      env = Math.min(1, p / 0.02) * Math.max(0, 1 - p / 0.48);
    b.writeInt16LE(Math.round(6000 * env * Math.sin(2 * Math.PI * freq * p)), 44 + j * 2);
  }
  cache.set(key, b);
  return b;
}
module.exports = { songs, clip };
