const http = require('node:http'),
  fs = require('node:fs'),
  path = require('node:path'),
  os = require('node:os');
const { createHash, randomBytes, randomUUID } = require('node:crypto');
// Reviewed local vectors only; never resolve arbitrary SVG paths or uploaded SVGs.
const CRUEL_ASSETS = Object.fromEntries(
  require('./games/majority-cruel-catalog').CRUEL_QUESTIONS.flatMap((q) =>
    q.images.map((url) => [url, url.slice(1)]),
  ),
);
const TOURNAMENT_ART = Object.fromEntries([
  ...['work', 'home', 'friends', 'relationship', 'social', 'commute', 'shopping', 'powers'].map(
    (id) => [
      '/assets/majority-tournament/' + id + '.png',
      'assets/majority-tournament/' + id + '.png',
    ],
  ),
  ...require('./games/majority-scenarios').SCENARIO_ART.map((id) => [
    '/assets/majority-tournament/20261018/' + id + '.svg',
    'assets/majority-tournament/20261018/' + id + '.svg',
  ]),
]);
const FREEHAND_ASSETS = Object.freeze({
  ...CRUEL_ASSETS,
  '/assets/quacks/fortune-back.svg': 'assets/quacks/fortune-back.svg',
  '/assets/playful/game-quacks.svg': 'assets/playful/game-quacks.svg',
  '/assets/playful/game-bluff.svg': 'assets/playful/game-bluff.svg',
  '/assets/playful/game-musicquiz.svg': 'assets/playful/game-musicquiz.svg',
  '/assets/playful/game-minimal.svg': 'assets/playful/game-minimal.svg',
  '/assets/playful/game-telephone.svg': 'assets/playful/game-telephone.svg',
  '/assets/playful/game-trpg.svg': 'assets/playful/game-trpg.svg',
  '/assets/playful/lobby-room-light.svg': 'assets/playful/lobby-room-light.svg',
  '/assets/playful/lobby-room-dark.svg': 'assets/playful/lobby-room-dark.svg',
  '/assets/playful/game-poker.svg': 'assets/playful/game-poker.svg',
  '/assets/playful/game-thunder.svg': 'assets/playful/game-thunder.svg',
  '/assets/playful/game-majority.svg': 'assets/playful/game-majority.svg',
  '/assets/playful/game-gift.svg': 'assets/playful/game-gift.svg',
  '/assets/playful/game-draw.svg': 'assets/playful/game-draw.svg',
  '/assets/playful/game-market.svg': 'assets/playful/game-market.svg',
  '/assets/streamline-freehand/edit-pencil.svg': 'assets/streamline-freehand/edit-pencil.svg',
  '/assets/streamline-freehand/color-palette.svg': 'assets/streamline-freehand/color-palette.svg',
  '/assets/streamline-freehand/conversation-chat.svg':
    'assets/streamline-freehand/conversation-chat.svg',
  '/assets/streamline-freehand/business-management-team-up.svg':
    'assets/streamline-freehand/business-management-team-up.svg',
  '/assets/streamline-freehand/board-game-dice-pawn.svg':
    'assets/streamline-freehand/board-game-dice-pawn.svg',
  '/assets/streamline-freehand/card-game-card-spade.svg':
    'assets/streamline-freehand/card-game-card-spade.svg',
  '/assets/streamline-freehand/music-note-1.svg': 'assets/streamline-freehand/music-note-1.svg',
  '/assets/streamline-freehand/analytics-graph-stock.svg':
    'assets/streamline-freehand/analytics-graph-stock.svg',
  '/assets/streamline-freehand/home.svg': 'assets/streamline-freehand/home.svg',
  '/assets/streamline-freehand/time-clock-circle.svg':
    'assets/streamline-freehand/time-clock-circle.svg',
  '/assets/streamline-freehand/connect-flash.svg': 'assets/streamline-freehand/connect-flash.svg',
  '/assets/ui/gift.svg': 'assets/ui/gift.svg',
});
const { Room } = require('./games/poker'),
  { ThunderRoom } = require('./games/thunder'),
  { MajorityRoom } = require('./games/majority'),
  { GiftRoom } = require('./games/gift');
const { TrpgRoom } = require('./games/trpg');
const { QuacksRoom } = require('./games/quacks');
const { SecondWindRoom } = require('./games/second-wind/room');
const { CeoRoom } = require('./games/ceo-room');
const { BluffRoom } = require('./games/bluff');
const { TelephoneRoom } = require('./games/telephone');
const { MusicQuizRoom } = require('./games/musicquiz'),
  { MinimalRoom } = require('./games/minimal');
const { GiftStore } = require('./games/gift-store'),
  { GIFTS, CATEGORIES } = require('./games/gift-catalog');
const {
    DrawGuessRoom,
    readEnding,
    validTopic,
    validTopics,
    DRAW_CATEGORIES,
  } = require('./games/draw-guess'),
  { DrawWordStore } = require('./games/draw-guess-store'),
  { TOPICS } = require('./games/draw-guess-words');
const { AchievementStore } = require('./achievements/store');
const { MarketStore } = require('./market/store');
const { MarketAutomationStore, dateAt, closeAfter } = require('./market/automation-store');
const { validDate: validMarketDate } = require('../frontend/src/engines/market-rules.js').default;
const { MarketAutomation } = require('./market/automation');
const { createOfficialProvider } = require('./market/official-provider');
const { MarketImageStore } = require('./market/images');
const { CommunityStore } = require('./community/store');
const { createRoomRuntime } = require('./rooms/runtime');
const { createFrontend } = require('./http/frontend');
const { withEntryIntro } = require('./http/entry-intro');
const { createRoomTransitions } = require('./rooms/transitions');
const { createStateStream, stateTag } = require('./rooms/state-stream');
const roomPersistence = require('./rooms/persistence');
const { botSupport, addTestBot } = require('./ai');
const { reconnectPlayer } = require('./rooms/reconnect');
const { listRooms } = require('./rooms/listing');
const { rejoinPlayer } = require('./rooms/membership');
const { createLobby } = require('./rooms/lobby');
const { createRoomSpace } = require('./rooms/space');
const { createRoomInvitations } = require('./rooms/invitations');
const { createLobbyHandlers } = require('./http/lobby-routes');
const { HttpError, writeError } = require('./http/errors');
const { clientAddress, setSecurityHeaders } = require('./http/security');
const {
  PRIVATE_IMMUTABLE,
  PRIVATE_REVALIDATE,
  etagFor,
  readStatic,
  sendCached,
  sendStatic,
  sendVersioned,
} = require('./http/static-cache');
const { MediaThumbnails, thumbnailSize } = require('./media/thumbnails');
const { MediaAudio } = require('./media/audio');
const { openDatabase } = require('./db/index');
const { createAuth } = require('./auth/index');
const { BoardStore } = require('./community/board');
const { createGitHubClient } = require('./integrations/github/client');
const { SubmissionService } = require('./integrations/github/submissions');
const {
  expressionLabels,
  builtinCharacters,
  defaults,
  normalizeAppearance,
  characterFor,
  galleryFor,
  selectedImage,
} = require('./profiles/appearance');
const {
  createCharacter,
  setExpression,
  addExpression,
  editExpression,
  removeExpression,
  setSharing,
  removeCharacter,
  MAX_CHARACTER_IMAGE_BODY_BYTES,
} = require('./profiles/uploads');
const { setExpressionSound, removeExpressionSound } = require('./profiles/sounds');
const {
  USER_IMAGE_PATH,
  USER_SOUND_PATH,
  createCharacterMediaAccess,
} = require('./profiles/media');
const { ArtworkStore } = require('./artworks/store');
const { MusicStore, MAX_BYTES } = require('./music/store');
const { RoomMusic } = require('./music/room');
const { GameAudioLibrary } = require('./music/game-audio');
const { fallbackTitle } = require('./media/room');
const { createYoutubeTitleResolver } = require('./media/youtube-title');
const {
  roomRole,
  setRoomRole,
  pruneRoomRoles,
  permissionsView,
  assertCanStartGame,
} = require('./rooms/permissions');
const {
  getProfileSettings,
  setProfileSettings,
  avatarContent,
  preserveAvatar,
} = require('./profiles/settings');
const { ROOM_EMOJIS } = require('./social/emojis');
const { createChat } = require('./social/chat');
const { sendRoomMessage } = require('./social/room-message');
const { BUILTIN_FRAME_OPTIONS } = require('./barrage/builtins');
const { acquireDataLocks } = require('./data/locks');
const { version: applicationVersion } = require('../package.json');
function createApp(config) {
  const lock = acquireDataLocks(config);
  const acquired = [() => lock.release()];
  try {
    return initializeApp(config, lock, acquired);
  } catch (error) {
    const errors = [error];
    for (const release of acquired.reverse())
      try {
        release();
      } catch (cleanupError) {
        errors.push(cleanupError);
      }
    if (errors.length > 1) throw new AggregateError(errors, 'Application initialization failed');
    throw error;
  }
}
function initializeApp(config, dataLock, acquired) {
  const achievementPurpose =
    config.achievementPurpose === undefined ? 'production' : config.achievementPurpose;
  if (!['production', 'test', 'tutorial'].includes(achievementPurpose))
    throw Error('Invalid achievement purpose');
  const frontend = createFrontend({
    enabled: config.frontendEnabled === true,
    root: config.frontendRoot,
  });
  const runtime = createRoomRuntime();
  acquired.push(() => runtime.close());
  const {
    rooms,
    seats,
    kickedUsers,
    socialEvents,
    expressionEvents,
    barrageEvents,
    reconnectGrace,
    drawStreams,
    departedSeats,
    musicRooms,
    musicStreams,
    watchRooms,
    mediaRooms,
    cleanupRoom,
  } = runtime;
  const socialRate = new Map(),
    roomRate = new Map();
  const chat = createChat({ events: socialEvents });
  const publishDraw = (code, kind, payload) => {
    for (const entry of drawStreams.get(code) || [])
      try {
        entry.res.write('event: ' + kind + '\ndata: ' + JSON.stringify(payload) + '\n\n');
      } catch {
        entry.res.end();
      }
  };
  const youtubeTitles =
    config.youtubeTitleResolver ||
    createYoutubeTitleResolver({
      enabled: config.youtubeMetadataEnabled ?? config.externalSideEffectsEnabled !== false,
      fetcher: config.youtubeMetadataFetch || fetch,
    });
  acquired.push(() => youtubeTitles.clear?.());
  const watchContext = (room) => {
    const activeSeats = new Set(seats.get(room.code)?.values() || []);
    return {
      hostId: room.host,
      members: room.players
        .filter((player) => activeSeats.has(player.id) && !player.bot && !player.kicked)
        .map((player) => ({ id: player.id, name: player.name, lastSeen: player.lastSeen })),
    };
  };
  const reconcileWatch = (room) => {
    const watch = watchRooms.get(room);
    if (watch) watch.reconcile(watchContext(room));
    return watch;
  };
  const roomMusic = (room) => {
    if (!musicRooms.has(room.code)) musicRooms.set(room.code, new RoomMusic(Date.now, musicStore));
    return musicRooms.get(room.code);
  };
  const activeRoomIds = (room) =>
    new Set(
      [...(seats.get(room.code) || [])]
        .filter(
          ([account, id]) =>
            db.prepare('SELECT 1 FROM users WHERE id=? AND disabled=0').get(account) &&
            room.players.some((player) => player.id === id && !player.bot && !player.kicked),
        )
        .map(([, id]) => id),
    );
  const mediaContext = (room) => {
    const activeIds = activeRoomIds(room);
    pruneRoomRoles(room, activeIds);
    return {
      hostId: room.host,
      managerIds: room.managerIds,
      members: room.players
        .filter((player) => activeIds.has(player.id))
        .map((player) => ({ id: player.id, name: player.name })),
    };
  };
  const clearLegacyWatch = (room) => {
    const watch = watchRooms.get(room);
    if (!watch?.video && !watch?.proposals.length) return;
    watch.video = null;
    watch.controllerId = null;
    watch.selectedById = null;
    watch.proposals = [];
    watch.watchSessionId = randomUUID();
    watch.controllerEpoch++;
    watch.revision++;
    watch.playback = { state: 'paused', anchorPositionSec: 0, anchorServerMs: Date.now(), rate: 1 };
  };
  const musicProjection = (room) => {
    const media = mediaRooms.get(room);
    if (!media?.managed) return roomMusic(room).snapshot();
    return {
      track:
        media.current?.type === 'music'
          ? {
              id: media.current.trackId,
              title: media.current.title,
              duration: media.current.durationSec,
            }
          : null,
      playing: media.current?.type === 'music' && media.playback.state === 'playing',
      position: media.current?.type === 'music' ? media.position() : 0,
      loop: false,
      mode: 'none',
      version: media.revision,
      serverNow: Date.now(),
      managedBy: 'room-media',
    };
  };
  const watchProjection = (room, playerId) => {
    const media = mediaRooms.get(room),
      context = mediaContext(room);
    return {
      schemaVersion: 1,
      roomInstanceId: media.roomInstanceId,
      watchSessionId: media.playbackSessionId,
      revision: media.revision,
      controllerEpoch: media.revision,
      controllerId: room.host,
      controllerName: context.members.find((member) => member.id === room.host)?.name || null,
      selectedById: media.current?.requestedById || null,
      video:
        media.current?.type === 'video'
          ? { provider: 'youtube', id: media.current.videoId, title: media.current.title }
          : null,
      playback:
        media.current?.type === 'video'
          ? { ...media.playback }
          : { state: 'paused', anchorPositionSec: 0, anchorServerMs: Date.now(), rate: 1 },
      serverNowMs: Date.now(),
      proposals: [],
      canControl: false,
      isHost: room.host === playerId,
      managedBy: 'room-media',
    };
  };
  const activateMedia = (room) => {
    const media = mediaRooms.get(room, { create: true });
    if (media.managed) return media;
    const context = mediaContext(room),
      watch = reconcileWatch(room),
      music = musicRooms.get(room.code)?.snapshot();
    const requester = watch?.video ? watch.selectedById : musicRooms.get(room.code)?.selectedById;
    const member =
      context.members.find((item) => item.id === requester) ||
      context.members.find((item) => item.id === room.host) ||
      context.members[0];
    if (watch?.video)
      media.adopt(
        { type: 'video', videoId: watch.video.id },
        { state: watch.playback.state, position: watch.position() },
        member,
      );
    else if (music?.track)
      media.adopt(
        { type: 'music', trackId: music.track.id },
        { state: music.playing ? 'playing' : 'paused', position: music.position },
        member,
      );
    else media.adopt(null, null, member);
    for (const proposal of watch?.proposals || []) {
      const author = context.members.find((item) => item.id === proposal.proposerId);
      if (author)
        media.queue.push(media.makeItem({ type: 'video', videoId: proposal.videoId }, author));
    }
    clearLegacyWatch(room);
    if (musicRooms.get(room.code)?.track) roomMusic(room).act('stop', {}, musicStore);
    media.reconcile(context);
    publishMusic(room.code);
    return media;
  };
  const publishMusic = (code) => {
    const room = rooms.get(code),
      state = room ? musicProjection(room) : null;
    for (const entry of musicStreams.get(code) || [])
      try {
        entry.res.write('event: music\ndata: ' + JSON.stringify(state) + '\n\n');
      } catch {
        entry.res.end();
      }
  };
  const authorCombatBonus = (userId) =>
    !!userId && !!require('./achievements/redemption').redeemedAt(db, userId, 'other');
  const lobby = createLobby(
    undefined,
    (userId) => portraitUrl(userId),
    undefined,
    authorCombatBonus,
  );
  const roomSpace = createRoomSpace(undefined, undefined, (playerId, room) => {
    // Room seats use game-local IDs, never trust client-supplied account IDs.
    const account = [...(seats.get(room.code) || [])].find(([, seatId]) => seatId === playerId);
    return authorCombatBonus(account?.[0]);
  });
  const lobbyPingRoom = { code: '__LOBBY__', type: 'lobby', phase: 'lobby', players: [] };
  const expireRooms = () => runtime.expireRooms();
  const gameAudio = new GameAudioLibrary(
    config.gameAudioDir || path.join(path.dirname(config.dbFile), 'game-audio'),
  );
  const fullAudio = new (require('./music/game-audio-full').GameAudioFull)(gameAudio, {
    ffmpegPath: config.ffmpegPath,
    run: config.gameAudioProcessor,
  });
  const withSocial = (room, view) => {
    view = gameAudio.decorate(room, view);
    const social = socialEvents.get(room.code) || [],
      now = Date.now(),
      expressions = (expressionEvents.get(room.code) || []).filter(
        (event) => now - event.at < 5000,
      ),
      barrages = (barrageEvents.get(room.code) || []).filter((event) => now - event.at < 8000),
      recent = new Map();
    for (const event of expressions) recent.set(event.playerId, event.image);
    const accounts = new Map(
      [...(seats.get(room.code) || [])].map(([userId, playerId]) => [playerId, userId]),
    );
    const viewerId = accounts.get(view.me);
    const savedDrawResults =
      room.type === 'draw' && viewerId
        ? {
            savedResultIds: [...room.publicResults.entries()]
              .filter(([, entry]) => {
                const id = entry.artworks.get(viewerId);
                return id && artworkStore.owned(viewerId, id);
              })
              .map(([id]) => id),
          }
        : {};
    if (viewerId)
      characterMedia.rememberExpressions(
        viewerId,
        'room:' + room.code,
        expressions.map((event) => ({
          userId: accounts.get(event.playerId),
          image: event.image,
          at: event.at,
          until: event.at + 5000,
          sound: event.sound,
          soundUntil: event.at + 10000,
        })),
      );
    const watch = reconcileWatch(room);
    const media = mediaRooms.get(room, { create: true });
    media.reconcile(mediaContext(room));
    return {
      ...view,
      ...savedDrawResults,
      roomSpace: roomSpace.view(room, view.me, view.players, expressions),
      pingContext: runtime.pings.context(room),
      serverNow: now,
      botSupport: botSupport(room),
      permissions: permissionsView(room, view.me),
      players: view.players.map((player) => ({
        ...player,
        roomRole: roomRole(room, player.id),
        ...(recent.has(player.id) ? { avatar: recent.get(player.id) } : {}),
      })),
      social,
      expressions,
      barrages,
      media: media.marker(),
      watch: media.managed
        ? {
            roomInstanceId: media.roomInstanceId,
            revision: media.revision,
            hasVideo: media.current?.type === 'video',
            controllerId: room.host,
          }
        : watch
          ? watch.summary(watchContext(room))
          : null,
    };
  };
  const resumeSeat = (room, user) => reconnectPlayer(room, user.id, seats, reconnectGrace);
  let community,
    db,
    auth,
    board,
    submissions,
    giftStore,
    drawWordStore,
    achievementStore,
    artworkStore,
    musicStore,
    marketStore,
    marketImageStore,
    marketAutomationStore,
    marketAutomation;
  community = new CommunityStore(config.communityDir);
  db = openDatabase(config.dbFile);
  acquired.push(() => db.close());
  auth = createAuth(db, { secureCookies: config.publicUrl?.startsWith('https://') });
  marketStore = new MarketStore(db, config.marketClock || Date.now);
  marketAutomationStore = new MarketAutomationStore(db, marketStore, {
    clock: config.marketClock || Date.now,
    enabled: config.externalSideEffectsEnabled === true && config.marketAutomationEnabled !== false,
  });
  marketAutomation = new MarketAutomation(marketAutomationStore, {
    clock: config.marketClock || Date.now,
    provider:
      config.marketProvider || createOfficialProvider({ clock: config.marketClock || Date.now }),
  });
  marketImageStore = new MarketImageStore(db, config.marketClock || Date.now, {
    limits: config.marketImageLimits,
    thumbnailDirectory: config.dbFile + '.market-thumbnails',
  });
  board = new BoardStore(db, community.data.issues);
  giftStore = new GiftStore(db);
  drawWordStore = new DrawWordStore(db);
  achievementStore = new AchievementStore(db);
  artworkStore = new ArtworkStore(db);
  musicStore = new MusicStore(
    db,
    config.musicDir || path.join(path.dirname(config.dbFile), 'music'),
  );
  submissions = new SubmissionService(
    db,
    board,
    config.githubClient ||
      createGitHubClient({
        token: config.githubToken ?? process.env.GITHUB_TOKEN,
        baseUrl: config.githubApiBase ?? process.env.GITHUB_API_BASE,
      }),
    { enabled: config.externalSideEffectsEnabled !== false },
  );
  const roomInvitations = createRoomInvitations({
    rooms,
    seats,
    kickedUsers,
    readUser: (id) =>
      db.prepare('SELECT id,display_name FROM users WHERE id=? AND disabled=0').get(id),
    validSession: (hash) =>
      !!db
        .prepare(
          'SELECT 1 FROM sessions JOIN users ON users.id=sessions.user_id WHERE token_hash=? AND revoked_at IS NULL AND expires_at>? AND users.disabled=0',
        )
        .get(hash, new Date().toISOString()),
  });
  acquired.push(() => roomInvitations.close());
  function joinRoom(room, user, req) {
    if (kickedUsers.get(room.code)?.has(user.id))
      throw new HttpError(403, 'KICKED', '你已被房主踢出房間');
    const previous = seats.get(room.code)?.get(user.id);
    if (previous) {
      resumeSeat(room, user);
      return { code: room.code, type: room.type || 'poker' };
    }
    limitRate(roomRate, 'join:' + user.id, 30);
    limitRate(roomRate, 'join-ip:' + clientKey(req), 120);
    if ((kickedUsers.get(room.code)?.size || 0) >= 256)
      throw new HttpError(429, 'ROOM_RECORD_LIMIT', '這間房的離席紀錄已達上限，請建立新房間');
    const departed = departedSeats.get(room.code);
    if (departed)
      for (const [account, id] of departed)
        if (!room.players.some((p) => p.id === id)) departed.delete(account);
    const p = transitions.transact(
      room,
      { action: 'join', source: 'player', name: user.display_name },
      () => {
        const player =
          rejoinPlayer(room, departed?.get(user.id), user.display_name) ||
          room.add(user.display_name);
        player.name = user.display_name;
        return player;
      },
    );
    departed?.delete(user.id);
    p.avatar = portraitUrl(user.id);
    seats.get(room.code).set(user.id, p.id);
    return { code: room.code, type: room.type || 'poker' };
  }
  mediaRooms.store = musicStore;
  const characterMedia = createCharacterMediaAccess(db, (viewerId) => {
    const audiences = [];
    for (const [code, room] of rooms) {
      const members = new Map(
        [...(seats.get(code) || [])].filter(
          ([userId, playerId]) =>
            !kickedUsers.get(code)?.has(userId) &&
            room.players.some((player) => player.id === playerId && !player.kicked && !player.bot),
        ),
      );
      if (!members.has(viewerId)) continue;
      const accounts = new Map([...members].map(([userId, playerId]) => [playerId, userId]));
      audiences.push({
        id: 'room:' + code,
        userIds: new Set(members.keys()),
        expressions: (expressionEvents.get(code) || []).map((event) => ({
          userId: accounts.get(event.playerId),
          image: event.image,
          at: event.at,
          until: event.at + 5000,
          sound: event.sound,
          soundUntil: event.at + 10000,
        })),
      });
    }
    const lobbyAudience = lobby.mediaAudience(viewerId);
    if (lobbyAudience) audiences.push(lobbyAudience);
    return audiences;
  });
  // A portrait URL names its bytes so browsers may keep it. A stale version still
  // serves the current image, just without the immutable cache.
  function portrait(viewerId, userId) {
    const selected = characterMedia.avatar(userId);
    if (!selected) throw new HttpError(404, 'CHARACTER_NOT_FOUND', '找不到角色外觀');
    let bytes, mime, etag;
    if (USER_IMAGE_PATH.test(selected.url)) {
      const row = characterMedia.image(viewerId, selected.url);
      if (!row) throw new HttpError(404, 'IMAGE_NOT_FOUND', '找不到角色圖片');
      bytes = row.bytes;
      mime = row.mime;
      etag = etagFor(row.bytes);
    } else {
      ({ bytes, etag } = readStatic(path.join(__dirname, '..', 'public', selected.url)));
      mime = selected.url.endsWith('.gif') ? 'image/gif' : 'image/png';
    }
    const version = createHash('sha256')
      .update(selected.url)
      .update(etag)
      .digest('base64url')
      .slice(0, 16);
    return { bytes, mime, version };
  }
  // Lobby views are built on every poll, so versions are memoized. Any profile or
  // admin change may alter anyone's portrait (shared characters, disabled
  // owners), so each one drops the memo and re-versions every seat.
  const portraitVersions = new Map();
  function portraitUrl(userId) {
    if (!portraitVersions.has(userId)) {
      let version = null;
      try {
        version = portrait(userId, userId).version;
      } catch (error) {
        if (!(error instanceof HttpError)) throw error;
      }
      portraitVersions.set(userId, version);
    }
    const version = portraitVersions.get(userId);
    return `/characters/${userId}?` + (version ? `v=${version}&` : '') + 'size=256';
  }
  const mediaThumbnails = new MediaThumbnails({
      directory: config.dbFile + '.media-thumbnails',
    }),
    mediaAudio = new MediaAudio({
      directory: config.dbFile + '.media-audio',
      ffmpegPath: config.ffmpegPath,
    });
  // Expression sounds are sent as MP3 once converted (production only). While
  // a conversion is pending the WAV is sent, never cached under the URL.
  async function sendSound(req, res, url, { bytes, mime }) {
    const versioned = url.searchParams.has('v'),
      mp3 = config.expressionSoundMp3 ? await mediaAudio.variant(bytes) : { same: true };
    res.setHeader('Content-Security-Policy', "default-src 'none'");
    if (mp3?.bytes) {
      res.setHeader('Content-Type', 'audio/mpeg');
      return sendVersioned(req, res, mp3.bytes, versioned);
    }
    res.setHeader('Content-Type', mime);
    if (!mp3) return sendCached(req, res, bytes, { cacheControl: PRIVATE_REVALIDATE });
    return sendVersioned(req, res, bytes, versioned);
  }
  function soundSources() {
    const sound = db.prepare(
      'SELECT bytes FROM character_sounds WHERE character_id=? AND expression=?',
    );
    return db
      .prepare('SELECT character_id,expression FROM character_sounds')
      .all()
      .map((row) => () => sound.get(row.character_id, row.expression)?.bytes);
  }
  // Serves an image, or its WebP thumbnail when ?size= asks for one. While a
  // thumbnail is being prepared the original is sent, never cached as the size.
  async function sendImage(req, res, url, { bytes, mime }, versioned) {
    const cacheControl = versioned ? PRIVATE_IMMUTABLE : PRIVATE_REVALIDATE,
      size = thumbnailSize(url.searchParams.get('size')),
      sized = size ? await mediaThumbnails.variant(bytes, size) : null;
    res.setHeader('Content-Security-Policy', "default-src 'none'");
    if (sized?.bytes) {
      res.setHeader('Content-Type', 'image/webp');
      return sendCached(req, res, sized.bytes, { cacheControl });
    }
    res.setHeader('Content-Type', mime);
    return sendCached(req, res, bytes, {
      cacheControl: size && !sized ? PRIVATE_REVALIDATE : cacheControl,
    });
  }
  // Production pre-builds every thumbnail at start and after each upload, so
  // only the first viewer of a brand-new image waits on the original.
  function thumbnailSources() {
    const image = db.prepare(
        'SELECT bytes FROM character_images WHERE character_id=? AND expression=?',
      ),
      artwork = db.prepare('SELECT bytes FROM user_artworks WHERE id=?');
    return [
      ...[...new Set(builtinCharacters.flatMap((c) => Object.values(c.expressions)))].map(
        (file) => () => readStatic(path.join(__dirname, '..', 'public', file)).bytes,
      ),
      ...db
        .prepare('SELECT character_id,expression FROM character_images')
        .all()
        .map((row) => () => image.get(row.character_id, row.expression)?.bytes),
      ...db
        .prepare('SELECT id FROM user_artworks')
        .all()
        .map((row) => () => artwork.get(row.id)?.bytes),
    ];
  }
  let thumbnailBackfill = null,
    thumbnailRerun = false;
  function refreshThumbnails() {
    if (!config.mediaThumbnailBackfill || closed) return;
    if (thumbnailBackfill) {
      thumbnailRerun = true;
      return;
    }
    thumbnailBackfill = mediaThumbnails
      .backfill(thumbnailSources())
      .then(() => config.expressionSoundMp3 && mediaAudio.backfill(soundSources()))
      .catch(() => {})
      .finally(() => {
        thumbnailBackfill = null;
        if (thumbnailRerun) {
          thumbnailRerun = false;
          refreshThumbnails();
        }
      });
  }
  function refreshPortraits() {
    portraitVersions.clear();
    for (const room of rooms.values())
      for (const [accountId, playerId] of seats.get(room.code) || []) {
        const player = room.players.find((p) => p.id === playerId);
        if (player?.avatar?.startsWith('/characters/')) player.avatar = portraitUrl(accountId);
      }
  }
  const withLobbyMedia = (user, view) => {
    const serverNow = Date.now();
    lobbyPingRoom.players = view.visitors;
    characterMedia.rememberExpressions(
      user.id,
      'lobby',
      view.visitors
        .filter((visitor) => visitor.emote)
        .map((visitor) => ({ userId: visitor.id, ...visitor.emote })),
    );
    return { ...view, serverNow, pingContext: runtime.pings.context(lobbyPingRoom) };
  };
  const communityRate = new Map(),
    accountRate = new Map(),
    authRate = new Map();
  const trustCloudflare = config.host === '127.0.0.1' && config.publicUrl?.startsWith('https://');
  const clientKey = (req) => clientAddress(req, trustCloudflare);
  const achievementWarnings = new WeakSet(),
    legacyAchievementResults = new WeakSet(),
    pendingAchievementUnits = new Map();
  const retryAchievementUnits = () => {
    for (const [id, entry] of pendingAchievementUnits) {
      try {
        if (entry.matchResult) {
          achievementStore.recordMatch(entry.matchResult, { purpose: achievementPurpose });
          legacyAchievementResults.add(entry.matchResult);
        } else if (entry.quacksResult) {
          achievementStore.recordQuacksResult(entry.quacksResult, { purpose: achievementPurpose });
          legacyAchievementResults.add(entry.quacksResult);
        } else if (entry.legacyResult) {
          achievementStore.recordUnit(entry.facts);
          legacyAchievementResults.add(entry.legacyResult);
        } else {
          achievementStore.processUnit(entry.facts);
          entry.room.acknowledgeAchievementUnit(id);
        }
        pendingAchievementUnits.delete(id);
      } catch (error) {
        if (!achievementWarnings.has(entry.room)) {
          achievementWarnings.add(entry.room);
          console.error('Achievement update failed:', error);
        }
      }
    }
  };
  const collectAchievementUnits = (room) => {
    for (const facts of room.pendingAchievementUnits?.() || []) {
      if (!pendingAchievementUnits.has(facts.unit_event_id))
        pendingAchievementUnits.set(facts.unit_event_id, {
          room,
          facts: { ...facts, purpose: achievementPurpose },
        });
    }
    retryAchievementUnits();
  };
  const freezeAchievementParticipants = (room, seatIds) => {
    const accounts = new Map(
      [...(seats.get(room.code) || [])].map(([userId, seatId]) => [seatId, userId]),
    );
    return Object.freeze(
      seatIds.flatMap((seatId) => {
        const userId = accounts.get(seatId),
          player = room.players.find((item) => item.id === seatId);
        return userId &&
          player &&
          !player.bot &&
          !player.kicked &&
          db.prepare('SELECT 1 FROM users WHERE id=? AND disabled=0').get(userId)
          ? [Object.freeze({ user_id: userId, seat_id: seatId })]
          : [];
      }),
    );
  };
  const attachAchievementHooks = (room) => {
    require('./achievements/match-tracker').attachMatchAchievements(room);
    Object.defineProperties(room, {
      achievementUnitStart: {
        value: (descriptor) => freezeAchievementParticipants(room, descriptor.participantSeatIds),
      },
      achievementUnitCompleted: { value: () => collectAchievementUnits(room) },
    });
    if (!room.type || room.type === 'thunder') {
      Object.defineProperties(room, {
        achievementMatchId: { value: null, writable: true },
        achievementParticipants: { value: Object.freeze([]), writable: true },
      });
      const start = room.start;
      Object.defineProperty(room, 'start', {
        configurable: true,
        value: function (...args) {
          const previous = {
            id: this.achievementMatchId,
            participants: this.achievementParticipants,
            phase: this.phase,
          };
          this.achievementMatchId = randomUUID();
          this.achievementParticipants = freezeAchievementParticipants(
            this,
            this.players.map((player) => player.id),
          );
          try {
            return start.apply(this, args);
          } catch (error) {
            if (this.phase === previous.phase) {
              this.achievementMatchId = previous.id;
              this.achievementParticipants = previous.participants;
            }
            throw error;
          }
        },
      });
    }
  };
  const awardRoomAchievements = (room) => {
    try {
      collectAchievementUnits(room);
      room.matchAchievements?.finish();
      const matchResult = room.matchAchievements?.completed;
      if (matchResult && !legacyAchievementResults.has(matchResult)) {
        pendingAchievementUnits.set(matchResult.id, { room, matchResult });
        retryAchievementUnits();
      }
      const quacksResult = room.type === 'quacks' && room.quacksAchievements?.completed;
      if (quacksResult && !legacyAchievementResults.has(quacksResult)) {
        pendingAchievementUnits.set(quacksResult.id, { room, quacksResult });
        retryAchievementUnits();
      }
      const frozenSeats = room.achievementParticipants
        ? new Map(room.achievementParticipants.map((item) => [item.user_id, item.seat_id]))
        : seats.get(room.code);
      const legacyResult =
        !room.type && room.phase === 'showdown' && room.hand && room.results?.length
          ? room.results
          : room.type === 'thunder' && room.phase === 'finished'
            ? room.winner
            : null;
      if (legacyResult && !legacyAchievementResults.has(legacyResult)) {
        const facts = achievementStore.legacyUnit(
          room,
          frozenSeats,
          room.type || 'poker',
          legacyResult,
          { purpose: achievementPurpose },
        );
        pendingAchievementUnits.set(facts.unit_event_id, { room, facts, legacyResult });
        retryAchievementUnits();
      }
    } catch (error) {
      if (!achievementWarnings.has(room)) {
        achievementWarnings.add(room);
        console.error('Achievement update failed:', error);
      }
    }
  };
  // Store-backed providers a room needs, whether new or restored after a restart.
  function equipRoomProviders(room) {
    const type = room.type || 'poker';
    if (type === 'bluff')
      Object.defineProperties(room, {
        questionExclusionProvider: { value: (id) => community.bluffBanned(id) },
        questionBanWriter: { value: (id, audit) => community.banBluff(id, audit) },
      });
    if (type === 'majority')
      Object.defineProperty(room, 'questionProvider', { value: () => community.data.questions });
    if (type === 'gift')
      Object.defineProperty(room, 'giftProvider', { value: () => giftStore.list() });
    if (type === 'draw')
      Object.defineProperties(room, {
        wordProvider: { value: () => drawWordStore.list() },
        wordExclusionProvider: { value: (word) => drawWordStore.isExcluded(word) },
        wordBanWriter: { value: (word, audit) => drawWordStore.ban(word, audit) },
      });
  }
  // Open rooms survive restarts and deploys (#235): saved on close, restored
  // before the scheduler starts. A room that cannot be restored is ended in
  // isolation instead of blocking startup.
  const roomClasses = {
    poker: Room,
    thunder: ThunderRoom,
    majority: MajorityRoom,
    gift: GiftRoom,
    trpg: TrpgRoom,
    quacks: QuacksRoom,
    bluff: BluffRoom,
    telephone: TelephoneRoom,
    musicquiz: MusicQuizRoom,
    minimal: MinimalRoom,
    draw: DrawGuessRoom,
  };
  const roomsFile = config.roomsFile || config.dbFile + '.rooms';
  const TIMER_KEY = /^(deadline|.+At|.+Until)$/;
  // Timers that were running keep their remaining time across the downtime.
  function shiftTimers(value, delta, savedAt, depth = 0) {
    if (!value || typeof value !== 'object' || depth > 2) return;
    for (const key of Object.keys(value)) {
      const item = value[key];
      if (
        TIMER_KEY.test(key) &&
        typeof item === 'number' &&
        item > savedAt &&
        item < savedAt + 7 * 86400000
      )
        value[key] = item + delta;
      else if (item && typeof item === 'object' && !Array.isArray(item))
        shiftTimers(item, delta, savedAt, depth + 1);
    }
  }
  // Shared player and watch-together state carry the room's instance ids, which
  // pages use to tell a restored room from a replaced one. Their store is the app's.
  const roomSideData = (object) =>
    object ? Object.fromEntries(Object.entries(object).filter(([key]) => key !== 'store')) : null;
  function saveRooms() {
    const saved = [];
    for (const room of rooms.values()) {
      if (!room.players?.some((p) => !p.bot && !p.kicked)) continue;
      try {
        const captured = roomPersistence.captureRoom(room, {
          match: room.matchAchievements?.snapshot?.() || null,
          seats: seats.get(room.code) || null,
          departed: departedSeats.get(room.code) || null,
          kicked: kickedUsers.get(room.code) || null,
          social: socialEvents.get(room.code) || null,
          media: roomSideData(mediaRooms.get(room)),
          watch: roomSideData(watchRooms.get(room)),
        });
        // A room waiting on a callback (e.g. an open dice roll) cannot resume after
        // a restart; it ends as it did before rooms were kept.
        if (captured.callbacks.length)
          console.warn(
            'Room ' + room.code + ' not saved; pending callbacks: ' + captured.callbacks.join(', '),
          );
        else saved.push(captured);
      } catch (error) {
        console.error('Room ' + room.code + ' could not be saved:', error);
      }
    }
    const codes = new Set(saved.map((room) => room.code));
    const grace = [...reconnectGrace].filter(([key]) => codes.has(key.split(':')[0]));
    if (saved.length) roomPersistence.save(roomsFile, { rooms: saved, grace });
    else fs.rmSync(roomsFile, { force: true });
  }
  // Only a server that took over the saved rooms may replace or remove them; one
  // that failed to start (port in use) must leave them for the next attempt.
  let ownsSavedRooms = false;
  function restoreRooms() {
    ownsSavedRooms = true;
    let snapshot;
    try {
      snapshot = roomPersistence.load(roomsFile);
    } catch (error) {
      console.error('Saved rooms could not be read:', error);
      return;
    }
    if (!snapshot) return;
    const now = Date.now(),
      delta = Math.max(0, now - snapshot.savedAt);
    let restored = 0;
    for (const saved of snapshot.rooms || []) {
      const Type = roomClasses[saved.type];
      if (!Type || rooms.has(saved.code)) continue;
      // Snapshots written before callbacks were checked (2.42.6–2.44.1) may hold a
      // thunder room whose open dice roll lost its callbacks; it cannot resume.
      if (!Array.isArray(saved.callbacks) && saved.data?.get('_diceRoll')?.value) {
        console.warn(
          'Room ' + saved.code + ' not restored; its dice roll was saved without callbacks',
        );
        continue;
      }
      let room = null;
      try {
        const result = roomPersistence.restoreRoom(saved, () => {
          room = new Type(saved.code, saved.name);
          equipRoomProviders(room);
          attachAchievementHooks(room);
          return room;
        });
        const extra = result.extra || {};
        shiftTimers(room, delta, snapshot.savedAt);
        for (const player of room.players) if (!player.bot) player.lastSeen = now;
        room.matchAchievements?.restore?.(extra.match);
        if (!(extra.seats instanceof Map)) throw Error('座位資料遺失');
        for (const [, playerId] of extra.seats) room.view(playerId);
        seats.set(room.code, extra.seats);
        if (extra.departed) departedSeats.set(room.code, extra.departed);
        if (extra.kicked) kickedUsers.set(room.code, extra.kicked);
        if (extra.social) socialEvents.set(room.code, extra.social);
        if (extra.media) roomPersistence.fill(mediaRooms.get(room, { create: true }), extra.media);
        if (extra.watch) roomPersistence.fill(watchRooms.get(room, { create: true }), extra.watch);
        rooms.set(room.code, room);
        restored++;
      } catch (error) {
        console.error('Room ' + saved.code + ' could not be restored:', error);
      }
    }
    for (const [key, value] of snapshot.grace || [])
      if (rooms.has(key.split(':')[0])) reconnectGrace.set(key, value);
    if (restored) console.log('Restored ' + restored + ' room(s) after restart');
  }
  // Pushes room views to seated players as soon as they change (#232).
  const stateStream = createStateStream({
    project: (room, playerId) => withSocial(room, room.view(playerId)),
    valid: (entry) =>
      !!auth.sessionFrom(entry.req) &&
      rooms.get(entry.room.code) === entry.room &&
      !kickedUsers.get(entry.room.code)?.has(entry.userId) &&
      seats.get(entry.room.code)?.get(entry.userId) === entry.playerId,
    onFlush: awardRoomAchievements,
    onAlive: (entry) => resumeSeat(entry.room, entry.user),
    onHeartbeat: (entry) => roomInvitations.touch(entry.user),
  });
  const transitions = createRoomTransitions({
    runtime,
    onTransition: (room) => {
      awardRoomAchievements(room);
      stateStream.notify(room);
    },
    onMembershipChanged: (room) => {
      reconcileWatch(room);
      pruneRoomRoles(room, activeRoomIds(room));
      mediaRooms.get(room)?.reconcile(mediaContext(room));
    },
  });
  const robots = fs.readFileSync(path.join(__dirname, '..', 'public', 'robots.txt'));
  function limitRate(map, key, max) {
    const now = Date.now(),
      recent = (map.get(key) || []).filter((t) => now - t < 60000);
    if (recent.length >= max) throw new HttpError(429, 'RATE_LIMITED', '操作太頻繁，請稍後再試');
    recent.push(now);
    map.set(key, recent);
    if (map.size > 2000)
      for (const [address, times] of map)
        if (!times.some((t) => now - t < 60000)) map.delete(address);
  }
  function limitCommunity(req) {
    limitRate(communityRate, clientKey(req), 40);
  }
  function limitAccount(user) {
    limitRate(accountRate, user.id, 10);
  }
  const lobbyCharacter = (user) => {
    let appearance;
    try {
      appearance = normalizeAppearance(user.appearance ? JSON.parse(user.appearance) : defaults);
    } catch {
      appearance = defaults;
    }
    return (
      characterFor(db, user.id, appearance.characterId) ||
      characterFor(db, user.id, defaults.characterId)
    );
  };
  const lobbyHandlers = createLobbyHandlers({
    attackLoadout: (user) => require('./profiles/settings').getAttackSettings(db, user.id),
    entranceAllowed: (user, id) =>
      ['classic', 'smoke', 'sparks', 'ink', 'runes', 'rift', 'particles'].includes(id) ||
      require('./achievements/bonus-rewards')
        .owned(achievementStore, user.id)
        .entrances.includes(id),
    backgroundAllowed: (user, id) =>
      require('./achievements/bonus-rewards')
        .owned(achievementStore, user.id)
        .backgrounds.includes(id),
    assertFrame: (user, id) => achievementStore.assertFrame(user.id, id),
    lobby,
    withLobbyMedia,
    lobbyCharacter,
    expressionLabels,
    characterMedia,
  });
  const port = config.port,
    protocol = 'http';
  function limitAuth(req) {
    limitRate(authRate, clientKey(req), 20);
  }
  const handler = async (req, res) => {
    setSecurityHeaders(res, config.publicUrl);
    try {
      const url = new URL(req.url, 'http://localhost');
      if (frontend?.serveAsset(req, res, url.pathname)) return;
      if (req.method === 'POST' && /^\/api\/(?:profile|admin)\//.test(url.pathname))
        res.once('finish', refreshPortraits);
      if (req.method === 'POST' && /^\/api\/(?:profile\/characters|artworks)\b/.test(url.pathname))
        res.once('finish', refreshThumbnails);
      if (
        req.method === 'GET' &&
        url.searchParams.get('embed') === '1' &&
        ['/gifts', '/draw-words', '/community'].includes(url.pathname)
      ) {
        res.setHeader('X-Frame-Options', 'SAMEORIGIN');
        res.setHeader(
          'Content-Security-Policy',
          "frame-ancestors 'self'; base-uri 'none'; object-src 'none'",
        );
      }
      if (url.pathname === '/media-pip-frame' && req.method === 'GET') {
        // Empty same-origin host for the Document PiP media window. Its http URL
        // gives YouTube embeds a Referer, which about:blank PiP documents lack.
        res.setHeader('X-Frame-Options', 'SAMEORIGIN');
        res.setHeader(
          'Content-Security-Policy',
          "frame-ancestors 'self'; base-uri 'none'; object-src 'none'",
        );
        res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.end(
          '<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><title>媒體子母畫面</title><body></body></html>',
        );
      }
      if (url.pathname === '/robots.txt' && req.method === 'GET') {
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        return res.end(robots);
      }
      if (url.pathname === '/api/version' && req.method === 'GET') {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        return res.end(JSON.stringify({ version: applicationVersion }));
      }
      if (url.pathname.startsWith('/api/')) {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        // Gallery requests and explicit official rechecks require same-origin access.
        // Authenticate before accepting their request bodies or initiating network work.
        const imageApi =
          url.pathname.startsWith('/api/market/images') ||
          url.pathname.startsWith('/api/admin/market/images');
        const marketRecheckApi = url.pathname === '/api/admin/market/recheck';
        if (imageApi || marketRecheckApi) {
          const expected = config.publicUrl || 'http://' + req.headers.host;
          let origin;
          try {
            origin = req.headers.origin ? new URL(req.headers.origin).origin : null;
          } catch {
            throw new HttpError(403, 'CROSS_ORIGIN', '不允許跨站請求');
          }
          if (
            (origin && origin !== expected) ||
            (req.headers['sec-fetch-site'] &&
              !['same-origin', 'none'].includes(req.headers['sec-fetch-site']))
          )
            throw new HttpError(403, 'CROSS_ORIGIN', '不允許跨站請求');
          const actor = auth.requireUser(req);
          if (url.pathname.startsWith('/api/admin/') && actor.role !== 'admin')
            throw new HttpError(403, 'ADMIN_REQUIRED', '只有管理者可以操作');
          if (marketRecheckApi && req.method !== 'POST')
            throw new HttpError(405, 'METHOD_NOT_ALLOWED', '此操作不支援此方法');
          if (url.pathname === '/api/market/images' && req.method === 'POST') {
            limitRate(accountRate, 'market-upload:' + actor.id, 6);
            limitRate(accountRate, 'market-upload-ip:' + clientKey(req), 20);
          }
        }

        if (
          url.pathname === '/api/admin/game-audio' ||
          url.pathname.startsWith('/api/admin/game-audio/')
        ) {
          return await require('./music/game-audio-uploads').handleGameAudioUpload(req, res, {
            auth,
            gameAudio,
            fullAudio,
            url,
            expectedOrigin: config.publicUrl || 'http://' + req.headers.host,
          });
        }
        if (url.pathname === '/api/music/upload' && req.method === 'POST') {
          if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host)
            throw new HttpError(403, 'CROSS_ORIGIN', '不允許跨站請求');
          const user = auth.requireUser(req);
          limitAccount(user);
          if (
            !['audio/mpeg', 'audio/mp4', 'audio/ogg', 'application/octet-stream'].includes(
              req.headers['content-type']?.split(';')[0],
            )
          )
            throw new HttpError(400, 'INVALID_AUDIO', '需要音樂檔案');
          if (Number(req.headers['content-length']) > MAX_BYTES)
            throw new HttpError(413, 'MUSIC_TOO_LARGE', '每首最多 20 MB');
          const chunks = [];
          let length = 0;
          for await (const chunk of req) {
            length += chunk.length;
            if (length > MAX_BYTES) throw new HttpError(413, 'MUSIC_TOO_LARGE', '每首最多 20 MB');
            chunks.push(chunk);
          }
          let title;
          try {
            title = decodeURIComponent(req.headers['x-music-title'] || '');
          } catch {
            throw new HttpError(400, 'INVALID_TITLE', '曲名不正確');
          }
          return res.end(
            JSON.stringify(
              musicStore.add(
                user,
                { title, duration: Number(req.headers['x-music-duration']) },
                Buffer.concat(chunks),
              ),
            ),
          );
        }
        let data = {};
        if (req.method === 'POST') {
          if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host)
            throw Error('不允許跨站請求');
          if (!req.headers['content-type']?.startsWith('application/json'))
            throw Error('需要 JSON');
          const expressionImageEdit =
            /^\/api\/profile\/characters\/[a-f0-9-]{36}\/expressions\/(?:neutral|happy|sad|surprised|thinking|angry|emote-[a-f0-9-]{36})\/edit$/.test(
              url.pathname,
            );
          const characterImageUpload =
            expressionImageEdit ||
            url.pathname === '/api/profile/characters' ||
            /^\/api\/profile\/characters\/[a-f0-9-]{36}\/(?:expressions|emotes)$/.test(
              url.pathname,
            );
          // Bounded private drawing submissions can exceed the small text-action body budget.
          const limit =
            url.pathname === '/api/action' || url.pathname === '/api/telephone/draft'
              ? 128 * 1024
              : url.pathname === '/api/market/images'
                ? 3 * 1024 * 1024
                : url.pathname === '/api/admin/market/images/approve'
                  ? 128 * 1024
                  : characterImageUpload
                    ? MAX_CHARACTER_IMAGE_BODY_BYTES
                    : url.pathname === '/api/artworks' ||
                        url.pathname === '/api/draw/result/save' ||
                        url.pathname.startsWith('/api/profile/characters/') ||
                        url.pathname === '/api/community/gifts'
                      ? 1400000
                      : 8192;
          const chunks = [];
          let bytes = 0;
          for await (const chunk of req) {
            bytes += chunk.length;
            if (bytes > limit) throw new HttpError(413, 'REQUEST_TOO_LARGE', '請求過大');
            chunks.push(chunk);
          }
          data = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
        }
        const send = (x) => res.end(JSON.stringify(x));
        if (url.pathname === '/api/auth/login' && req.method === 'POST') {
          limitAuth(req);
          return send(await auth.login(data, res));
        }
        if (url.pathname === '/api/auth/register' && req.method === 'POST') {
          limitAuth(req);
          return send(await auth.register(data, res));
        }
        if (url.pathname === '/api/auth/reset' && req.method === 'POST') {
          limitAuth(req);
          await auth.resetPassword(data);
          return send({ ok: true });
        }
        if (url.pathname === '/api/auth/logout' && req.method === 'POST') {
          const leaving = auth.sessionFrom(req);
          if (leaving) roomInvitations.forget(leaving.session_hash);
          auth.logout(req, res);
          return send({ ok: true });
        }
        const user = auth.requireUser(req);
        roomInvitations.touch(user);
        if (url.pathname === '/api/room-invitations' && req.method === 'GET') {
          expireRooms();
          return send(roomInvitations.inbox(user));
        }
        if (url.pathname === '/api/room-invitations/online' && req.method === 'GET') {
          expireRooms();
          return send(roomInvitations.candidates(user, url.searchParams.get('code')));
        }
        if (url.pathname === '/api/room-invitations' && req.method === 'POST') {
          expireRooms();
          limitRate(roomRate, 'invite:' + user.id, 10);
          const invitation = roomInvitations.send(user, data);
          stateStream.hintUser(data.targetId, 'invitations');
          return send(invitation);
        }
        if (url.pathname === '/api/room-invitations/respond' && req.method === 'POST') {
          expireRooms();
          limitRate(roomRate, 'invite-response:' + user.id, 30);
          return send(roomInvitations.resolve(user, data, (room) => joinRoom(room, user, req)));
        }
        if (url.pathname === '/api/chat') {
          if (!['GET', 'POST'].includes(req.method))
            throw new HttpError(405, 'METHOD_NOT_ALLOWED', '不支援的請求');
          const channel = req.method === 'GET' ? url.searchParams.get('channel') : data.channel;
          if (channel !== 'table')
            throw new HttpError(400, 'INVALID_CHANNEL', '只能在已入座的房間發送彈幕');
          let code = null;
          if (channel === 'table') {
            expireRooms();
            code = String(
              req.method === 'GET' ? url.searchParams.get('code') || '' : data.code || '',
            ).toUpperCase();
            const room = rooms.get(code);
            if (!room) throw new HttpError(404, 'ROOM_NOT_FOUND', '找不到房間');
            if (kickedUsers.get(code)?.has(user.id))
              throw new HttpError(403, 'KICKED', '你已被踢出房間');
            const seat = seats.get(code)?.get(user.id);
            if (!room.players.some((player) => player.id === seat && !player.bot && !player.kicked))
              throw new HttpError(403, 'NOT_SEATED', '尚未加入此房間');
          }
          limitRate(roomRate, 'chat-read:' + user.id, 120);
          const room = rooms.get(code),
            playerId = seats.get(code)?.get(user.id);
          if (req.method === 'POST') {
            sendRoomMessage({
              assertFrame: (user, id) => achievementStore.assertFrame(user.id, id),
              chat,
              barrageEvents,
              room,
              user,
              playerId,
              data,
            });
            stateStream.hint(code, 'chat');
            stateStream.notify(room);
          }
          return send({
            channel,
            code,
            viewerId: user.id,
            messages: chat.read(code),
            limit: 50,
            ...(req.method === 'POST' ? { roomState: withSocial(room, room.view(playerId)) } : {}),
          });
        }
        if (url.pathname === '/api/auth/me' && req.method === 'GET') {
          const me = auth.publicUser(user);
          if (me.appearance) me.appearance = normalizeAppearance(me.appearance);
          return send(me);
        }
        if (url.pathname === '/api/profile/name' && req.method === 'POST') {
          limitAccount(user);
          const me = auth.rename(user, data);
          // Names are presentation data. Keep seat IDs and recorded/revealed snapshots
          // intact; changing a name must not execute or replay any game action.
          lobby.rename(user.id, me.displayName);
          for (const room of rooms.values()) {
            const playerId = seats.get(room.code)?.get(user.id),
              player = room.players.find((p) => p.id === playerId && !p.kicked);
            if (player && player.name !== me.displayName) {
              player.name = me.displayName;
              if (Number.isSafeInteger(room.version)) room.version++;
              room.updated = Date.now();
              const watch = watchRooms.get(room);
              if (watch) watch.revision++;
            }
          }
          if (me.appearance) me.appearance = normalizeAppearance(me.appearance);
          return send(me);
        }

        if (url.pathname === '/api/market/images' && req.method === 'POST')
          return send(await marketImageStore.upload(user, data));
        if (url.pathname === '/api/market/images/mine' && req.method === 'GET') {
          limitRate(accountRate, 'market-images-mine:' + user.id, 60);
          return send(marketImageStore.listMine(user));
        }
        if (url.pathname === '/api/market/images/draw' && req.method === 'POST') {
          limitRate(accountRate, 'market-draw:' + user.id, 60);
          return send(
            marketImageStore.draw(user, { targetDate: data.targetDate, layout: data.layout }),
          );
        }
        const marketImageMedia = url.pathname.match(
          /^\/api\/market\/images\/([a-f0-9-]{36})\/media(\/thumbnail)?$/i,
        );
        if (marketImageMedia && req.method === 'GET') {
          limitRate(accountRate, 'market-media:' + user.id, 360);
          const image = marketImageMedia[2]
            ? await marketImageStore.thumbnail(user, marketImageMedia[1])
            : marketImageStore.media(user, marketImageMedia[1]);
          // File I/O must not carry a revoked or expired session into a 304/body.
          auth.requireUser(req);
          res.setHeader('Cache-Control', 'private, no-cache, must-revalidate');
          res.setHeader('Vary', 'Cookie');
          res.setHeader('ETag', image.etag);
          res.setHeader('Content-Type', image.mime);
          res.setHeader('Content-Security-Policy', "default-src 'none'");
          res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
          if (
            typeof req.headers['if-none-match'] === 'string' &&
            req.headers['if-none-match']
              .split(',')
              .some((tag) => tag.trim() === '*' || tag.trim().replace(/^W\//, '') === image.etag)
          ) {
            res.writeHead(304);
            return res.end();
          }
          return res.end(image.bytes);
        }
        if (
          url.pathname === '/api/market/images' ||
          url.pathname === '/api/market/images/mine' ||
          url.pathname === '/api/market/images/draw' ||
          marketImageMedia
        )
          throw new HttpError(405, 'METHOD_NOT_ALLOWED', '此操作不支援此方法');
        if (url.pathname.startsWith('/api/market/images/'))
          throw new HttpError(404, 'IMAGE_NOT_FOUND', '找不到圖片');
        if (url.pathname === '/api/market' && req.method === 'GET')
          return send({ ...marketStore.view(user), ...marketAutomationStore.view() });
        if (url.pathname === '/api/market/vote' && req.method === 'POST') {
          limitRate(accountRate, 'market:' + user.id, 60);
          return send(marketStore.vote(user, data));
        }
        if (['/api/market', '/api/market/vote'].includes(url.pathname))
          throw new HttpError(405, 'METHOD_NOT_ALLOWED', '此操作不支援此方法');
        if (url.pathname === '/api/lobby' && req.method === 'GET')
          return send(lobbyHandlers.view(user, url.searchParams.get('entrance')));
        if (url.pathname === '/api/lobby/move' && req.method === 'POST')
          return send(lobbyHandlers.move(user, data));
        if (url.pathname === '/api/lobby/attack' && req.method === 'POST') {
          limitRate(socialRate, 'lobby-attack:' + user.id, 80);
          return send(lobbyHandlers.attack(user, data));
        }
        if (url.pathname === '/api/lobby/teleport' && req.method === 'POST') {
          limitAccount(user);
          return send(lobbyHandlers.teleport(user, data));
        }
        if (url.pathname === '/api/lobby/background' && req.method === 'POST')
          return send(lobbyHandlers.background(user, data));
        if (url.pathname === '/api/lobby/emotes' && req.method === 'GET')
          return send(lobbyHandlers.emotes(user));
        if (url.pathname === '/api/lobby/emote' && req.method === 'POST')
          return send(lobbyHandlers.emote(user, data));
        if (url.pathname === '/api/lobby/barrage' && req.method === 'POST') {
          limitRate(socialRate, 'lobby-barrage:' + user.id, 30);
          return send(lobbyHandlers.barrage(user, data));
        }
        if (url.pathname === '/api/music' && req.method === 'GET')
          return send({ tracks: musicStore.list(), me: user.id, admin: user.role === 'admin' });
        const musicDelete = url.pathname.match(/^\/api\/music\/([a-f0-9-]{36})\/delete$/);
        if (musicDelete && req.method === 'POST') {
          limitAccount(user);
          const result = musicStore.remove(user, musicDelete[1]);
          for (const [code, state] of musicRooms)
            if (state.track?.id === musicDelete[1]) {
              state.act('stop', {}, musicStore);
              publishMusic(code);
            }
          for (const [code, { media }] of mediaRooms.rooms) {
            media.removeTrack(musicDelete[1]);
            publishMusic(code);
          }
          return send(result);
        }
        if (url.pathname === '/api/collection/avatars' && req.method === 'GET')
          return send({ artworks: artworkStore.visible(user.id) });
        const avatarSharing = url.pathname.match(/^\/api\/artworks\/([a-f0-9-]{36})\/sharing$/);
        if (avatarSharing && req.method === 'POST') {
          limitAccount(user);
          return send(artworkStore.share(user.id, avatarSharing[1], data.shared));
        }
        if (url.pathname === '/api/artworks' && req.method === 'GET')
          return send({ artworks: artworkStore.list(user.id) });
        if (url.pathname === '/api/artworks' && req.method === 'POST') {
          limitAccount(user);
          return send(artworkStore.add(user.id, data));
        }
        const artworkDelete = url.pathname.match(/^\/api\/artworks\/([a-f0-9-]{36})\/delete$/);
        if (artworkDelete && req.method === 'POST') {
          limitAccount(user);
          return send(artworkStore.remove(user.id, artworkDelete[1]));
        }
        if (url.pathname === '/api/profile/opening' && ['GET', 'POST'].includes(req.method)) {
          if (req.method === 'POST') limitAccount(user);
          return send(
            require('./profiles/opening').openingTheme(
              db,
              achievementStore,
              user.id,
              req.method === 'POST' ? data : undefined,
            ),
          );
        }
        if (url.pathname === '/api/profile/attacks' && req.method === 'GET')
          return send(require('./profiles/settings').getAttackSettings(db, user.id));
        if (url.pathname === '/api/profile/attacks' && req.method === 'POST') {
          limitAccount(user);
          return send(require('./profiles/settings').setAttackSettings(db, user.id, data));
        }
        if (url.pathname === '/api/profile/settings' && req.method === 'GET')
          return send(getProfileSettings(db, user.id));
        if (url.pathname === '/api/profile/settings' && req.method === 'POST') {
          limitAccount(user);
          const settings = setProfileSettings(db, user.id, data);
          for (const room of rooms.values()) {
            const playerId = seats.get(room.code)?.get(user.id);
            const player = room.players.find((p) => p.id === playerId);
            if (player) player.avatar = portraitUrl(user.id);
          }
          return send(settings);
        }
        if (url.pathname === '/api/profile/avatar' && req.method === 'GET') {
          const selection = avatarContent(db, user.id);
          if (selection.content)
            return sendImage(
              req,
              res,
              url,
              { bytes: Buffer.from(selection.content.bytes), mime: selection.content.mime },
              false,
            );
          // Header avatars ask for a thumbnail; the redirect keeps that request.
          const location = new URL(selection.url, 'http://localhost'),
            size = thumbnailSize(url.searchParams.get('size'));
          if (size) location.searchParams.set('size', String(size));
          res.writeHead(302, { Location: location.pathname + location.search });
          return res.end();
        }
        if (url.pathname === '/api/frontend/page-assets' && req.method === 'GET') {
          const type = url.searchParams.get('type'),
            page = type === 'thunder' ? 'race' : type;
          if (
            !/^(?:race|poker|majority|gift|draw|trpg|telephone|musicquiz|minimal|bluff|quacks|ceo|second-wind)$/.test(
              page || '',
            )
          )
            throw new HttpError(400, 'INVALID_PAGE', '頁面不正確');
          return send({ assets: frontend?.pageAssets(page + '.html') || [] });
        }
        if (url.pathname === '/api/profile/options' && req.method === 'GET') {
          return send({ defaults, expressionLabels, characters: galleryFor(db, user.id) });
        }
        if (url.pathname === '/api/social/options' && req.method === 'GET')
          return send({ emojis: ROOM_EMOJIS, barrageFrames: BUILTIN_FRAME_OPTIONS });
        if (url.pathname === '/api/profile/characters' && req.method === 'POST') {
          limitAccount(user);
          return send(createCharacter(db, user.id, data));
        }
        const characterDelete = url.pathname.match(
          /^\/api\/profile\/characters\/([a-f0-9-]{36})\/delete$/,
        );
        if (characterDelete && req.method === 'POST') {
          limitAccount(user);
          return send(removeCharacter(db, user.id, characterDelete[1]));
        }
        const sharingUpdate = url.pathname.match(
          /^\/api\/profile\/characters\/([a-f0-9-]{36})\/sharing$/,
        );
        if (sharingUpdate && req.method === 'POST') {
          limitAccount(user);
          return send(setSharing(db, user.id, sharingUpdate[1], data.shared));
        }
        const customExpressionUpload = url.pathname.match(
          /^\/api\/profile\/characters\/([a-f0-9-]{36})\/emotes$/,
        );
        if (customExpressionUpload && req.method === 'POST') {
          limitAccount(user);
          return send(addExpression(db, user.id, customExpressionUpload[1], data));
        }
        const expressionUpload = url.pathname.match(
          /^\/api\/profile\/characters\/([a-f0-9-]{36})\/expressions$/,
        );
        if (expressionUpload && req.method === 'POST') {
          limitAccount(user);
          return send(setExpression(db, user.id, expressionUpload[1], data));
        }
        const expressionEdit = url.pathname.match(
          /^\/api\/profile\/characters\/([a-f0-9-]{36})\/expressions\/(neutral|happy|sad|surprised|thinking|angry|emote-[a-f0-9-]{36})\/(edit|delete)$/,
        );
        if (expressionEdit && req.method === 'POST') {
          limitAccount(user);
          const result =
            expressionEdit[3] === 'edit'
              ? editExpression(db, user.id, expressionEdit[1], expressionEdit[2], data)
              : removeExpression(db, user.id, expressionEdit[1], expressionEdit[2]);
          const removed = '/assets/characters/user/' + expressionEdit[1] + '/' + expressionEdit[2];
          for (const [code, events] of expressionEvents)
            expressionEvents.set(
              code,
              events.filter((event) => event.image?.split('?')[0] !== removed),
            );
          lobby.clearExpression(removed);
          for (const room of rooms.values())
            for (const [accountId, playerId] of seats.get(room.code) || []) {
              const player = room.players.find((p) => p.id === playerId);
              if (player?.avatar?.split('?')[0] === removed) player.avatar = portraitUrl(accountId);
            }
          return send(result);
        }
        const expressionSound = url.pathname.match(
          /^\/api\/profile\/characters\/([a-f0-9-]{36})\/expressions\/(happy|sad|surprised|thinking|angry|emote-[a-f0-9-]{36})\/sound(\/remove)?$/,
        );
        if (expressionSound && req.method === 'POST') {
          limitAccount(user);
          if (expressionSound[3])
            return send(removeExpressionSound(db, user.id, expressionSound[1], expressionSound[2]));
          return send({
            sound: setExpressionSound(db, user.id, expressionSound[1], expressionSound[2], data),
          });
        }
        if (url.pathname === '/api/profile/appearance' && req.method === 'POST') {
          const { appearance } = selectedImage(db, user.id, data);
          db.prepare('UPDATE users SET appearance=? WHERE id=?').run(
            JSON.stringify(preserveAvatar(db, user.id, appearance)),
            user.id,
          );
          for (const room of rooms.values()) {
            const playerId = seats.get(room.code)?.get(user.id);
            const player = room.players.find((p) => p.id === playerId);
            if (player) player.avatar = portraitUrl(user.id);
          }
          return send({ appearance });
        }
        if (url.pathname.startsWith('/api/submissions/') && req.method === 'GET')
          return send(submissions.visible(url.pathname.split('/')[3], user));
        if (url.pathname.startsWith('/api/admin/')) {
          if (user.role !== 'admin')
            throw new HttpError(403, 'ADMIN_REQUIRED', '只有管理者可以操作');

          if (url.pathname === '/api/admin/market/images' && req.method === 'GET') {
            limitRate(accountRate, 'market-pending:' + user.id, 60);
            if (['buckets', 'weekdays'].some((key) => url.searchParams.getAll(key).length > 1))
              throw new HttpError(400, 'INVALID_FILTER', '篩選格式不正確');
            const buckets = url.searchParams.has('buckets')
                ? url.searchParams.get('buckets').split(',')
                : [],
              weekdays = url.searchParams.has('weekdays')
                ? url.searchParams
                    .get('weekdays')
                    .split(',')
                    .map((value) => (/^\d$/.test(value) ? Number(value) : NaN))
                : [];
            return send(marketImageStore.pending(user, { buckets, weekdays }));
          }
          if (url.pathname === '/api/admin/market/images/approve' && req.method === 'POST') {
            limitRate(accountRate, 'market-approve:' + user.id, 30);
            return send(marketImageStore.approve(user, data));
          }
          if (
            ['/api/admin/market/images', '/api/admin/market/images/approve'].includes(url.pathname)
          )
            throw new HttpError(405, 'METHOD_NOT_ALLOWED', '此操作不支援此方法');
          if (url.pathname.startsWith('/api/admin/market/images/'))
            throw new HttpError(404, 'IMAGE_NOT_FOUND', '找不到圖片');
          if (url.pathname === '/api/admin/market' && req.method === 'GET')
            return send({ ...marketStore.view(user, true), ...marketAutomationStore.view(true) });
          if (url.pathname === '/api/admin/market/recheck' && req.method === 'POST') {
            if (data?.confirmed !== true)
              throw new HttpError(
                400,
                'MARKET_RECHECK_CONFIRMATION_REQUIRED',
                '請明確確認要重新查核的交易日',
              );
            const targetDate = data.targetDate,
              now = (config.marketClock || Date.now)();
            if (
              !validMarketDate(targetDate) ||
              targetDate > dateAt(now) ||
              now < closeAfter(targetDate)
            )
              throw new HttpError(
                400,
                'INVALID_MARKET_RECHECK_DATE',
                '請選擇已過台北時間 14:00 的有效交易日期',
              );
            if (!marketAutomation.enabled)
              throw new HttpError(
                503,
                'AUTOMATION_DISABLED',
                '官方資料查核已停用，請先確認伺服器設定',
              );
            limitRate(accountRate, 'market-recheck:' + user.id, 6);
            limitRate(accountRate, 'market-recheck-ip:' + clientKey(req), 12);
            return send(await marketAutomation.manualRecheck(targetDate));
          }
          if (url.pathname === '/api/admin/market/calendar-override' && req.method === 'POST') {
            limitRate(accountRate, 'market-admin:' + user.id, 60);
            return send(marketAutomationStore.override(user, data));
          }
          if (url.pathname.startsWith('/api/admin/market') && req.method === 'POST') {
            limitRate(accountRate, 'market-admin:' + user.id, 60);
            if (url.pathname === '/api/admin/market/rounds')
              return send(marketStore.create(user, data));
            if (url.pathname === '/api/admin/market/preview')
              return send(marketStore.preview(user, data));
            if (url.pathname === '/api/admin/market/settle')
              return send(marketStore.settle(user, data));
          }
          if (
            [
              '/api/admin/market',
              '/api/admin/market/rounds',
              '/api/admin/market/preview',
              '/api/admin/market/settle',
              '/api/admin/market/calendar-override',
            ].includes(url.pathname)
          )
            throw new HttpError(405, 'METHOD_NOT_ALLOWED', '此操作不支援此方法');
          if (url.pathname === '/api/admin/submissions' && req.method === 'GET')
            return send(submissions.pending());
          if (url.pathname === '/api/admin/submissions/retry' && req.method === 'POST')
            return send(await submissions.retry(data.id, user));
          if (url.pathname === '/api/admin/invites' && req.method === 'POST')
            return send(auth.createInvite(user, data));
          if (url.pathname === '/api/admin/invites/revoke' && req.method === 'POST') {
            auth.revokeInvite(data.code);
            return send({ ok: true });
          }
          if (url.pathname === '/api/admin/users' && req.method === 'GET')
            return send(
              db
                .prepare(
                  'SELECT id,username,display_name AS displayName,role,disabled,created_at AS createdAt FROM users ORDER BY created_at',
                )
                .all(),
            );
          if (url.pathname === '/api/admin/resets' && req.method === 'POST')
            return send(auth.createReset(user, data.userId, data));
          if (url.pathname === '/api/admin/users/disable' && req.method === 'POST') {
            auth.disableUser(user, data.userId, !!data.disabled);
            return send({ ok: true });
          }
          throw new HttpError(404, 'NOT_FOUND', '找不到請求路徑');
        }
        if (url.pathname.startsWith('/api/community/')) {
          const resource = url.pathname.split('/')[3];
          if (req.method === 'GET') {
            if (resource === 'issues') return send(board.list());
            if (resource === 'questions')
              return send({
                topics: require('./games/majority-questions').TOPICS,
                questions: [
                  ...require('./games/majority-questions').QUESTIONS,
                  ...community.data.questions,
                ],
              });
            if (resource === 'gifts')
              return send({ categories: CATEGORIES, gifts: [...GIFTS, ...giftStore.list()] });
          }
          if (req.method === 'POST') {
            limitCommunity(req);
            limitAccount(user);
            if (resource === 'questions')
              return send(community.question({ ...data, name: user.display_name }));
            if (resource === 'gifts') return send(giftStore.add(user, data));
            if (resource === 'issues') {
              const kind = data.id ? (data.action === 'comment' ? 'comment' : 'status') : 'issue';
              const result = await submissions.submit(kind, data, user);
              if (result.state === 'needs_review') res.statusCode = 202;
              else if (result.state === 'failed') res.statusCode = 502;
              return send(result);
            }
          }
          throw new HttpError(404, 'NOT_FOUND', '找不到請求路徑');
        }
        if (url.pathname === '/api/draw/words' && req.method === 'GET')
          return send({
            topics: TOPICS,
            builtin: drawWordStore.builtin(),
            custom: drawWordStore.list(),
          });
        if (url.pathname === '/api/draw/words' && req.method === 'POST') {
          limitCommunity(req);
          limitAccount(user);
          return send(drawWordStore.add(user, data));
        }
        if (url.pathname === '/api/achievements/redeem' && req.method === 'POST') {
          limitRate(accountRate, 'reward-code:' + user.id, 10);
          return send(achievementStore.redeem(user.id, data.code));
        }
        if (url.pathname === '/api/achievements/claim' && req.method === 'POST') {
          limitRate(accountRate, 'reward:' + user.id, 30);
          return send(achievementStore.claim(user.id, data.frameId));
        }
        if (url.pathname === '/api/achievements' && req.method === 'GET')
          return send(achievementStore.list(user.id));
        if (url.pathname === '/api/info') {
          const addresses = Object.values(os.networkInterfaces())
            .flat()
            .filter((x) => x.family === 'IPv4' && !x.internal)
            .map((x) => `${protocol}://${x.address}:${port}`);
          const preferred = config.publicUrl || addresses.find((a) => a.includes('://26.')) || null;
          return send({
            preferred,
            addresses: config.publicUrl
              ? [config.publicUrl, ...addresses.filter((a) => a !== config.publicUrl)]
              : addresses,
          });
        }
        if (url.pathname === '/api/rooms' && req.method === 'GET') {
          expireRooms();
          return send({ rooms: listRooms(rooms, seats, kickedUsers, user.id) });
        }
        if (url.pathname === '/api/create' && req.method === 'POST') {
          // CEO has a Vue-only page; legacy hosts do not expose it by default.
          if (
            data.type === 'second-wind' &&
            !(config.secondWindEnabled ?? config.frontendEnabled === true)
          )
            throw new HttpError(400, 'GAME_NOT_ENABLED', '運動員尚未啟用');
          if (data.type === 'ceo' && !(config.ceoEnabled ?? config.frontendEnabled === true))
            throw new HttpError(400, 'GAME_NOT_ENABLED', 'CEO 仍在開發，尚未開放建立房間');
          if (pendingAchievementUnits.size >= 4096)
            throw new HttpError(
              503,
              'ACHIEVEMENT_STORAGE_UNAVAILABLE',
              '回合紀錄暫時無法儲存，請稍後再建立房間',
            );
          limitRate(roomRate, 'create:' + user.id, 20);
          limitRate(roomRate, 'create-ip:' + clientKey(req), 60);
          if (rooms.size >= 100) throw Error('房間數已達上限');
          if (
            ![
              'poker',
              'thunder',
              'majority',
              'gift',
              'draw',
              'trpg',
              'telephone',
              'musicquiz',
              'minimal',
              'bluff',
              'quacks',
              'ceo',
              'second-wind',
            ].includes(data.type)
          )
            throw new HttpError(400, 'INVALID_GAME', '不支援的遊戲');
          const draw = data.type === 'draw';
          if (draw && data.topic !== undefined && !validTopic(data.topic))
            throw new HttpError(400, 'INVALID_DRAW_TOPIC', '題目類別不正確');
          if (draw && data.topics !== undefined && !validTopics(data.topics))
            throw new HttpError(400, 'INVALID_DRAW_TOPIC', '請至少選擇一個有效的題目類別');
          let code;
          do {
            code = randomBytes(3).toString('hex').toUpperCase();
          } while (rooms.has(code));
          const secondWind = data.type === 'second-wind',
            ceo = data.type === 'ceo',
            quacks = data.type === 'quacks',
            bluff = data.type === 'bluff',
            musicquiz = data.type === 'musicquiz',
            minimal = data.type === 'minimal',
            telephone = data.type === 'telephone',
            trpg = data.type === 'trpg',
            thunder = data.type === 'thunder',
            majority = data.type === 'majority',
            gift = data.type === 'gift';
          const room = new (
            secondWind
              ? SecondWindRoom
              : ceo
                ? CeoRoom
                : quacks
                  ? QuacksRoom
                  : bluff
                    ? BluffRoom
                    : musicquiz
                      ? MusicQuizRoom
                      : minimal
                        ? MinimalRoom
                        : telephone
                          ? TelephoneRoom
                          : trpg
                            ? TrpgRoom
                            : draw
                              ? DrawGuessRoom
                              : gift
                                ? GiftRoom
                                : majority
                                  ? MajorityRoom
                                  : thunder
                                    ? ThunderRoom
                                    : Room
          )(
            code,
            String(
              data.roomName ||
                (secondWind
                  ? '運動員 Second Wind'
                  : ceo
                    ? '王牌執行長好友局'
                    : quacks
                      ? '郎中闖江湖好友局'
                      : bluff
                        ? '瞎掰王好友局'
                        : musicquiz
                          ? '猜歌挑戰好友局'
                          : minimal
                            ? '極簡畫家好友局'
                            : telephone
                              ? '傳情畫意好友局'
                              : trpg
                                ? '霧港鐘聲冒險隊'
                                : draw
                                  ? '你畫我猜好友局'
                                  : gift
                                    ? '送禮達人好友局'
                                    : majority
                                      ? '同頻俱樂部'
                                      : thunder
                                        ? '末路狂飆好友局'
                                        : '深夜好友局'),
            ).slice(0, 24),
          );
          equipRoomProviders(room);
          if (bluff && data.roleSeconds !== undefined) {
            if (![10, 30, 60].includes(data.roleSeconds))
              throw new HttpError(
                400,
                'INVALID_ROLE_SECONDS',
                '看身分時間只能選 10 秒、30 秒或 1 分鐘',
              );
            room.options.roleSeconds = data.roleSeconds;
          }
          if (draw) {
            if (data.seconds !== undefined && ![60, 90, 120].includes(data.seconds))
              throw new HttpError(400, 'INVALID_DRAW_SECONDS', '作畫時間請選 60、90 或 120 秒');
            if (data.seconds !== undefined) room.options.seconds = data.seconds;
            room.options.ending = readEnding(data.ending);
            if (data.topics !== undefined)
              room.options.topics = DRAW_CATEGORIES.filter((topic) => data.topics.includes(topic));
            else if (data.topic !== undefined) {
              room.options.topic = data.topic;
              delete room.options.topics;
            }
          }
          if (!thunder && !botSupport(room).supported)
            throw new HttpError(400, 'TEST_AI_REQUIRED', '新遊戲必須先提供測試 AI');
          attachAchievementHooks(room);
          const p = transitions.transact(
            room,
            { action: 'create', source: 'player', name: user.display_name },
            () => {
              const player = room.add(user.display_name);
              player.name = user.display_name;
              if (quacks || secondWind) room.configure(player.id, data);
              return player;
            },
          );
          p.avatar = portraitUrl(user.id);
          rooms.set(code, room);
          seats.set(code, new Map([[user.id, p.id]]));
          return send({ code, type: room.type || 'poker' });
        }
        if (
          ![
            '/api/pings',
            '/api/pings/events',
            '/api/room-media',
            '/api/room-role',
            '/api/room-space',
            '/api/room-watch',
            '/api/room-music',
            '/api/room-music/events',
            '/api/leave',
            '/api/join',
            '/api/reconnect',
            '/api/state',
            '/api/room-events',
            '/api/telephone/draft',
            '/api/bluff/caption',
            '/api/game-song-audio',
            '/api/musicquiz-clip',
            '/api/action',
            '/api/kick',
            '/api/settings',
            '/api/start',
            '/api/bot',
            '/api/rebuy',
            '/api/social',
            '/api/draw/canvas',
            '/api/draw/events',
            '/api/draw/stroke',
            '/api/draw/command',
            '/api/draw/result',
            '/api/draw/result/save',
            '/api/draw/result/ban',
            '/api/draw/result/unsave',
            '/api/draw/dissolve',
          ].includes(url.pathname)
        )
          throw new HttpError(404, 'NOT_FOUND', '找不到請求路徑');
        expireRooms();
        const pingLobby =
          ['/api/pings', '/api/pings/events'].includes(url.pathname) &&
          String(data.code || url.searchParams.get('code') || '').toUpperCase() === '__LOBBY__';
        if (pingLobby && !lobby.mediaAudience(user.id))
          throw new HttpError(403, 'LOBBY_PRESENCE_REQUIRED', '請先進入大廳');
        if (pingLobby) lobbyPingRoom.players = lobby.view(user).visitors;
        const room = pingLobby
          ? lobbyPingRoom
          : rooms.get(String(data.code || url.searchParams.get('code') || '').toUpperCase());
        if (!room) throw new HttpError(404, 'ROOM_NOT_FOUND', '找不到房間，請確認房間代碼');
        if (kickedUsers.get(room.code)?.has(user.id))
          throw new HttpError(403, 'KICKED', '你已被房主踢出房間');
        // Revoke an expired controller before this request refreshes their seat lease.
        reconcileWatch(room);
        // Any room write may change what the table sees.
        if (req.method === 'POST' && !pingLobby) res.once('finish', () => stateStream.notify(room));
        if (url.pathname === '/api/reconnect' && req.method === 'POST') {
          resumeSeat(room, user);
          return send({ code: room.code, type: room.type || 'poker', reconnected: true });
        }
        if (url.pathname === '/api/join' && req.method === 'POST')
          return send(joinRoom(room, user, req));
        const p = pingLobby ? { id: user.id } : resumeSeat(room, user);
        if (url.pathname === '/api/room-events' && req.method === 'GET') {
          if (pingLobby) throw new HttpError(404, 'NOT_FOUND', '找不到請求路徑');
          limitRate(roomRate, 'room-events:' + user.id, 30);
          if (!stateStream.subscribe(room, { req, res, user, playerId: p.id }))
            throw new HttpError(429, 'STREAM_LIMIT', '房間連線太多，請關閉舊分頁');
          return;
        }
        if (url.pathname === '/api/room-space') {
          if (req.method !== 'POST') throw new HttpError(405, 'METHOD_NOT_ALLOWED', '不支援的請求');
          limitRate(roomRate, 'room-space:' + user.id, 360);
          const entrance =
            ['classic', 'smoke', 'sparks', 'ink', 'runes', 'rift', 'particles'].includes(
              data.entrance,
            ) ||
            require('./achievements/bonus-rewards')
              .owned(achievementStore, user.id)
              .entrances.includes(data.entrance)
              ? data.entrance
              : 'classic';
          roomSpace.move(
            room,
            p.id,
            data,
            require('./profiles/settings').getAttackSettings(db, user.id)[data.slot || 'q'],
            entrance,
          );
          return send(withSocial(room, room.view(p.id)));
        }
        if (url.pathname === '/api/pings') {
          if (req.method !== 'POST') throw new HttpError(405, 'METHOD_NOT_ALLOWED', '不支援的請求');
          return send(runtime.pings.post(room, p.id, user.display_name, data));
        }
        if (url.pathname === '/api/pings/events' && req.method === 'GET') {
          const valid = () => {
            const session = auth.sessionFrom(req);
            return (
              !!session &&
              (pingLobby
                ? !!lobby.mediaAudience(user.id)
                : rooms.get(room.code) === room &&
                  !kickedUsers.get(room.code)?.has(user.id) &&
                  seats.get(room.code)?.get(user.id) === p.id)
            );
          };
          let timer,
            unsubscribe = () => {},
            closed = false;
          const close = () => {
            if (closed) return;
            closed = true;
            clearInterval(timer);
            unsubscribe();
            req.off('close', close);
            res.end();
          };
          const client = {
            userId: user.id,
            close,
            send(kind, payload) {
              if (!valid()) return close();
              try {
                if (!res.write('event: ' + kind + '\ndata: ' + JSON.stringify(payload) + '\n\n'))
                  close();
              } catch {
                close();
              }
            },
          };
          unsubscribe = runtime.pings.subscribe(room, client);
          res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
          res.setHeader('Cache-Control', 'no-cache, no-transform');
          res.setHeader('X-Accel-Buffering', 'no');
          res.flushHeaders();
          client.send('ready', runtime.pings.context(room));
          if (!closed) {
            timer = setInterval(() => client.send('heartbeat', runtime.pings.context(room)), 10000);
            timer.unref();
            req.once('close', close);
          }
          return;
        }
        if (url.pathname === '/api/leave' && req.method === 'POST') {
          limitRate(roomRate, 'leave:' + user.id, 30);
          limitRate(roomRate, 'leave-ip:' + clientKey(req), 120);
          return send(transitions.leave(room, user.id, p.id));
        }
        if (url.pathname === '/api/room-media') {
          if (req.method !== 'GET' && req.method !== 'POST')
            throw new HttpError(405, 'METHOD_NOT_ALLOWED', '不支援的請求');
          const media = activateMedia(room);
          let context = mediaContext(room);
          media.reconcile(context);
          if (req.method === 'GET') {
            limitRate(roomRate, 'media-read:' + user.id, 120);
            return send(media.snapshot(p.id, context));
          }
          limitRate(roomRate, 'media-command:' + user.id, 60);
          try {
            const prepared = media.prepare(p.id, data, context);
            let title;
            if (
              !prepared.duplicate &&
              prepared.effective.action === 'enqueue' &&
              prepared.effective.type === 'video' &&
              !prepared.effective.title
            ) {
              try {
                title = await youtubeTitles.resolve(prepared.effective.videoId);
              } catch {
                title = fallbackTitle(prepared.effective.videoId);
              }
              auth.requireUser(req);
              if (rooms.get(room.code) !== room)
                throw new HttpError(404, 'ROOM_NOT_FOUND', '這間房已結束');
              if (kickedUsers.get(room.code)?.has(user.id))
                throw new HttpError(403, 'KICKED', '你已被踢出房間');
              if (
                seats.get(room.code)?.get(user.id) !== p.id ||
                !room.players.some((player) => player.id === p.id && !player.bot && !player.kicked)
              )
                throw new HttpError(403, 'NOT_SEATED', '尚未加入此房間');
              context = mediaContext(room);
            }
            const result = media.act(p.id, data, context, { title });
            publishMusic(room.code);
            return send(result);
          } catch (error) {
            if (error.mediaState) {
              res.statusCode = error.status;
              return send({ code: error.code, error: error.message, state: error.mediaState });
            }
            throw error;
          }
        }
        if (url.pathname === '/api/room-role') {
          if (req.method !== 'POST') throw new HttpError(405, 'METHOD_NOT_ALLOWED', '不支援的請求');
          limitRate(roomRate, 'role-command:' + user.id, 30);
          transitions.transact(
            room,
            {
              action: 'room-role',
              source: 'player',
              actor: p.id,
              input: { playerId: data.playerId, role: data.role },
            },
            () => {
              setRoomRole(room, p.id, data.playerId, data.role, activeRoomIds(room));
              if (Number.isFinite(room.version)) room.version++;
              if (Number.isFinite(room.updated)) room.updated = Date.now();
            },
          );
          return send(withSocial(room, room.view(p.id)));
        }
        if (
          ['/api/room-watch', '/api/room-music'].includes(url.pathname) &&
          req.method === 'POST' &&
          mediaRooms.get(room)?.managed
        ) {
          const media = mediaRooms.get(room);
          media.reconcile(mediaContext(room));
          res.statusCode = 409;
          return send({
            code: 'MEDIA_API_REQUIRED',
            error: '這間房已改用共用媒體清單，請重新開啟媒體視窗',
            state: media.snapshot(p.id, mediaContext(room)),
          });
        }
        if (url.pathname === '/api/room-watch') {
          if (req.method !== 'GET' && req.method !== 'POST')
            throw new HttpError(405, 'METHOD_NOT_ALLOWED', '不支援的請求');
          if (mediaRooms.get(room)?.managed) {
            const media = mediaRooms.get(room);
            media.reconcile(mediaContext(room));
            return send(watchProjection(room, p.id));
          }
          const watch = watchRooms.get(room, { create: true }),
            context = watchContext(room);
          watch.reconcile(context);
          const controls = permissionsView(room, p.id).canManageMedia;
          if (req.method === 'GET') {
            limitRate(roomRate, 'watch-read:' + user.id, 120);
            const snapshot = watch.snapshot(p.id, context);
            return send({ ...snapshot, canControl: controls && snapshot.canControl });
          }
          limitRate(roomRate, 'watch-command:' + user.id, 60);
          if (!controls && data.action !== 'propose')
            throw new HttpError(403, 'MEDIA_MANAGER_ONLY', '只有房主或房間管理者可以控制媒體');
          if (
            !controls &&
            data.action === 'propose' &&
            !watch.video &&
            musicRooms.get(room.code)?.track
          )
            throw new HttpError(
              409,
              'LEGACY_MEDIA_BUSY',
              '已有播放項目，請重新開啟媒體視窗，使用共用清單點播',
            );
          try {
            const result = watch.act(p.id, data, context);
            if (result.video && musicRooms.get(room.code)?.track) {
              roomMusic(room).act('stop', {}, musicStore);
              publishMusic(room.code);
            }
            return send({ ...result, canControl: controls && result.canControl });
          } catch (error) {
            if (error.watchState) {
              res.statusCode = error.status;
              return send({ code: error.code, error: error.message, state: error.watchState });
            }
            throw error;
          }
        }
        if (url.pathname === '/api/room-music') {
          if (req.method === 'GET') {
            mediaRooms.get(room)?.reconcile(mediaContext(room));
            return send(musicProjection(room));
          }
          if (req.method !== 'POST') throw new HttpError(405, 'METHOD_NOT_ALLOWED', '不支援的請求');
          const controls = permissionsView(room, p.id).canManageMedia;
          if (data.action !== 'select' && !controls)
            throw new HttpError(403, 'HOST_ONLY', '只有房主或房間管理者可以控制全桌音樂');
          if (
            data.action === 'select' &&
            !controls &&
            (musicRooms.get(room.code)?.track || watchRooms.get(room)?.video)
          )
            throw new HttpError(
              409,
              'LEGACY_MEDIA_BUSY',
              '已有播放項目，請重新開啟媒體視窗，使用共用清單點播',
            );
          limitRate(socialRate, 'music:' + user.id, 60);
          const state = roomMusic(room),
            result = state.act(data.action, data, musicStore);
          if (['select', 'previous', 'next'].includes(data.action)) state.selectedById = p.id;
          if (result.track) clearLegacyWatch(room);
          publishMusic(room.code);
          return send(result);
        }
        if (url.pathname === '/api/room-music/events' && req.method === 'GET') {
          const subscribers = musicStreams.get(room.code) || new Set();
          if (
            subscribers.size >= 32 ||
            [...subscribers].filter((e) => e.userId === user.id).length >= 3
          )
            throw new HttpError(429, 'STREAM_LIMIT', '音樂連線太多，請關閉舊分頁');
          const entry = { res, userId: user.id };
          subscribers.add(entry);
          musicStreams.set(room.code, subscribers);
          res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
          res.setHeader('Cache-Control', 'no-cache, no-transform');
          res.setHeader('X-Accel-Buffering', 'no');
          res.flushHeaders();
          const sendState = () => {
            if (
              !auth.sessionFrom(req) ||
              kickedUsers.get(room.code)?.has(user.id) ||
              seats.get(room.code)?.get(user.id) !== p.id
            )
              return res.end();
            res.write('event: music\ndata: ' + JSON.stringify(musicProjection(room)) + '\n\n');
          };
          sendState();
          const timer = setInterval(sendState, 10000);
          timer.unref();
          runtime.ownStream(musicStreams, room.code, entry, req, timer);
          return;
        }
        if (url.pathname.startsWith('/api/draw/')) {
          if (room.type !== 'draw') throw new HttpError(400, 'WRONG_GAME', '這不是你畫我猜房間');
          if (url.pathname === '/api/draw/canvas' && req.method === 'GET')
            return send(room.canvasSnapshot());
          if (url.pathname === '/api/draw/result' && req.method === 'GET')
            return send(room.resultSnapshot(url.searchParams.get('resultId')));
          if (url.pathname === '/api/draw/events' && req.method === 'GET') {
            const entry = { res, userId: user.id },
              subscribers = drawStreams.get(room.code) || new Set();
            if (
              subscribers.size >= 32 ||
              [...subscribers].filter((item) => item.userId === user.id).length >= 3
            )
              throw new HttpError(429, 'DRAW_STREAM_LIMIT', '畫布連線太多，請先關閉舊分頁');
            res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
            res.setHeader('Cache-Control', 'no-cache, no-transform');
            res.setHeader('X-Accel-Buffering', 'no');
            res.setHeader('Connection', 'keep-alive');
            res.flushHeaders();
            subscribers.add(entry);
            drawStreams.set(room.code, subscribers);
            res.write(
              'event: ready\ndata: ' +
                JSON.stringify({
                  canvasEpoch: room.canvas.epoch,
                  round: room.round,
                  version: room.canvas.version,
                }) +
                '\n\n',
            );
            const keepAlive = setInterval(() => res.write(': keepalive\n\n'), 25000);
            keepAlive.unref();
            runtime.ownStream(drawStreams, room.code, entry, req, keepAlive);
            return;
          }
          if (req.method !== 'POST') throw new HttpError(405, 'METHOD_NOT_ALLOWED', '不支援的請求');
          if (url.pathname === '/api/draw/dissolve') {
            if (p.id !== room.host)
              throw new HttpError(403, 'DRAW_HOST_ONLY', '只有房主可以解散房間');
            if (data.confirmed !== true)
              throw new HttpError(400, 'CONFIRM_REQUIRED', '請先確認解散房間');
            if (data.canvasEpoch !== room.canvas.epoch)
              throw new HttpError(409, 'DRAW_STALE_ROUND', '房間狀態已更新，請重新確認');
            limitRate(roomRate, 'draw-dissolve:' + user.id, 6);
            transitions.transact(room, { action: 'dissolve', source: 'player', actor: p.id }, () =>
              room.finish('房主已解散房間'),
            );
            rooms.delete(room.code);
            cleanupRoom(room.code);
            return send({ closed: true, code: room.code });
          }
          if (url.pathname === '/api/draw/result/unsave') {
            if (data.confirmed !== true)
              throw new HttpError(400, 'CONFIRM_REQUIRED', '請先確認移除收藏');
            limitAccount(user);
            const savedId = room.savedResultArtwork(data.resultId, user.id);
            if (savedId && artworkStore.owned(user.id, savedId))
              artworkStore.remove(user.id, savedId);
            room.publicResults.get(data.resultId).artworks.delete(user.id);
            return send(withSocial(room, room.view(p.id)));
          }
          if (url.pathname === '/api/draw/result/ban') {
            limitRate(roomRate, 'mutation:' + user.id, 120);
            transitions.transact(
              room,
              {
                action: 'draw-word-ban',
                source: 'player',
                actor: p.id,
                input: { resultId: data.resultId },
              },
              () => room.voteWordBan(p.id, data.resultId),
            );
            return send(withSocial(room, room.view(p.id)));
          }
          if (url.pathname === '/api/draw/result/save') {
            limitAccount(user);
            const result = room.resultMetadata(data.resultId),
              savedId = room.savedResultArtwork(result.resultId, user.id),
              saved = savedId && artworkStore.owned(user.id, savedId);
            const context = {
              resultId: result.resultId,
              gameRunId: result.gameRunId,
              canvasEpoch: result.canvasEpoch,
            };
            if (saved) return send({ ...context, artwork: saved, duplicate: true });
            if (savedId && data.recollect !== true)
              throw new HttpError(
                409,
                'DRAW_SAVED_ARTWORK_DELETED',
                '你已刪除這輪收藏的作品，請確認是否重新收藏',
              );
            // The client renders this PNG. The server binds its label and idempotency
            // to the revealed result; it does not claim to reproduce or verify pixels.
            const name = [...`你畫我猜：${result.answer || '未選題'} — ${result.artist.name}`]
              .slice(0, 40)
              .join('');
            const artwork = artworkStore.add(user.id, {
              name,
              mime: 'image/png',
              base64: data.base64,
            });
            room.rememberResultArtwork(result.resultId, user.id, artwork.id);
            return send({ ...context, artwork, duplicate: false });
          }
          if (url.pathname === '/api/draw/result')
            throw new HttpError(405, 'METHOD_NOT_ALLOWED', '不支援的請求');
          if (url.pathname === '/api/draw/stroke') {
            const result = room.addStroke(p.id, data);
            if (!result.duplicate) publishDraw(room.code, 'stroke', result);
            return send(result);
          }
          if (url.pathname === '/api/draw/command') {
            const result = room.canvasCommand(p.id, data);
            publishDraw(room.code, 'reset', result);
            return send(result);
          }
        }
        if (url.pathname === '/api/game-song-audio')
          return gameAudio.serve(req, res, room, room.view(p.id), url.searchParams);
        if (url.pathname === '/api/musicquiz-clip') {
          if (req.method !== 'GET' || room.type !== 'musicquiz')
            throw new HttpError(404, 'NOT_FOUND', '找不到音訊');
          const bytes = room.audio(p.id, url.searchParams.get('roundId'));
          res.setHeader('Content-Type', 'audio/wav');
          res.setHeader('Cache-Control', 'no-store');
          return res.end(bytes);
        }
        if (url.pathname === '/api/telephone/draft') {
          if (room.type !== 'telephone')
            throw new HttpError(400, 'WRONG_GAME', '這不是傳情畫意房間');
          if (req.method !== 'POST') throw new HttpError(405, 'METHOD_NOT_ALLOWED', '不支援的請求');
          limitRate(roomRate, 'telephone-draft:' + user.id, 120);
          room.saveDraft(p.id, data);
          return send(withSocial(room, room.view(p.id)));
        }
        if (url.pathname === '/api/bluff/caption') {
          if (room.type !== 'bluff') throw new HttpError(400, 'WRONG_GAME', '這不是瞎掰王房間');
          if (req.method !== 'POST') throw new HttpError(405, 'METHOD_NOT_ALLOWED', '不支援的請求');
          // Interim subtitles are frequent and in-memory only, so they skip the
          // general mutation budget.
          limitRate(roomRate, 'bluff-caption:' + user.id, 150);
          room.caption(p.id, data);
          return send(withSocial(room, room.view(p.id)));
        }
        if (url.pathname === '/api/state') {
          // Streamed rooms award achievements when they change, not on every read.
          if (!stateStream.watched(room.code)) awardRoomAchievements(room);
          const view = withSocial(room, room.view(p.id)),
            tag = stateTag(view);
          // A polling page that already has this content gets a small reply.
          if (url.searchParams.get('since') === tag)
            return send({
              code: room.code,
              type: room.type || 'poker',
              unchanged: true,
              serverNow: view.serverNow,
              stateTag: tag,
            });
          return send({ ...view, stateTag: tag });
        }
        if (req.method !== 'POST') throw Error('不支援的請求');
        if (url.pathname === '/api/social') {
          if (data.kind === 'message' || data.kind === 'barrage') {
            sendRoomMessage({
              assertFrame: (user, id) => achievementStore.assertFrame(user.id, id),
              chat,
              barrageEvents,
              room,
              user,
              playerId: p.id,
              data,
            });
            stateStream.hint(room.code, 'chat');
            return send(withSocial(room, room.view(p.id)));
          }
          const now = Date.now(),
            rateKey = user.id + ':' + String(data.kind),
            last = socialRate.get(rateKey) || 0;
          if (now - last < 1500) throw new HttpError(429, 'SOCIAL_RATE_LIMIT', '請稍後再傳送');
          let event;
          if (data.kind === 'emoji') {
            if (typeof data.emoji !== 'string' || !ROOM_EMOJIS.includes(data.emoji))
              throw new HttpError(400, 'INVALID_EMOJI', '請選擇選單中的 emoji');
            event = {
              id: randomBytes(8).toString('hex'),
              kind: 'emoji',
              playerId: p.id,
              name: user.display_name,
              emoji: data.emoji,
              at: now,
            };
          } else if (data.kind === 'expression') {
            const saved = user.appearance ? JSON.parse(user.appearance) : defaults;
            const selected = selectedImage(db, user.id, {
              ...normalizeAppearance(saved),
              expression: data.expression,
            });
            if (selected.appearance.expression !== data.expression)
              throw new HttpError(400, 'INVALID_EXPRESSION', '這個角色沒有此表情');
            event = {
              id: randomBytes(8).toString('hex'),
              kind: 'expression',
              playerId: p.id,
              name: user.display_name,
              expression: data.expression,
              label: selected.label,
              image: characterMedia.broadcastImage(selected.url),
              at: now,
              ...(selected.sound
                ? {
                    sound: {
                      ...selected.sound,
                      url: characterMedia.broadcastSound(selected.sound.url),
                    },
                  }
                : {}),
            };
          } else throw new HttpError(400, 'INVALID_SOCIAL_KIND', '不支援的互動');
          socialRate.set(rateKey, now);
          if (event.kind === 'emoji') chat.record(room.code, event);
          const events = data.kind === 'expression' ? expressionEvents : barrageEvents;
          const roomEvents = events.get(room.code) || [];
          roomEvents.push(event);
          if (roomEvents.length > 50) roomEvents.shift();
          events.set(room.code, roomEvents);
          return send(withSocial(room, room.view(p.id)));
        }
        if (url.pathname === '/api/start') assertCanStartGame(room, p.id);
        if (url.pathname === '/api/start' && pendingAchievementUnits.size >= 4096)
          throw new HttpError(
            503,
            'ACHIEVEMENT_STORAGE_UNAVAILABLE',
            '回合紀錄暫時無法儲存，請稍後再開始',
          );
        limitRate(roomRate, 'mutation:' + user.id, 120);
        if (url.pathname === '/api/kick') {
          transitions.kick(room, p.id, data);
          return send(withSocial(room, room.view(p.id)));
        }
        transitions.transact(
          room,
          { action: url.pathname.slice(5), source: 'player', actor: p.id, input: data },
          () => {
            if (url.pathname === '/api/action') {
              if (room.type === 'musicquiz' && data.action === 'card-frame')
                achievementStore.assertFrame(user.id, data.frameId);
              if (room.type === 'thunder' || !room.type)
                room.humanAct(p.id, data.action, room.type === 'thunder' ? data : data.amount);
              else room.act(p.id, data.action, data);
            } else if (url.pathname === '/api/settings') {
              if (
                ![
                  'thunder',
                  'majority',
                  'gift',
                  'draw',
                  'telephone',
                  'bluff',
                  'quacks',
                  'second-wind',
                ].includes(room.type)
              )
                throw Error('此遊戲沒有此設定');
              room.configure(p.id, data);
            } else if (url.pathname === '/api/start') {
              room.start();
            } else if (url.pathname === '/api/bot') {
              if (room.host !== p.id) throw Error('只有房主可以加入電腦');
              if (room.type === 'thunder')
                room.add(
                  ['River', 'Clover', 'Atlas', 'Nova', 'Juno'][
                    room.players.filter((p) => p.bot).length % 5
                  ],
                  true,
                );
              else addTestBot(room);
            } else if (url.pathname === '/api/rebuy') {
              if (
                [
                  'thunder',
                  'majority',
                  'gift',
                  'draw',
                  'trpg',
                  'telephone',
                  'musicquiz',
                  'minimal',
                  'bluff',
                  'quacks',
                  'ceo',
                  'second-wind',
                ].includes(room.type) ||
                !['waiting', 'showdown'].includes(room.phase) ||
                p.stack > 0
              )
                throw Error('籌碼用完且本局結束後才能補充');
              p.stack = 2000;
            } else throw Error('未知請求');
          },
        );
        return send(withSocial(room, room.view(p.id)));
      }
      if (url.pathname === '/lobby.css') {
        const file = url.pathname.slice(1);
        res.setHeader(
          'Content-Type',
          file.endsWith('.css') ? 'text/css' : 'text/javascript; charset=utf-8',
        );
        return sendStatic(req, res, path.join(__dirname, '..', 'public', file));
      }
      const musicAsset = url.pathname.match(/^\/assets\/music\/([a-f0-9-]{36})$/);
      if (Object.hasOwn(TOURNAMENT_ART, url.pathname)) {
        const file = TOURNAMENT_ART[url.pathname];
        res.setHeader('Content-Type', file.endsWith('.svg') ? 'image/svg+xml' : 'image/png');
        if (file.endsWith('.svg'))
          res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
        return sendStatic(req, res, path.join(__dirname, '..', 'public', file));
      }
      if (Object.hasOwn(FREEHAND_ASSETS, url.pathname)) {
        res.setHeader('Content-Type', 'image/svg+xml');
        res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
        return sendStatic(
          req,
          res,
          path.join(__dirname, '..', 'public', FREEHAND_ASSETS[url.pathname]),
        );
      }
      if (
        url.pathname === '/shared/room-pings.css' ||
        url.pathname === '/shared/barrage-frames.css' ||
        url.pathname === '/shared/ui-widgets.css' ||
        url.pathname === '/shared/game-fx-layer.css'
      ) {
        const file = url.pathname.slice(1);
        res.setHeader(
          'Content-Type',
          file.endsWith('.css') ? 'text/css' : 'text/javascript; charset=utf-8',
        );
        return sendStatic(req, res, path.join(__dirname, '..', 'public', file));
      }
      if (musicAsset) {
        auth.requireUser(req);
        if (!['GET', 'HEAD'].includes(req.method))
          throw new HttpError(405, 'METHOD_NOT_ALLOWED', '不支援的請求');
        return musicStore.stream(req, res, musicAsset[1]);
      }
      const artworkAsset = url.pathname.match(/^\/assets\/artworks\/([a-f0-9-]{36})$/);
      if (artworkAsset) {
        const viewer = auth.requireUser(req),
          image = artworkStore.image(viewer.id, artworkAsset[1]);
        if (!image) throw new HttpError(404, 'ARTWORK_NOT_FOUND', '找不到你的作品');
        return sendImage(req, res, url, image, false);
      }
      const sharedGift = url.pathname.match(/^\/assets\/gifts\/shared\/([a-f0-9-]{36})$/);
      if (sharedGift) {
        auth.requireUser(req);
        const image = giftStore.image(sharedGift[1]);
        if (!image?.bytes) throw new HttpError(404, 'IMAGE_NOT_FOUND', '找不到禮物圖片');
        res.setHeader('Content-Type', image.mime);
        res.setHeader('Content-Security-Policy', "default-src 'none'");
        return sendCached(req, res, image.bytes, { cacheControl: PRIVATE_REVALIDATE });
      }
      if (GIFTS.some((gift) => gift.image === url.pathname)) {
        auth.requireUser(req);
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Content-Security-Policy', "default-src 'none'");
        return sendStatic(
          req,
          res,
          path.join(__dirname, '..', 'public', url.pathname),
          PRIVATE_REVALIDATE,
        );
      }
      // characterMedia rejects a ?v= that no longer names the stored bytes.
      if (USER_SOUND_PATH.test(url.pathname)) {
        const viewer = auth.requireUser(req),
          row = characterMedia.sound(viewer.id, url.href);
        if (!row) throw new HttpError(404, 'SOUND_NOT_FOUND', '找不到表情音效');
        return sendSound(req, res, url, row);
      }
      const media = url.pathname.match(USER_IMAGE_PATH);
      if (media) {
        const viewer = auth.requireUser(req),
          row = characterMedia.image(viewer.id, url.href);
        if (!row) throw new HttpError(404, 'IMAGE_NOT_FOUND', '找不到角色圖片');
        return sendImage(req, res, url, row, url.searchParams.has('v'));
      }
      if (url.pathname.startsWith('/assets/characters/')) {
        auth.requireUser(req);
        const asset = builtinCharacters
          .flatMap((character) => Object.values(character.expressions))
          .find((value) => value === url.pathname);
        if (!asset) throw new HttpError(404, 'IMAGE_NOT_FOUND', '找不到角色圖片');
        const { bytes } = readStatic(path.join(__dirname, '..', 'public', asset));
        return sendImage(
          req,
          res,
          url,
          { bytes, mime: asset.endsWith('.gif') ? 'image/gif' : 'image/png' },
          false,
        );
      }
      const characterId = url.pathname.match(/^\/characters\/([a-f0-9-]{36})(?:\.svg)?$/)?.[1];
      if (characterId) {
        const viewer = auth.requireUser(req),
          image = portrait(viewer.id, characterId);
        return sendImage(req, res, url, image, url.searchParams.get('v') === image.version);
      }
      const files = {
        '/assets/stitch/room-brand.svg': 'assets/stitch/room-brand.svg',
        '/assets/stitch/draw-waiting.jpg': 'assets/stitch/draw-waiting.jpg',
        '/assets/stitch/telephone-waiting.svg': 'assets/stitch/telephone-waiting.svg',
        '/assets/quacks/draw-777.webp': 'assets/quacks/draw-777.webp',
        // Pre-2.26 pages and caches still ask for the PNG; serve the WebP.
        '/assets/quacks/draw-777.png': 'assets/quacks/draw-777.webp',
        '/assets/game-sounds/quacks-push-user.wav': 'assets/game-sounds/quacks-push-user.wav',
        '/assets/game-sounds/quacks-decline-user.wav': 'assets/game-sounds/quacks-decline-user.wav',
        '/assets/bluff-reaction-photo.webp': 'assets/bluff-reaction-photo.webp',
        // Pre-2.26 pages and caches still ask for the PNG; serve the WebP.
        '/assets/bluff-reaction-photo.png': 'assets/bluff-reaction-photo.webp',
        '/assets/game-sounds/quacks-settlement-user.wav':
          'assets/game-sounds/quacks-settlement-user.wav',
        '/assets/game-sounds/quacks-explosion-fish.wav':
          'assets/game-sounds/quacks-explosion-fish.wav',
        '/assets/game-sounds/quacks-danger.wav': 'assets/game-sounds/quacks-danger.wav',
        '/assets/game-sounds/quacks-buy.wav': 'assets/game-sounds/quacks-buy.wav',
        '/assets/game-sounds/quacks-ruby.wav': 'assets/game-sounds/quacks-ruby.wav',
        '/assets/game-sounds/quacks-witch.wav': 'assets/game-sounds/quacks-witch.wav',
        '/assets/stitch/waiting-host.jpg': 'assets/stitch/waiting-host.jpg',
        '/assets/stitch/waiting-guest.jpg': 'assets/stitch/waiting-guest.jpg',
        '/assets/stitch/secret-cards.jpg': 'assets/stitch/secret-cards.jpg',
        '/assets/fonts/plus-jakarta-500.woff2': 'assets/fonts/plus-jakarta-500.woff2',
        '/assets/fonts/plus-jakarta-600.woff2': 'assets/fonts/plus-jakarta-600.woff2',
        '/assets/fonts/plus-jakarta-700.woff2': 'assets/fonts/plus-jakarta-700.woff2',
        '/assets/fonts/plus-jakarta-800.woff2': 'assets/fonts/plus-jakarta-800.woff2',
        '/assets/fonts/Plus-Jakarta-Sans-OFL.txt': 'assets/fonts/Plus-Jakarta-Sans-OFL.txt',
        '/shared/template-tokens.css': 'shared/template-tokens.css',
        '/shared/template-components.css': 'shared/template-components.css',
        '/assets/game-sounds/quacks-explosion.wav': 'assets/game-sounds/quacks-explosion.wav',
        '/quacks': 'quacks.html',
        '/quacks.css': 'quacks.css',
        '/assets/game-sounds/bluff-reaction.mp3': 'assets/game-sounds/bluff-reaction.mp3',
        '/bluff': 'bluff.html',
        '/musicquiz': 'musicquiz.html',
        '/minimal': 'minimal.html',
        '/telephone': 'telephone.html',
        '/trpg': 'trpg.html',
        '/shared/playful-theme.css': 'shared/playful-theme.css',
        '/credits': 'credits.html',
        '/credits.css': 'credits.css',
        '/market': 'market.html',
        '/assets/game-sounds/entrance-soul-world.mp3': 'assets/game-sounds/entrance-soul-world.mp3',
        '/assets/game-sounds/turn.wav': 'assets/game-sounds/turn.wav',
        '/assets/game-sounds/dice-roll.wav': 'assets/game-sounds/dice-roll.wav',
        '/assets/game-sounds/shot.wav': 'assets/game-sounds/shot.wav',
        '/assets/game-sounds/slam.wav': 'assets/game-sounds/slam.wav',
        '/assets/game-sounds/nitro.wav': 'assets/game-sounds/nitro.wav',
        '/assets/game-sounds/skid.wav': 'assets/game-sounds/skid.wav',
        '/shared/ui-foundation.css': 'shared/ui-foundation.css',
        '/shared/ui-primitives.css': 'shared/ui-primitives.css',
        '/collection': 'collection.html',
        '/collection.css': 'collection.css',
        '/settings': 'settings.html',
        '/settings.css': 'settings.css',
        '/shared/site-header.css': 'shared/site-header.css',
        '/music': 'music.html',
        '/shared/table-music.css': 'shared/table-music.css',
        '/profile': 'profile.html',
        '/studio': 'studio.html',
        '/admin': 'admin.html',
        '/login': 'login.html',
        '/community': 'community.html',
        '/community.css': 'community.css',
        '/majority': 'majority.html',
        '/majority.css': 'majority.css',
        '/gift': 'gift.html',
        '/gift.css': 'gift.css',
        '/draw': 'draw.html',
        '/draw.css': 'draw.css',
        '/draw-words': 'draw-words.html',
        '/gifts': 'gifts.html',
        '/gifts.css': 'gifts.css',
        '/': 'index.html',
        '/poker': 'poker.html',
        '/race': 'race.html',
        '/ceo': 'ceo.html',
        '/second-wind': 'second-wind.html',
        '/rules': 'rules.html',
        '/achievements': 'achievements.html',
        '/shared/achievement-glow.css': 'shared/achievement-glow.css',
        '/club.css': 'club.css',
        '/club-pages.css': 'club-pages.css',
        '/assets/thunder-components.png': 'assets/thunder-components.png',
        '/assets/thunder-box.webp': 'assets/thunder-box.webp',
        // Pre-2.26 pages and caches still ask for the PNG; serve the WebP.
        '/assets/thunder-box.png': 'assets/thunder-box.webp',
        '/assets/gift-sounds/open_001.wav': 'assets/gift-sounds/open_001.wav',
        '/assets/gift-sounds/confirmation_001.wav': 'assets/gift-sounds/confirmation_001.wav',
        '/assets/game-sounds/quacks-settlement.wav': 'assets/game-sounds/quacks-settlement.wav',
        '/assets/game-sounds/quacks-card.wav': 'assets/game-sounds/quacks-card.wav',
        '/assets/quacks/draw-portrait-v1.webp': 'assets/quacks/draw-portrait-v1.webp',
        // Pre-2.26 pages and caches still ask for the PNG; serve the WebP.
        '/assets/quacks/draw-portrait-v1.png': 'assets/quacks/draw-portrait-v1.webp',
        '/assets/quacks/stop-portrait-v1.webp': 'assets/quacks/stop-portrait-v1.webp',
        // Pre-2.26 pages and caches still ask for the PNG; serve the WebP.
        '/assets/quacks/stop-portrait-v1.png': 'assets/quacks/stop-portrait-v1.webp',
        '/assets/quacks/explosion-reference-v1.webp': 'assets/quacks/explosion-reference-v1.webp',
        // Pre-2.26 pages and caches still ask for the PNG; serve the WebP.
        '/assets/quacks/explosion-reference-v1.png': 'assets/quacks/explosion-reference-v1.webp',
        '/assets/room-leave-thumbnail.jpg': 'assets/room-leave-thumbnail.jpg',
        '/sound-library': 'sound-library.html',
        '/assets/game-sounds/correct-user.mp3': 'assets/game-sounds/correct-user.mp3',
        '/assets/game-sounds/incorrect-user.mp3': 'assets/game-sounds/incorrect-user.mp3',
        '/admin/game-audio': 'game-audio-admin.html',
        '/assets/game-sounds/quacks-drink-real.mp3': 'assets/game-sounds/quacks-drink-real.mp3',
      };
      const roomPath = url.pathname.match(
        /^\/(race|poker|majority|gift|draw|trpg|telephone|musicquiz|minimal|bluff|quacks|ceo|second-wind)\/[A-Fa-f0-9]{6}\/?$/,
      );
      for (const name of [
        'ux02-10.svg',
        'ux06-27.svg',
        'ux06-25.svg',
        'ux02-16.svg',
        'ux02-01.png',
        'ux02-18.svg',
        'ux02-03.png',
        'ux02-06.svg',
        'ux02-17.svg',
        'ux06-22.svg',
        'ux06-14.svg',
        'ux02-02.png',
        'ux06-01.svg',
        'ux02-13.svg',
        'ux06-08.svg',
        'ux06-20.svg',
        'ux02-26.svg',
        'ux06-03.svg',
        'ux02-19.svg',
        'ux02-23.svg',
        'ux02-25.svg',
        'ux02-14.svg',
        'ux06-16.svg',
        'ux02-24.svg',
        'ux06-05.svg',
        'ux06-32.svg',
        'ux06-02.svg',
        'ux02-15.svg',
        'ux06-19.svg',
        'ux06-04.svg',
        'ux06-09.svg',
        'ux02-09.svg',
        'ux06-24.svg',
        'ux02-07.svg',
        'ux06-30.svg',
        'ux02-22.svg',
        'ux06-17.svg',
        'ux06-06.svg',
        'ux06-15.svg',
        'ux06-11.svg',
        'ux06-26.svg',
        'ux02-20.svg',
        'ux06-10.svg',
        'ux06-07.svg',
        'ux02-04.svg',
        'ux06-18.svg',
        'ux02-12.svg',
        'ux06-13.svg',
        'ux02-08.svg',
        'ux02-21.svg',
        'ux06-31.svg',
        'ux06-28.svg',
        'ux06-34.svg',
        'ux06-12.svg',
        'ux02-05.svg',
        'ux06-29.svg',
        'ux06-33.svg',
        'ux06-21.svg',
        'ux02-11.svg',
        'ux06-23.svg',
      ])
        files['/assets/stitch/figma/' + name] = 'assets/stitch/figma/' + name;
      for (const type of ['ping', 'attention', 'question', 'help', 'look'])
        files['/assets/game-sounds/ping-' + type + '.wav'] =
          'assets/game-sounds/ping-' + type + '.wav';
      files['/assets/game-sounds/entry-home-family.mp3'] =
        'assets/game-sounds/entry-home-family.mp3';
      files['/assets/game-sounds/entry-intro-user.mp3'] = 'assets/game-sounds/entry-intro-user.mp3';
      for (const name of [
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
      ])
        files['/assets/game-sounds/ping-voice-' + name + '.mp3'] =
          'assets/game-sounds/ping-voice-' + name + '.mp3';
      for (const name of [
        'register-320.webp',
        'register-480.webp',
        'register-576.webp',
        'login-320.webp',
        'login-480.webp',
        'login-576.webp',
        'login-864.webp',
        'soul-world.webp',
        'home-family.jpg',
      ])
        files['/assets/auth/' + name] = 'assets/auth/' + name;
      for (const name of ['stanley021039', 'x55662306', 'azrael04'])
        for (const width of [64, 88, 176])
          files[`/assets/auth/${name}-${width}.webp`] = `assets/auth/${name}-${width}.webp`;
      // Old WAV URLs remain compatible, but deliver the checked compressed bytes.
      for (const sound of require('../public/assets/game-sounds/compressed-manifest.json').sounds) {
        for (const name of [sound.source, sound.file])
          files['/assets/' + sound.directory + '/' + name] =
            'assets/' + sound.directory + '/' + sound.file;
      }
      files['/shared/entry-intro.css'] = 'shared/entry-intro.css';
      if (
        (url.pathname === '/ceo' || roomPath?.[1] === 'ceo') &&
        (!frontend || config.ceoEnabled === false)
      ) {
        res.writeHead(404);
        return res.end();
      }
      if (
        (url.pathname === '/second-wind' || roomPath?.[1] === 'second-wind') &&
        (!frontend || config.secondWindEnabled === false)
      ) {
        res.writeHead(404);
        return res.end();
      }
      const file = roomPath ? roomPath[1] + '.html' : files[url.pathname];
      if (!file) {
        res.writeHead(404);
        return res.end();
      }
      const voiceAsset = /^\/assets\/game-sounds\/(ping-voice-[a-z-]+)\.mp3$/.exec(url.pathname);
      if (voiceAsset) {
        res.setHeader('Cache-Control', 'private, no-store');
        res.setHeader('Vary', 'Cookie');
        const owner = auth.requireUser(req);
        if (
          !require('./achievements/bonus-rewards').ownedSounds(db, owner.id).includes(voiceAsset[1])
        )
          throw new HttpError(403, 'PING_SOUND_LOCKED', '請先取得對應成就音效，或兌換 Ping 獎勵');
      }
      if (file.endsWith('.html') && file !== 'login.html') {
        const visitor = auth.sessionFrom(req);
        if (!visitor) {
          res.writeHead(302, {
            Location:
              roomPath ||
              file === 'market.html' ||
              file === 'trpg.html' ||
              file === 'telephone.html' ||
              file === 'musicquiz.html' ||
              file === 'minimal.html' ||
              file === 'bluff.html' ||
              file === 'quacks.html' ||
              file === 'ceo.html' ||
              file === 'second-wind.html'
                ? '/login?next=' + encodeURIComponent(url.pathname)
                : '/login',
          });
          return res.end();
        }
        if (['admin.html', 'game-audio-admin.html'].includes(file) && visitor.role !== 'admin')
          throw new HttpError(403, 'ADMIN_REQUIRED', '只有管理者可以操作');
      }
      res.setHeader(
        'Content-Type',
        file.endsWith('.webp')
          ? 'image/webp'
          : file.endsWith('.jpg')
            ? 'image/jpeg'
            : file.endsWith('.woff2')
              ? 'font/woff2'
              : file.endsWith('.txt')
                ? 'text/plain; charset=utf-8'
                : file.endsWith('.png')
                  ? 'image/png'
                  : file.endsWith('.svg')
                    ? 'image/svg+xml'
                    : file.endsWith('.svg')
                      ? 'image/svg+xml'
                      : file.endsWith('.svg')
                        ? 'image/svg+xml'
                        : file.endsWith('.svg')
                          ? 'image/svg+xml'
                          : file.endsWith('.svg')
                            ? 'image/svg+xml'
                            : file.endsWith('.svg')
                              ? 'image/svg+xml'
                              : file.endsWith('.svg')
                                ? 'image/svg+xml'
                                : file.endsWith('.svg')
                                  ? 'image/svg+xml'
                                  : file.endsWith('.svg')
                                    ? 'image/svg+xml'
                                    : file.endsWith('.svg')
                                      ? 'image/svg+xml'
                                      : file.endsWith('.svg')
                                        ? 'image/svg+xml'
                                        : file.endsWith('.mp3')
                                          ? 'audio/mpeg'
                                          : file.endsWith('.wav')
                                            ? 'audio/wav'
                                            : file.endsWith('.css')
                                              ? 'text/css'
                                              : file.endsWith('.js')
                                                ? 'text/javascript; charset=utf-8'
                                                : 'text/html; charset=utf-8',
      );
      if (!file.endsWith('.html'))
        return sendStatic(
          req,
          res,
          path.join(__dirname, '..', 'public', file),
          voiceAsset ? 'private, no-store' : PRIVATE_REVALIDATE,
        );
      // 瞎掰王's talk button uses the browser's speech recognizer, which needs the
      // microphone; every other page keeps it blocked.
      if (file === 'bluff.html')
        res.setHeader('Permissions-Policy', 'camera=(), microphone=(self), geolocation=()');
      // Every executable page is built by Vite, including the audio tools.
      // API-only instances explicitly decline documents.
      const document = frontend?.readPage(file);
      if (!document) throw new HttpError(503, 'FRONTEND_NOT_BUILT', '網站前端尚未建置，請稍後再試');
      res.end(withEntryIntro(document, { authPage: file === 'login.html' }));
    } catch (e) {
      writeError(res, e);
    }
  };

  // Once closing, new requests (often a stream reconnecting over a kept-alive
  // socket) are turned away, or they would hold the shutdown open and delay
  // saving rooms. Requests already running still finish.
  const server = http.createServer((req, res) => {
    if (!closed) return handler(req, res);
    res.writeHead(503, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      Connection: 'close',
      'Retry-After': '2',
    });
    res.end(JSON.stringify({ code: 'RESTARTING', error: '伺服器更新中，請稍候再試' }));
  });
  server.headersTimeout = 10000;
  server.requestTimeout = 30000;
  server.keepAliveTimeout = 5000;
  let closed = false,
    starting = null,
    listenPromise = null,
    closePromise = null;
  function listen() {
    if (closed) return Promise.reject(Error('Application has been closed'));
    if (listenPromise) return listenPromise;
    starting = (async () => {
      await new Promise((resolve, reject) => {
        server.once('error', reject);
        try {
          server.listen(port, config.host, () => {
            server.off('error', reject);
            resolve();
          });
        } catch (error) {
          server.off('error', reject);
          reject(error);
        }
      });
      if (closed) throw Error('Application has been closed');
      restoreRooms();
      runtime.start({
        transitions,
        onSweep: retryAchievementUnits,
        onDrawStroke: publishDraw,
      });
      submissions.recover();
      marketAutomation.start();
      marketImageStore.startThumbnails();
      refreshThumbnails();
      return server.address();
    })();
    // close waits for the raw startup, never for this recovery promise.
    listenPromise = starting.catch(async (error) => {
      try {
        await close();
      } catch (cleanupError) {
        throw new AggregateError([error, cleanupError], 'Application startup failed');
      }
      throw error;
    });
    return listenPromise;
  }
  function close() {
    if (closePromise) return closePromise;
    closed = true;
    closePromise = (async () => {
      if (starting) await starting.catch(() => {});
      const errors = [],
        attempt = async (action) => {
          try {
            await action();
          } catch (error) {
            errors.push(error);
          }
        };
      await attempt(() => runtime.stop());
      // Stop admitting requests before draining SSE. In-flight handlers may still
      // use room state; keep it alive until the HTTP server finishes draining.
      const serverClosed = server.listening
        ? new Promise((resolve) =>
            server.close((error) => {
              if (error) errors.push(error);
              resolve();
            }),
          )
        : Promise.resolve();
      await attempt(() => marketAutomation.stop());
      await attempt(() => marketImageStore.stopThumbnails());
      await attempt(() => mediaThumbnails.stop());
      await attempt(() => mediaAudio.stop());
      await attempt(() => stateStream.close());
      await attempt(() => runtime.drainStreams());
      await serverClosed;
      for (const room of rooms.values()) await attempt(() => awardRoomAchievements(room));
      await attempt(() => retryAchievementUnits());
      if (ownsSavedRooms) await attempt(() => saveRooms());
      await attempt(() => runtime.close());
      await attempt(() => youtubeTitles.clear?.());
      await attempt(() => Promise.allSettled([...submissions.inFlight.values()]));
      await attempt(() => roomInvitations.close());
      await attempt(() => db.close());
      await attempt(() => dataLock.release());
      if (errors.length === 1) throw errors[0];
      if (errors.length) throw new AggregateError(errors, 'Application cleanup failed');
    })();
    return closePromise;
  }
  return { server, listen, close };
}
module.exports = { createApp };
