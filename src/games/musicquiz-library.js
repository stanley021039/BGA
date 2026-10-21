'use strict';
// Future languages outside the named banks always share the foreign pool.
const BANK_ALIASES = Object.freeze({ th: 'foreign', es: 'foreign', vi: 'foreign' });
const CORE_BANKS = new Set(['zh', 'tw', 'jp', 'en', 'kr', 'yue', 'viral', 'classical', 'custom']);
function normalizeBank(bank) {
  return CORE_BANKS.has(bank) ? bank : 'foreign';
}
const CATALOG = Object.freeze(
  require('./musicquiz-songs.json').map((s) =>
    Object.freeze({ ...s, bank: normalizeBank(s.bank) }),
  ),
);
const BANKS = Object.freeze([
  { id: 'zh', label: '華語' },
  { id: 'tw', label: '台語' },
  { id: 'jp', label: '日語' },
  { id: 'kr', label: '韓語' },
  { id: 'yue', label: '粵語' },
  { id: 'viral', label: '抖音歌' },
  { id: 'classical', label: '古典' },
  { id: 'en', label: '英文' },
  { id: 'foreign', label: '外文' },
  { id: 'custom', label: '我的自選題庫' },
]);
function primaryArtist(artist) {
  const value = String(artist).trim();
  if (value === 'Simon & Garfunkel') return value;
  if (/^伍佰(?:\s|$)/.test(value)) return '伍佰';
  return value.split(/\s+(?:ft\.?|feat\.?|featuring|with)\s+|\s*[×、]\s*|\s+&\s+/i)[0].trim();
}
module.exports = { CATALOG, BANKS, primaryArtist, normalizeBank, BANK_ALIASES };
