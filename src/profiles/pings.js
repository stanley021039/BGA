const { HttpError } = require('../http/errors');

const types = [
  'ping',
  'attention',
  'question',
  'help',
  'look',
  'angry',
  'sleep',
  'speechless',
  'surprised',
  'admire',
];
const voiceCues = [
  'amazing',
  'bad',
  'card-check',
  'sleep',
  'look',
  'legacy',
  'no-bluff',
  'cry',
  'coward',
  'goodnight',
  'senior',
  'practice',
  'huh',
  'what',
].map((name) => 'ping-voice-' + name);
const uuid = '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}';
const artworkPath = new RegExp('^/assets/artworks/(' + uuid + ')$', 'i');
const soundPath = new RegExp(
  '^/assets/characters/sounds/(' +
    uuid +
    ')/(happy|sad|surprised|thinking|angry|emote-' +
    uuid +
    ')(?:\\?v=[a-f0-9]{64})?$',
  'i',
);
function invalid() {
  throw new HttpError(400, 'INVALID_PING_PREFERENCE', '請選擇有權限使用的標記圖片或短音效');
}
function validate(db, userId, input, { lenient = false } = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    if (lenient) return {};
    invalid();
  }
  if (!lenient && Object.keys(input).some((key) => !types.includes(key))) invalid();
  const result = {};
  for (const type of types) {
    if (!Object.hasOwn(input, type)) continue;
    try {
      const choice = input[type];
      if (!choice || typeof choice !== 'object' || Array.isArray(choice)) invalid();
      const item = {};
      if (Object.hasOwn(choice, 'iconType')) {
        if (!types.includes(choice.iconType)) invalid();
        item.iconType = choice.iconType;
      }
      if (Object.hasOwn(choice, 'wheelSlot')) {
        if (!Number.isInteger(choice.wheelSlot) || choice.wheelSlot < 0 || choice.wheelSlot > 4)
          invalid();
        item.wheelSlot = choice.wheelSlot;
      }
      if (Object.hasOwn(choice, 'imageUrl')) {
        const match = typeof choice.imageUrl === 'string' && artworkPath.exec(choice.imageUrl);
        if (
          !match ||
          !db
            .prepare(
              'SELECT 1 FROM user_artworks a JOIN users u ON u.id=a.owner_id WHERE a.id=? AND u.disabled=0 AND (a.owner_id=? OR a.shared=1)',
            )
            .get(match[1], userId)
        )
          invalid();
        item.imageUrl = '/assets/artworks/' + match[1];
      }
      if (Object.hasOwn(choice, 'sound')) {
        const sound = choice.sound;
        if (sound === null) item.sound = null;
        else if (
          sound &&
          typeof sound === 'object' &&
          !Array.isArray(sound) &&
          (types.slice(0, 5).some((name) => sound.effect === 'ping-' + name) ||
            voiceCues.includes(sound.effect))
        ) {
          if (
            voiceCues.includes(sound.effect) &&
            !require('../achievements/bonus-rewards').ownedSounds(db, userId).includes(sound.effect)
          ) {
            if (!lenient)
              throw new HttpError(
                403,
                'PING_SOUND_LOCKED',
                '請先取得對應成就音效，或兌換 Ping 獎勵',
              );
          } else item.sound = { effect: sound.effect };
        } else {
          const match = typeof sound?.url === 'string' && soundPath.exec(sound.url);
          if (!match) invalid();
          const row = db
            .prepare(
              'SELECT s.duration_ms FROM character_sounds s JOIN player_characters c ON c.id=s.character_id JOIN users u ON u.id=c.owner_id WHERE c.id=? AND s.expression=? AND u.disabled=0 AND (c.owner_id=? OR c.shared=1)',
            )
            .get(match[1], match[2], userId);
          if (!row || row.duration_ms < 1 || row.duration_ms > 10000) invalid();
          item.sound = {
            url: `/assets/characters/sounds/${match[1]}/${match[2]}`,
            durationMs: row.duration_ms,
          };
        }
      }
      result[type] = item;
    } catch (error) {
      if (!lenient) throw error;
    }
  }
  const slots = Object.values(result)
    .filter((item) => item.wheelSlot !== undefined)
    .map((item) => item.wheelSlot);
  if (!lenient && slots.length && (slots.length !== 5 || new Set(slots).size !== 5)) invalid();
  return result;
}
module.exports = { types, validatePingPreferences: validate };
