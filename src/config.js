const fs = require('node:fs'),
  path = require('node:path');
function loadEnv(file = path.join(__dirname, '..', '.env'), env = process.env) {
  if (!fs.existsSync(file)) return env;
  for (const [i, raw] of fs
    .readFileSync(file, 'utf8')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .entries()) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) throw Error(`Invalid .env line ${i + 1}`);
    let [, key, value] = match;
    if (value.startsWith('"') || value.startsWith("'")) {
      const quote = value[0],
        end = value.lastIndexOf(quote);
      if (end === 0 || !/^\s*(?:#.*)?$/.test(value.slice(end + 1)))
        throw Error(`Invalid .env quote at line ${i + 1}`);
      value = value.slice(1, end);
    } else value = value.replace(/\s+#.*$/, '').trim();
    if (env[key] === undefined) env[key] = value;
  }
  return env;
}
function settings(env = process.env) {
  if (
    env.COC_ADVENTURE_ENABLED !== undefined &&
    !['true', 'false'].includes(env.COC_ADVENTURE_ENABLED)
  )
    throw Error('COC_ADVENTURE_ENABLED must be true or false');
  if (env.COC_CLI_ENABLED !== undefined && !['true', 'false'].includes(env.COC_CLI_ENABLED))
    throw Error('COC_CLI_ENABLED must be true or false');
  if (env.COC_CLI_MODE !== undefined && !['native', 'ssh-worker'].includes(env.COC_CLI_MODE))
    throw Error('COC_CLI_MODE must be native or ssh-worker');
  const cocStationTokensPerDay = Number(env.COC_STATION_TOKENS_PER_DAY || 500000);
  if (
    !Number.isSafeInteger(cocStationTokensPerDay) ||
    cocStationTokensPerDay < 10000 ||
    cocStationTokensPerDay > 10000000
  )
    throw Error('COC_STATION_TOKENS_PER_DAY must be between 10000 and 10000000');
  const port = Number(env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw Error('PORT must be between 1 and 65535');
  let publicUrl = null;
  if (env.PUBLIC_URL?.trim()) {
    const u = new URL(env.PUBLIC_URL.trim());
    if (
      !['http:', 'https:'].includes(u.protocol) ||
      u.username ||
      u.password ||
      u.search ||
      u.hash ||
      u.pathname !== '/'
    )
      throw Error('PUBLIC_URL must be an HTTP(S) origin without credentials or a path');
    publicUrl = u.origin;
  }
  const dbFile = path.resolve(__dirname, '..', env.DB_FILE || 'data/afterhours.sqlite');
  const frontendEnabled = env.FRONTEND_ENABLED ?? 'false';
  if (!['true', 'false'].includes(frontendEnabled))
    throw Error('FRONTEND_ENABLED must be true or false');
  const external = env.EXTERNAL_SIDE_EFFECTS_ENABLED ?? 'true';
  if (!['true', 'false'].includes(external))
    throw Error('EXTERNAL_SIDE_EFFECTS_ENABLED must be true or false');
  const achievementPurpose = env.ACHIEVEMENT_PURPOSE ?? 'production';
  if (!['production', 'test', 'tutorial'].includes(achievementPurpose))
    throw Error('ACHIEVEMENT_PURPOSE must be production, test or tutorial');
  const marketAutomation = env.MARKET_AUTOMATION_ENABLED ?? 'true';
  if (!['true', 'false'].includes(marketAutomation))
    throw Error('MARKET_AUTOMATION_ENABLED must be true or false');
  return {
    cocAdventureEnabled: env.COC_ADVENTURE_ENABLED !== 'false',
    ...(env.FRONTEND_ROOT ? { frontendRoot: path.resolve(env.FRONTEND_ROOT) } : {}),
    cocAi: {
      openaiApiKey: env.OPENAI_API_KEY || '',
      anthropicApiKey: env.ANTHROPIC_API_KEY || '',
      openaiModel: env.COC_OPENAI_MODEL || '',
      anthropicModel: env.COC_ANTHROPIC_MODEL || '',
      cliEnabled: env.COC_CLI_ENABLED === 'true',
      cliToolsRoot: env.COC_CLI_TOOLS_ROOT || '',
      cliHome: env.COC_CLI_HOME || '',
      cliWorkRoot: env.COC_CLI_WORK_ROOT || '',
      cliModel: env.COC_CLI_MODEL || 'gpt-6.1-sol',
      cliMode: env.COC_CLI_MODE || 'native',
      cliQueueRoot: env.COC_CLI_QUEUE_ROOT || '',
      stationTokensPerDay: cocStationTokensPerDay,
    },
    frontendEnabled: frontendEnabled === 'true',
    achievementPurpose,
    port,
    host: env.HOST || '0.0.0.0',
    publicUrl,
    ffmpegPath: env.FFMPEG_PATH || 'ffmpeg',
    gameAudioDir: path.resolve(
      __dirname,
      '..',
      env.GAME_AUDIO_DIR || 'local-audio/audible-eight-second',
    ),
    communityDir: path.resolve(__dirname, '..', env.COMMUNITY_DIR || 'data/community'),
    dbFile,
    musicDir: env.MUSIC_DIR
      ? path.resolve(__dirname, '..', env.MUSIC_DIR)
      : path.join(path.dirname(dbFile), 'music'),
    externalSideEffectsEnabled: external === 'true',
    marketAutomationEnabled: marketAutomation === 'true',
    // Embedded apps and tests build thumbnails only when a size is requested.
    mediaThumbnailBackfill: true,
    expressionSoundMp3: true,
  };
}
module.exports = { loadEnv, settings };
