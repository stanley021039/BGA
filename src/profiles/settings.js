const { HttpError } = require('../http/errors');
const { defaults, selectedImage } = require('./appearance');
const { validatePingPreferences } = require('./pings');
const attackEffects = new Set(require('../../public/shared/attack-effects.json').map((e) => e.id));

function getAttackSettings(db, userId) {
  const saved = savedProfile(db, userId).attackLoadout;
  const owned = new Set(require('../achievements/attack-rewards').ownedAttacks(db, userId));
  return {
    q: owned.has(saved?.q) ? saved.q : 'barrage',
    e: owned.has(saved?.e) ? saved.e : 'beam',
  };
}
function setAttackSettings(db, userId, data) {
  if (
    !data ||
    typeof data !== 'object' ||
    Array.isArray(data) ||
    Object.keys(data).some((k) => !['q', 'e'].includes(k)) ||
    !attackEffects.has(data.q) ||
    !attackEffects.has(data.e)
  )
    throw new HttpError(400, 'INVALID_ATTACK_LOADOUT', '請選擇有效的 Q、E 攻擊特效');
  const owned = new Set(require('../achievements/attack-rewards').ownedAttacks(db, userId));
  if (!owned.has(data.q) || !owned.has(data.e))
    throw new HttpError(
      403,
      'ATTACK_REWARD_LOCKED',
      '此攻擊特效尚未解鎖，請完成對應成就或兌換其他獎勵',
    );
  db.prepare('UPDATE users SET appearance=? WHERE id=?').run(
    JSON.stringify({ ...savedProfile(db, userId), attackLoadout: { q: data.q, e: data.e } }),
    userId,
  );
  return getAttackSettings(db, userId);
}

function savedProfile(db, userId) {
  const row = db.prepare('SELECT appearance FROM users WHERE id=?').get(userId);
  try {
    return row?.appearance ? JSON.parse(row.appearance) : defaults;
  } catch {
    return defaults;
  }
}
function validAvatar(db, userId, value) {
  if (value?.kind === 'artwork' && typeof value.artworkId === 'string') {
    const row = db
      .prepare(
        'SELECT a.id,a.mime,a.bytes FROM user_artworks a JOIN users u ON u.id=a.owner_id WHERE a.id=? AND u.disabled=0 AND (a.owner_id=? OR a.shared=1)',
      )
      .get(value.artworkId, userId);
    if (!row) throw new HttpError(400, 'INVALID_AVATAR', '請選擇有權限使用的收藏圖片');
    return { avatar: { kind: 'artwork', artworkId: row.id }, content: row };
  }
  if (value?.kind === 'character') {
    const selection = selectedImage(db, userId, {
      version: 5,
      characterId: value.characterId,
      expression: value.expression,
    });
    return {
      avatar: {
        kind: 'character',
        characterId: selection.appearance.characterId,
        expression: selection.appearance.expression,
      },
      url: selection.url,
    };
  }
  throw new HttpError(400, 'INVALID_AVATAR', '頭像設定不正確');
}
function getProfileSettings(db, userId) {
  const saved = savedProfile(db, userId);
  let appearance;
  try {
    appearance = selectedImage(db, userId, saved).appearance;
  } catch {
    appearance = { ...defaults };
  }
  let selection;
  try {
    selection = validAvatar(db, userId, saved.avatar);
  } catch {
    selection = validAvatar(db, userId, { kind: 'character', ...appearance });
  }
  return {
    appearance,
    avatar: selection.avatar,
    avatarUrl: '/api/profile/avatar',
    pings: validatePingPreferences(db, userId, saved.pings, { lenient: true }),
  };
}
function setProfileSettings(db, userId, data) {
  const appearance = selectedImage(db, userId, data.appearance).appearance;
  const { avatar } = validAvatar(db, userId, data.avatar);
  const pings = validatePingPreferences(
    db,
    userId,
    data.pings === undefined ? savedProfile(db, userId).pings : data.pings,
    { lenient: data.pings === undefined },
  );
  db.prepare('UPDATE users SET appearance=? WHERE id=?').run(
    JSON.stringify({
      ...appearance,
      avatar,
      pings,
      attackLoadout: getAttackSettings(db, userId),
      ...(savedProfile(db, userId).starterRewardPack
        ? { starterRewardPack: savedProfile(db, userId).starterRewardPack }
        : {}),
      ...(savedProfile(db, userId).entryIntroTheme
        ? { entryIntroTheme: savedProfile(db, userId).entryIntroTheme }
        : {}),
      ...(savedProfile(db, userId).achievementRewardCodes
        ? { achievementRewardCodes: savedProfile(db, userId).achievementRewardCodes }
        : {}),
      ...(savedProfile(db, userId).achievementRewardCodeAt
        ? { achievementRewardCodeAt: savedProfile(db, userId).achievementRewardCodeAt }
        : {}),
      ...(savedProfile(db, userId).achievementResetAt
        ? { achievementResetAt: savedProfile(db, userId).achievementResetAt }
        : {}),
    }),
    userId,
  );
  return getProfileSettings(db, userId);
}
function avatarContent(db, userId) {
  return validAvatar(db, userId, getProfileSettings(db, userId).avatar);
}
function preserveAvatar(db, userId, appearance) {
  const {
    avatar,
    pings,
    achievementResetAt,
    entryIntroTheme,
    achievementRewardCodeAt,
    achievementRewardCodes,
    attackLoadout,
    starterRewardPack,
  } = savedProfile(db, userId);
  return {
    ...appearance,
    ...(avatar ? { avatar } : {}),
    ...(pings ? { pings } : {}),
    ...(attackLoadout ? { attackLoadout } : {}),
    ...(starterRewardPack ? { starterRewardPack } : {}),
    ...(entryIntroTheme ? { entryIntroTheme } : {}),
    ...(achievementResetAt ? { achievementResetAt } : {}),
    ...(achievementRewardCodeAt ? { achievementRewardCodeAt } : {}),
    ...(achievementRewardCodes ? { achievementRewardCodes } : {}),
  };
}
module.exports = {
  getProfileSettings,
  setProfileSettings,
  avatarContent,
  preserveAvatar,
  getAttackSettings,
  setAttackSettings,
};
